import GitlabApi from "../GitlabLoader/gitlab-api";
import {
	GitCodeMember,
	InternalMemberIndex,
	InternalMemberLoadResult,
	InternalMemberRecord,
	RepoCollaboratorSyncState,
	RepoCollaboratorSyncStatus,
} from "./member-types";
import {GitlabIssuesSettings} from "../SettingsTab/settings-types";

export default class MemberLoader {
	private static readonly MAX_REPOS_PER_RUN = 12;
	private static readonly FORBIDDEN_RETRY_DELAY_MS = 24 * 60 * 60 * 1000;
	private static readonly RATE_LIMIT_RETRY_DELAY_MS = 10 * 60 * 1000;
	private static readonly ERROR_RETRY_DELAY_MS = 30 * 60 * 1000;

	constructor(private settings: GitlabIssuesSettings) {}

	async loadInternalMemberIndex(
		repoNames: string[] = this.settings.repoList,
		previousIndex?: InternalMemberIndex | null,
	): Promise<InternalMemberLoadResult> {
		const repoMembers = this.cloneRepoMembers(previousIndex?.repoMembers);
		const repoSyncState = this.cloneRepoSyncState(previousIndex?.repoSyncState);
		const warningMessages: string[] = [];
		const now = new Date();
		const attemptedReposThisRun: string[] = [];
		const repoQueue = this.selectReposToSync(repoNames, repoSyncState, now);

		for (const repoName of repoQueue) {
			attemptedReposThisRun.push(repoName);
			const state = repoSyncState[repoName] ?? {status: 'error' as RepoCollaboratorSyncStatus};
			state.lastAttemptAt = now.toISOString();

			try {
				const collaborators = await GitlabApi.loadAllPages<GitCodeMember>(
					`${this.settings.gitlabApiUrl()}/repos/${this.settings.orgName}/${repoName}/collaborators`,
					this.settings.gitlabToken,
				);

				repoMembers[repoName] = this.extractRepoUsernames(collaborators);
				state.status = 'success';
				state.lastSuccessAt = now.toISOString();
				state.nextRetryAt = undefined;
				state.warningMessage = undefined;
				state.collaboratorCount = repoMembers[repoName].length;
			} catch (error) {
				const message = this.getErrorMessage(error);
				const status = this.classifySyncFailure(message);
				state.status = status;
				state.warningMessage = `Failed to sync repo collaborators for ${repoName}: ${message}`;
				state.nextRetryAt = new Date(now.getTime() + this.getRetryDelayMs(status)).toISOString();
				warningMessages.push(state.warningMessage);

				if (status === 'rate_limited') {
					repoSyncState[repoName] = state;
					break;
				}
			}

			repoSyncState[repoName] = state;
		}

		const usernames: InternalMemberIndex['usernames'] = {};
		for (const repoName of repoNames) {
			for (const username of repoMembers[repoName] ?? []) {
				if (!usernames[username]) {
					usernames[username] = {username, source: 'repo', repo: repoName};
				}
			}
		}

		this.settings.internalUserWhitelist.forEach((username) => {
			if (!usernames[username]) {
				usernames[username] = {username, source: 'whitelist'};
			}
		});

		const index: InternalMemberIndex = {
			usernames,
			repoMembers,
			repoSyncState,
			syncProgress: this.buildSyncProgress(repoNames, repoMembers, repoSyncState, attemptedReposThisRun),
		};

		return {
			index,
			warningMessages,
		};
	}

	private selectReposToSync(
		repoNames: string[],
		repoSyncState: Record<string, RepoCollaboratorSyncState>,
		now: Date,
	) {
		const syncable = repoNames.filter((repoName) => {
			const nextRetryAt = repoSyncState[repoName]?.nextRetryAt;

			return !nextRetryAt || new Date(nextRetryAt).getTime() <= now.getTime();
		});

		const prioritize = (repoName: string) => {
			const status = repoSyncState[repoName]?.status;

			switch (status) {
				case 'success':
					return 3;
				case 'forbidden':
					return 2;
				case 'error':
					return 1;
				case 'rate_limited':
				default:
					return 0;
			}
		};

		return syncable
			.sort((left, right) => {
				const priorityDelta = prioritize(left) - prioritize(right);
				if (priorityDelta !== 0) {
					return priorityDelta;
				}

				return left.localeCompare(right);
			})
			.slice(0, MemberLoader.MAX_REPOS_PER_RUN);
	}

	private extractRepoUsernames(collaborators: GitCodeMember[]) {
		return Array.from(new Set(
			collaborators
				.map((member) => member.username?.trim())
				.filter((username): username is string => Boolean(username)),
		));
	}

	private cloneRepoMembers(repoMembers?: Record<string, string[]>) {
		const result: Record<string, string[]> = {};

		for (const [repoName, usernames] of Object.entries(repoMembers ?? {})) {
			result[repoName] = [...usernames];
		}

		return result;
	}

	private cloneRepoSyncState(repoSyncState?: Record<string, RepoCollaboratorSyncState>) {
		const result: Record<string, RepoCollaboratorSyncState> = {};

		for (const [repoName, state] of Object.entries(repoSyncState ?? {})) {
			result[repoName] = {...state};
		}

		return result;
	}

	private buildSyncProgress(
		repoNames: string[],
		repoMembers: Record<string, string[]>,
		repoSyncState: Record<string, RepoCollaboratorSyncState>,
		attemptedReposThisRun: string[],
	): NonNullable<InternalMemberIndex['syncProgress']> {
		let successRepoCount = 0;
		let forbiddenRepoCount = 0;
		let rateLimitedRepoCount = 0;
		let errorRepoCount = 0;
		let cachedRepoCount = 0;

		for (const repoName of repoNames) {
			if ((repoMembers[repoName]?.length ?? 0) > 0) {
				cachedRepoCount += 1;
			}

			switch (repoSyncState[repoName]?.status) {
				case 'success':
					successRepoCount += 1;
					break;
				case 'forbidden':
					forbiddenRepoCount += 1;
					break;
				case 'rate_limited':
					rateLimitedRepoCount += 1;
					break;
				case 'error':
					errorRepoCount += 1;
					break;
				default:
					break;
			}
		}

		return {
			totalRepos: repoNames.length,
			cachedRepoCount,
			successRepoCount,
			forbiddenRepoCount,
			rateLimitedRepoCount,
			errorRepoCount,
			pendingRepoCount: repoNames.length - successRepoCount - forbiddenRepoCount,
			attemptedReposThisRun,
		};
	}

	private classifySyncFailure(message: string): RepoCollaboratorSyncStatus {
		if (message.includes('403')) {
			return 'forbidden';
		}

		if (message.includes('429') || message.includes('Threshold:')) {
			return 'rate_limited';
		}

		return 'error';
	}

	private getRetryDelayMs(status: RepoCollaboratorSyncStatus) {
		switch (status) {
			case 'forbidden':
				return MemberLoader.FORBIDDEN_RETRY_DELAY_MS;
			case 'rate_limited':
				return MemberLoader.RATE_LIMIT_RETRY_DELAY_MS;
			case 'error':
			default:
				return MemberLoader.ERROR_RETRY_DELAY_MS;
		}
	}

	private getErrorMessage(error: unknown) {
		return error instanceof Error ? error.message : String(error);
	}
}

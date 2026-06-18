export type InternalMatchSource = 'org' | 'repo' | 'whitelist' | 'none';
export type RepoCollaboratorSyncStatus = 'success' | 'forbidden' | 'rate_limited' | 'error';

export interface GitCodeMember {
	username: string;
	name?: string;
}

export interface InternalMemberRecord {
	username: string;
	source: Exclude<InternalMatchSource, 'none'>;
	repo?: string;
}

export interface RepoCollaboratorSyncState {
	status: RepoCollaboratorSyncStatus;
	lastAttemptAt?: string;
	lastSuccessAt?: string;
	nextRetryAt?: string;
	collaboratorCount?: number;
	warningMessage?: string;
}

export interface InternalMemberSyncProgress {
	totalRepos: number;
	cachedRepoCount: number;
	successRepoCount: number;
	forbiddenRepoCount: number;
	rateLimitedRepoCount: number;
	errorRepoCount: number;
	pendingRepoCount: number;
	attemptedReposThisRun: string[];
}

export interface InternalMemberIndex {
	usernames: Record<string, InternalMemberRecord>;
	repoMembers?: Record<string, string[]>;
	repoSyncState?: Record<string, RepoCollaboratorSyncState>;
	syncProgress?: InternalMemberSyncProgress;
}

export interface InternalMemberLoadResult {
	index: InternalMemberIndex;
	warningMessages: string[];
}

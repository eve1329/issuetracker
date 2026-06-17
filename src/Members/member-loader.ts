import GitlabApi from "../GitlabLoader/gitlab-api";
import {GitCodeMember, InternalMemberIndex} from "./member-types";
import {GitlabIssuesSettings} from "../SettingsTab/settings-types";

export default class MemberLoader {
	constructor(private settings: GitlabIssuesSettings) {}

	async loadInternalMemberIndex(): Promise<InternalMemberIndex> {
		const usernames: InternalMemberIndex['usernames'] = {};

		const orgMembers = await GitlabApi.loadAllPages<GitCodeMember>(
			`${this.settings.gitlabApiUrl()}/orgs/${this.settings.orgName}/members`,
			this.settings.gitlabToken,
		);

		orgMembers.forEach((member) => {
			usernames[member.username] = {username: member.username, source: 'org'};
		});

		for (const repoName of this.settings.repoList) {
			const collaborators = await GitlabApi.loadAllPages<GitCodeMember>(
				`${this.settings.gitlabApiUrl()}/repos/${this.settings.orgName}/${repoName}/collaborators`,
				this.settings.gitlabToken,
			);

			collaborators.forEach((member) => {
				if (!usernames[member.username]) {
					usernames[member.username] = {username: member.username, source: 'repo', repo: repoName};
				}
			});
		}

		this.settings.internalUserWhitelist.forEach((username) => {
			if (!usernames[username]) {
				usernames[username] = {username, source: 'whitelist'};
			}
		});

		return {usernames};
	}
}

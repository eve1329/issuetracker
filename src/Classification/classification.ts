import {InternalMemberIndex} from "../Members/member-types";
import {Issue} from "../GitlabLoader/issue-types";
import {ClassificationRules} from "../SettingsTab/settings-types";

export function matchInternalAuthor(username: string, index: InternalMemberIndex) {
	const match = index.usernames[username];

	if (!match) {
		return {
			isInternalAuthor: false,
			internalMatchedBy: 'none' as const,
		};
	}

	return {
		isInternalAuthor: true,
		internalMatchedBy: match.source,
	};
}

export function classifyIssue(
	issue: Pick<Issue, 'title' | 'labels'>,
	rules: ClassificationRules,
) {
	for (const [prefix, requestKind] of Object.entries(rules.titlePrefixes)) {
		if (issue.title.startsWith(prefix)) {
			return {
				requestKind,
				requestKindMatchedBy: 'title-prefix' as const,
			};
		}
	}

	for (const label of issue.labels) {
		if (rules.labels[label]) {
			return {
				requestKind: rules.labels[label],
				requestKindMatchedBy: 'label' as const,
			};
		}
	}

	for (const [keyword, requestKind] of Object.entries(rules.titleKeywords ?? {})) {
		if (issue.title.includes(keyword)) {
			return {
				requestKind,
				requestKindMatchedBy: 'title-keyword' as const,
			};
		}
	}

	return {
		requestKind: 'unknown' as const,
		requestKindMatchedBy: 'none' as const,
	};
}

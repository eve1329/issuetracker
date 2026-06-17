import {InternalMemberIndex} from "../Members/member-types";

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

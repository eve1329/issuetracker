export interface FirstResponseComment {
	authorUsername: string;
	createdAt: string;
	isSystem: boolean;
}

export function findFirstOtherPersonResponseAt(
	issueAuthorUsername: string,
	comments: FirstResponseComment[],
) {
	const authorUsername = normalizeUsername(issueAuthorUsername);
	const response = comments
		.filter((comment) => {
			const commenterUsername = normalizeUsername(comment.authorUsername);
			return !comment.isSystem
				&& Boolean(commenterUsername)
				&& commenterUsername !== authorUsername
				&& Number.isFinite(Date.parse(comment.createdAt));
		})
		.sort(compareComments)[0];

	return response?.createdAt ?? '';
}

function normalizeUsername(username: string) {
	return username.trim().toLowerCase();
}

function compareComments(left: FirstResponseComment, right: FirstResponseComment) {
	const leftTime = Date.parse(left.createdAt);
	const rightTime = Date.parse(right.createdAt);
	return leftTime - rightTime || left.createdAt.localeCompare(right.createdAt);
}

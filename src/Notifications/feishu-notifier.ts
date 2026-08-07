import {requestUrl} from 'obsidian';
import {NewIssue} from './new-issue-notifications';

export const MAX_ISSUES_PER_MESSAGE = 10;

export function splitFeishuNewIssueBatches(issues: NewIssue[]): NewIssue[][] {
	const externalIssues = issues.filter(isExternalIssue);
	const batches: NewIssue[][] = [];
	for (let index = 0; index < externalIssues.length; index += MAX_ISSUES_PER_MESSAGE) {
		batches.push(externalIssues.slice(index, index + MAX_ISSUES_PER_MESSAGE));
	}
	return batches;
}

export function buildFeishuNewIssuePayload(issues: NewIssue[]) {
	const externalIssues = issues.filter(isExternalIssue);
	const visibleIssues = externalIssues.slice(0, MAX_ISSUES_PER_MESSAGE);
	const content = visibleIssues.map((issue) => ([
		{
			tag: 'text',
			text: `[外部 Issue] ${issue.sourceRepo}#${issue.iid} ${issue.title}\n作者：${issue.authorName || issue.authorUsername}`,
		},
		{
			tag: 'a',
			text: '打开 Issue',
			href: issue.webUrl,
		},
	]));

	if (externalIssues.length > visibleIssues.length) {
		const hiddenIssues = externalIssues.slice(visibleIssues.length);
		content.push([{tag: 'text', text: `另有 ${hiddenIssues.length} 个新增外部 Issue。`}]);
	}

	return {
		msg_type: 'post',
		content: {
			post: {
				zh_cn: {
					title: `IssueTracker：${externalIssues.length} 个新增外部 Issue`,
					content,
				},
			},
		},
	};
}

export async function sendFeishuNewIssueNotification(
	webhookUrl: string,
	issues: NewIssue[],
): Promise<void> {
	const url = webhookUrl.trim();
	const externalIssues = issues.filter(isExternalIssue);
	if (!url || externalIssues.length === 0) {
		return;
	}

	const response = await requestUrl({
		url,
		method: 'POST',
		contentType: 'application/json',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify(buildFeishuNewIssuePayload(externalIssues)),
		throw: false,
	});

	if (response.status < 200 || response.status >= 300) {
		throw new Error(`Feishu webhook returned HTTP ${response.status}`);
	}

	if (typeof response.json?.code === 'number' && response.json.code !== 0) {
		throw new Error(`Feishu webhook rejected the message (${response.json.code})`);
	}
}

function isExternalIssue(issue: Pick<NewIssue, 'authorType'>) {
	return issue.authorType === 'external';
}

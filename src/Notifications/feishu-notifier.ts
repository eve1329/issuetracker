import {requestUrl} from 'obsidian';
import {NewExternalIssue} from './new-issue-notifications';

const MAX_ISSUES_PER_MESSAGE = 10;

export function buildFeishuNewExternalIssuePayload(issues: NewExternalIssue[]) {
	const visibleIssues = issues.slice(0, MAX_ISSUES_PER_MESSAGE);
	const content = visibleIssues.map((issue) => ([
		{
			tag: 'text',
			text: `${issue.sourceRepo}#${issue.iid} ${issue.title}\n作者：${issue.authorName || issue.authorUsername}`,
		},
		{
			tag: 'a',
			text: '打开 Issue',
			href: issue.webUrl,
		},
	]));

	if (issues.length > visibleIssues.length) {
		content.push([{tag: 'text', text: `另有 ${issues.length - visibleIssues.length} 个新增外部 Issue。`}]);
	}

	return {
		msg_type: 'post',
		content: {
			post: {
				zh_cn: {
					title: `IssueTracker：${issues.length} 个新增外部 Issue`,
					content,
				},
			},
		},
	};
}

export async function sendFeishuNewExternalIssueNotification(
	webhookUrl: string,
	issues: NewExternalIssue[],
): Promise<void> {
	const url = webhookUrl.trim();
	if (!url || issues.length === 0) {
		return;
	}

	const response = await requestUrl({
		url,
		method: 'POST',
		contentType: 'application/json',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify(buildFeishuNewExternalIssuePayload(issues)),
		throw: false,
	});

	if (response.status < 200 || response.status >= 300) {
		throw new Error(`Feishu webhook returned HTTP ${response.status}`);
	}

	if (typeof response.json?.code === 'number' && response.json.code !== 0) {
		throw new Error(`Feishu webhook rejected the message (${response.json.code})`);
	}
}

import * as ObsidianModule from 'obsidian';
import {
	buildFeishuNewIssuePayload,
	sendFeishuNewIssueNotification,
	splitFeishuNewIssueBatches,
} from '../../src/Notifications/feishu-notifier';

const issue = {
	issueKey: 'repo-a#2',
	sourceRepo: 'repo-a',
	iid: 2,
	title: '外部新增问题',
	createdAt: '2026-08-01T08:00:00+08:00',
	authorName: 'Partner A',
	authorUsername: 'partner_a',
	webUrl: 'https://gitcode.com/repo-a/issues/2',
	authorType: 'external' as const,
};

describe('Feishu notifier', () => {
	afterEach(() => jest.restoreAllMocks());

	it('builds a linked Feishu post payload', () => {
		const payload = buildFeishuNewIssuePayload([issue]);
		expect(payload.msg_type).toBe('post');
		expect(payload.content.post.zh_cn.title).toContain('1 个新增外部 Issue');
		expect(payload.content.post.zh_cn.content).toEqual(expect.arrayContaining([
			expect.arrayContaining([
				expect.objectContaining({tag: 'a', href: issue.webUrl}),
			]),
		]));
	});

	it('posts JSON to the configured webhook and rejects non-zero Feishu codes', async () => {
		const request = jest.spyOn(ObsidianModule, 'requestUrl').mockResolvedValue({
			status: 200,
			headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: {code: 0},
			text: '',
		});

		await sendFeishuNewIssueNotification(' https://example.test/hook ', [issue]);
		expect(request).toHaveBeenCalledWith(expect.objectContaining({
			url: 'https://example.test/hook',
			method: 'POST',
			contentType: 'application/json',
			body: expect.stringContaining('外部新增问题'),
			throw: false,
		}));

		request.mockResolvedValueOnce({
			status: 200,
			headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: {code: 19001},
			text: '',
		});
		await expect(sendFeishuNewIssueNotification('https://example.test/hook', [issue]))
			.rejects.toThrow('Feishu webhook rejected');
	});

	it('excludes internal Issues from Feishu batches and post content', () => {
		const payload = buildFeishuNewIssuePayload([
			{...issue, authorType: 'internal', title: '内部新增问题'},
			issue,
		]);

		expect(payload.content.post.zh_cn.title).toContain('1 个新增外部 Issue');
		expect(JSON.stringify(payload.content.post.zh_cn.content)).not.toContain('内部新增问题');
		expect(JSON.stringify(payload.content.post.zh_cn.content)).toContain('[外部 Issue]');
	});

	it('does not call the webhook when only internal Issues are passed', async () => {
		const request = jest.spyOn(ObsidianModule, 'requestUrl');

		await sendFeishuNewIssueNotification('https://example.test/hook', [
			{...issue, authorType: 'internal', title: '内部新增问题'},
		]);

		expect(request).not.toHaveBeenCalled();
	});

	it('splits delivery into batches whose individual Issue keys can be recorded after each webhook success', () => {
		const issues = Array.from({length: 11}, (_, index) => ({
			...issue,
			issueKey: `repo-a#${index + 1}`,
			iid: index + 1,
		}));

		expect(splitFeishuNewIssueBatches([
			{...issue, issueKey: 'repo-a#internal', authorType: 'internal'},
			...issues,
		]).map((batch) => batch.length)).toEqual([10, 1]);
	});
});

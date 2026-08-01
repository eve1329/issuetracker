import * as ObsidianModule from 'obsidian';
import {
	buildFeishuNewIssuePayload,
	sendFeishuNewIssueNotification,
} from '../../src/Notifications/feishu-notifier';

const issue = {
	issueKey: 'repo-a#2',
	sourceRepo: 'repo-a',
	iid: 2,
	title: '外部新增问题',
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
		expect(payload.content.post.zh_cn.title).toContain('1 个新增 Issue（内部 0 / 外部 1）');
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

	it('labels internal Issue authors in the post content and summary', () => {
		const payload = buildFeishuNewIssuePayload([
			{...issue, authorType: 'internal', title: '内部新增问题'},
			issue,
		]);

		expect(payload.content.post.zh_cn.title).toContain('内部 1 / 外部 1');
		expect(JSON.stringify(payload.content.post.zh_cn.content)).toContain('[内部 Issue]');
		expect(JSON.stringify(payload.content.post.zh_cn.content)).toContain('[外部 Issue]');
	});
});

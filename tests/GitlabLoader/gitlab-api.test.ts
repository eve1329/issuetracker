import {RequestUrlParam, RequestUrlResponse} from 'obsidian';
import * as ObsidianMock from 'obsidian';
import GitlabApi from "../../src/GitlabLoader/gitlab-api";

const mockRequestUrl = jest.spyOn(ObsidianMock, 'requestUrl');

describe('GitlabApi', () => {
	const mockUrl = 'https://gitcode.com/api/v5/issues';
	const mockToken = 'mock-token';
	const mockParams: RequestUrlParam = {
		url: mockUrl,
		headers: { 'PRIVATE-TOKEN': mockToken },
		throw: false,
	};

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should load data successfully', async () => {
		const mockData = [{ id: 1, title: 'Test Issue' }];
		const mockResponse= {
			status: 200,
			json: Promise.resolve(mockData),
			text: 'Success',
		};

		mockRequestUrl.mockResolvedValue(mockResponse as RequestUrlResponse);

		const result = await GitlabApi.load<typeof mockData>(mockUrl, mockToken);
		expect(mockRequestUrl).toHaveBeenCalledWith(mockParams);
		expect(result).toEqual(mockData);
	});

	it('should throw an error for non-200 response', async () => {
		const mockResponse = {
			status: 404,
			json: Promise.resolve(null),
			text: 'Not Found',
		};

		mockRequestUrl.mockResolvedValue(mockResponse as RequestUrlResponse);

		await expect(GitlabApi.load(mockUrl, mockToken)).rejects.toThrow('Not Found');
		expect(mockRequestUrl).toHaveBeenCalledWith(mockParams);
	});

	it('creates a GitCode comment as a form field and accepts the provider 201 response', async () => {
		mockRequestUrl.mockResolvedValue({
			status: 201,
			json: Promise.resolve({id: 42}),
			text: 'Created',
		} as RequestUrlResponse);

		await expect(GitlabApi.create(
			'https://gitcode.com/api/v5/repos/CPF-KMP-CMP/docs/issues/16/comments',
			mockToken,
			{body: '已收到'},
		)).resolves.toEqual({id: 42});
		expect(mockRequestUrl).toHaveBeenCalledWith({
			url: 'https://gitcode.com/api/v5/repos/CPF-KMP-CMP/docs/issues/16/comments',
			method: 'POST',
			contentType: 'application/x-www-form-urlencoded',
			headers: {
				'PRIVATE-TOKEN': mockToken,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: 'body=%E5%B7%B2%E6%94%B6%E5%88%B0',
			throw: false,
		});
	});

	it('keeps JSON request bodies for GitHub comment APIs', async () => {
		mockRequestUrl.mockResolvedValue({
			status: 201,
			json: Promise.resolve({id: 43}),
			text: 'Created',
		} as RequestUrlResponse);

		await expect(GitlabApi.create(
			'https://api.github.com/repos/CPF-KMP-CMP/docs/issues/16/comments',
			mockToken,
			{body: '已收到'},
		)).resolves.toEqual({id: 43});
		expect(mockRequestUrl).toHaveBeenCalledWith({
			url: 'https://api.github.com/repos/CPF-KMP-CMP/docs/issues/16/comments',
			method: 'POST',
			contentType: 'application/json',
			headers: {
				Authorization: `Bearer ${mockToken}`,
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({body: '已收到'}),
			throw: false,
		});
	});

	it('surfaces response text when the server rejects the request body with an auth message', async () => {
		const mockResponse = {
			status: 400,
			json: Promise.resolve({message: '403 Forbidden - Unauthorized access'}),
			text: '403 Forbidden - Unauthorized access',
		};

		mockRequestUrl.mockResolvedValue(mockResponse as RequestUrlResponse);

		await expect(GitlabApi.load(mockUrl, mockToken)).rejects.toThrow('403 Forbidden - Unauthorized access');
		expect(mockRequestUrl).toHaveBeenCalledWith(mockParams);
	});

	it('extracts the GitCode error_message field from a JSON error body', async () => {
		const mockResponse = {
			status: 400,
			json: Promise.resolve({
				error_code: 403,
				error_code_name: 'UN_KNOW',
				error_message: '403 Forbidden - Unauthorized access',
				trace_id: 'cb890ccc3602faa80d39d0afd3d7972d',
			}),
			text: '{"error_code":403,"error_code_name":"UN_KNOW","error_message":"403 Forbidden - Unauthorized access","trace_id":"cb890ccc3602faa80d39d0afd3d7972d"}',
		};

		mockRequestUrl.mockResolvedValue(mockResponse as RequestUrlResponse);

		await expect(GitlabApi.load(mockUrl, mockToken)).rejects.toThrow('403 Forbidden - Unauthorized access');
		expect(mockRequestUrl).toHaveBeenCalledWith(mockParams);
	});

	it('loads pages until a partial page is returned', async () => {
		const pageOne = Array.from({length: 100}, (_, index) => ({id: index + 1}));

		mockRequestUrl
			.mockResolvedValueOnce({
				status: 200,
				json: Promise.resolve(pageOne),
				text: '',
			} as RequestUrlResponse)
			.mockResolvedValueOnce({
				status: 200,
				json: Promise.resolve([{id: 101}]),
				text: '',
			} as RequestUrlResponse);

		const data = await GitlabApi.loadAllPages<{id: number}>(
			'https://gitcode.com/api/v5/repos/CPF-KMP-CMP/repo-a/issues',
			mockToken,
		);

		expect(data).toHaveLength(101);
		expect(data[0]).toEqual({id: 1});
		expect(data[100]).toEqual({id: 101});
		expect(mockRequestUrl).toHaveBeenCalledTimes(2);
		expect(mockRequestUrl).toHaveBeenNthCalledWith(1, {
			url: 'https://gitcode.com/api/v5/repos/CPF-KMP-CMP/repo-a/issues?per_page=100&page=1',
			headers: {'PRIVATE-TOKEN': mockToken},
			throw: false,
		});
		expect(mockRequestUrl).toHaveBeenNthCalledWith(2, {
			url: 'https://gitcode.com/api/v5/repos/CPF-KMP-CMP/repo-a/issues?per_page=100&page=2',
			headers: {'PRIVATE-TOKEN': mockToken},
			throw: false,
		});
	});

	it('loads pages until an empty page is returned after full pages', async () => {
		const pageOne = Array.from({length: 100}, (_, index) => ({id: index + 1}));
		const pageTwo = Array.from({length: 100}, (_, index) => ({id: index + 101}));

		mockRequestUrl
			.mockResolvedValueOnce({
				status: 200,
				json: Promise.resolve(pageOne),
				text: '',
			} as RequestUrlResponse)
			.mockResolvedValueOnce({
				status: 200,
				json: Promise.resolve(pageTwo),
				text: '',
			} as RequestUrlResponse)
			.mockResolvedValueOnce({
				status: 200,
				json: Promise.resolve([]),
				text: '',
			} as RequestUrlResponse);

		const data = await GitlabApi.loadAllPages<{id: number}>(
			'https://gitcode.com/api/v5/repos/CPF-KMP-CMP/repo-a/issues',
			mockToken,
		);

		expect(data).toHaveLength(200);
		expect(data[0]).toEqual({id: 1});
		expect(data[199]).toEqual({id: 200});
		expect(mockRequestUrl).toHaveBeenCalledTimes(3);
		expect(mockRequestUrl).toHaveBeenNthCalledWith(3, {
			url: 'https://gitcode.com/api/v5/repos/CPF-KMP-CMP/repo-a/issues?per_page=100&page=3',
			headers: {'PRIVATE-TOKEN': mockToken},
			throw: false,
		});
	});

	it('uses GitHub bearer headers for GitHub API requests', async () => {
		const mockResponse = {
			status: 200,
			json: Promise.resolve([]),
			text: 'Success',
		};

		mockRequestUrl.mockResolvedValue(mockResponse as RequestUrlResponse);

		await GitlabApi.load('https://api.github.com/repos/openai/codex/issues', mockToken);

		expect(mockRequestUrl).toHaveBeenCalledWith({
			url: 'https://api.github.com/repos/openai/codex/issues',
			headers: {
				Authorization: `Bearer ${mockToken}`,
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
			},
			throw: false,
		});
	});

	it('adds a gitee access_token query parameter for Gitee API requests', async () => {
		const mockResponse = {
			status: 200,
			json: Promise.resolve([]),
			text: 'Success',
		};

		mockRequestUrl.mockResolvedValue(mockResponse as RequestUrlResponse);

		await GitlabApi.load('https://gitee.com/api/v5/repos/openai/codex/issues', mockToken);

		expect(mockRequestUrl).toHaveBeenCalledWith({
			url: 'https://gitee.com/api/v5/repos/openai/codex/issues?access_token=mock-token',
			headers: {
				Authorization: `token ${mockToken}`,
			},
			throw: false,
		});
	});
});

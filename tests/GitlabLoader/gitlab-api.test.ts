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
		});
		expect(mockRequestUrl).toHaveBeenNthCalledWith(2, {
			url: 'https://gitcode.com/api/v5/repos/CPF-KMP-CMP/repo-a/issues?per_page=100&page=2',
			headers: {'PRIVATE-TOKEN': mockToken},
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
		});
	});
});

import {requestUrl, RequestUrlParam, RequestUrlResponse} from 'obsidian';

export default class GitlabApi {

	static load<T>(url: string, gitlabToken: string): Promise<T> {

		const headers = { 'PRIVATE-TOKEN': gitlabToken };

		const params: RequestUrlParam = { url: url, headers: headers };

		return requestUrl(params)
			.then((response: RequestUrlResponse) => {
				if (response.status !== 200) {
					throw new Error(response.text);
				}

				return response.json as Promise<T>;
			});
	}

	static async loadAllPages<T>(baseUrl: string, gitlabToken: string): Promise<T[]> {
		const result: T[] = [];
		let page = 1;

		while (true) {
			const separator = baseUrl.includes('?') ? '&' : '?';
			const pageUrl = `${baseUrl}${separator}per_page=100&page=${page}`;
			const pageData = await GitlabApi.load<T[]>(pageUrl, gitlabToken);

			if (pageData.length === 0) {
				break;
			}

			result.push(...pageData);

			if (pageData.length < 100) {
				break;
			}

			page += 1;
		}

		return result;
	}
}

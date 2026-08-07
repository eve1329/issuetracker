import {requestUrl, RequestUrlParam, RequestUrlResponse} from 'obsidian';
import {detectGitHost} from "../SettingsTab/settings";

export default class GitlabApi {

	static buildHeaders(url: string, gitlabToken: string): Record<string, string> {
		if (!gitlabToken) {
			return {};
		}

		const host = detectGitHost(url, url);

		switch (host) {
			case 'github':
				return {
					Authorization: `Bearer ${gitlabToken}`,
					Accept: 'application/vnd.github+json',
					'X-GitHub-Api-Version': '2022-11-28',
				};
			case 'gitee':
				return {
					Authorization: `token ${gitlabToken}`,
				};
			case 'gitlab':
			case 'gitcode':
			case 'unknown':
			default:
				return {'PRIVATE-TOKEN': gitlabToken};
		}
	}

	static appendTokenQueryIfNeeded(url: string, gitlabToken: string): string {
		if (!gitlabToken) {
			return url;
		}

		const host = detectGitHost(url, url);
		if (host !== 'gitee') {
			return url;
		}

		const parsed = new URL(url);
		if (!parsed.searchParams.has('access_token')) {
			parsed.searchParams.set('access_token', gitlabToken);
		}

		return parsed.toString();
	}

	static load<T>(url: string, gitlabToken: string): Promise<T> {
		const requestUrlString = GitlabApi.appendTokenQueryIfNeeded(url, gitlabToken);
		const headers = GitlabApi.buildHeaders(requestUrlString, gitlabToken);

		const params: RequestUrlParam = { url: requestUrlString, headers: headers, throw: false };

		return requestUrl(params)
			.then((response: RequestUrlResponse) => {
				if (response.status !== 200) {
					throw new Error(GitlabApi.extractErrorMessage(response.text));
				}

				return response.json as Promise<T>;
			});
	}

	static create<T>(url: string, gitlabToken: string, body: unknown): Promise<T> {
		const requestUrlString = GitlabApi.appendTokenQueryIfNeeded(url, gitlabToken);
		const requestBody = GitlabApi.buildCreateBody(requestUrlString, body);
		const headers = {
			...GitlabApi.buildHeaders(requestUrlString, gitlabToken),
			'Content-Type': requestBody.contentType,
		};
		const params: RequestUrlParam = {
			url: requestUrlString,
			method: 'POST',
			contentType: requestBody.contentType,
			headers,
			body: requestBody.body,
			throw: false,
		};

		return requestUrl(params)
			.then((response: RequestUrlResponse) => {
				if (response.status < 200 || response.status >= 300) {
					throw new Error(GitlabApi.extractErrorMessage(response.text));
				}

				return response.json as Promise<T>;
			});
	}

	private static buildCreateBody(url: string, body: unknown) {
		if (detectGitHost(url, url) === 'gitcode' && body && typeof body === 'object' && !Array.isArray(body)) {
			const form = new URLSearchParams();
			for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
				if (value !== undefined && value !== null) {
					form.set(key, String(value));
				}
			}

			return {
				contentType: 'application/x-www-form-urlencoded',
				body: form.toString(),
			};
		}

		return {
			contentType: 'application/json',
			body: JSON.stringify(body),
		};
	}

	static async loadAllPages<T>(baseUrl: string, gitlabToken: string): Promise<T[]> {
		const result: T[] = [];
		let page = 1;
		let hasNextPage = true;

		while (hasNextPage) {
			const separator = baseUrl.includes('?') ? '&' : '?';
			const pageUrl = `${baseUrl}${separator}per_page=100&page=${page}`;
			const pageData = await GitlabApi.load<T[]>(pageUrl, gitlabToken);

			result.push(...pageData);
			hasNextPage = pageData.length === 100;
			page += 1;
		}

		return result;
	}

	private static extractErrorMessage(responseText: string) {
		try {
			const parsed = JSON.parse(responseText);

			if (typeof parsed?.error_message === 'string' && parsed.error_message.trim().length > 0) {
				return parsed.error_message;
			}

			if (typeof parsed?.message === 'string' && parsed.message.trim().length > 0) {
				return parsed.message;
			}
		} catch (error) {
			// Ignore JSON parsing errors and fall back to the raw response text below.
		}

		return responseText;
	}
}

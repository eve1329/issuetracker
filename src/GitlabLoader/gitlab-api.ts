import {requestUrl, RequestUrlParam, RequestUrlResponse} from 'obsidian';
import {detectGitHost} from "../SettingsTab/settings";

export interface GitlabApiRateLimitConfig {
	/** Maximum number of requests started per minute across the plugin; <= 0 disables pacing. */
	requestsPerMinute: number;
	/** Extra attempts after an HTTP 429 (and, for reads only, 5xx) response. */
	maxRetries: number;
	/** First backoff delay used when the response carries no usable Retry-After header. */
	baseRetryDelayMs: number;
	/** Per-request timeout; a hung socket/proxy stall becomes a recoverable failure instead of freezing the sync. */
	requestTimeoutMs: number;
	sleep: (ms: number) => Promise<void>;
	now: () => number;
}

const DEFAULT_RATE_LIMIT_CONFIG: GitlabApiRateLimitConfig = {
	// GitCode allows 50 requests per user per minute; stay below it with margin so the
	// first-response comment backfill cannot burst into a 429 cascade that fails wholesale.
	requestsPerMinute: 40,
	maxRetries: 4,
	baseRetryDelayMs: 10_000,
	// Pacing leaves idle gaps between requests; through a local proxy those idle keep-alive
	// sockets can die silently and requestUrl never settles. A short timeout plus a retry
	// (fresh connection) turns that hang into a recoverable blip instead of a frozen sync.
	requestTimeoutMs: 15_000,
	sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
	now: () => Date.now(),
};

const MAX_RETRY_DELAY_MS = 120_000;
const TIMEOUT_RETRY_BASE_DELAY_MS = 2_000;
const MAX_TIMEOUT_RETRY_DELAY_MS = 30_000;

function isRequestTimeoutError(error: unknown): boolean {
	return error instanceof Error && error.message.startsWith('Request timed out after');
}
// A slot wait longer than this means the pacing chain ran away (should never happen with
// bounded concurrency); reset it instead of sleeping for tens of minutes.
const MAX_SLOT_WAIT_MS = 30_000;

export default class GitlabApi {
	private static rateLimitConfig: GitlabApiRateLimitConfig = {...DEFAULT_RATE_LIMIT_CONFIG};
	private static nextRequestSlotAt = 0;

	static configureRateLimit(config: Partial<GitlabApiRateLimitConfig>): void {
		GitlabApi.rateLimitConfig = {...GitlabApi.rateLimitConfig, ...config};
	}

	static restoreRateLimitDefaults(): void {
		GitlabApi.rateLimitConfig = {...DEFAULT_RATE_LIMIT_CONFIG};
		GitlabApi.nextRequestSlotAt = 0;
	}

	private static async acquireRateLimitSlot(): Promise<void> {
		const {requestsPerMinute, sleep, now} = GitlabApi.rateLimitConfig;
		if (requestsPerMinute <= 0) {
			return;
		}

		const minIntervalMs = 60_000 / requestsPerMinute;
		const nowMs = now();
		let slotAt = Math.max(nowMs, GitlabApi.nextRequestSlotAt);
		if (slotAt - nowMs > MAX_SLOT_WAIT_MS) {
			// Pacing chain ran away (bounded concurrency should never queue this deep);
			// reset it rather than freezing the sync for tens of minutes.
			slotAt = nowMs;
		}
		GitlabApi.nextRequestSlotAt = slotAt + minIntervalMs;
		if (slotAt > nowMs) {
			await sleep(slotAt - nowMs);
		}
	}

	private static requestWithTimeout(params: RequestUrlParam): Promise<RequestUrlResponse> {
		const timeoutMs = GitlabApi.rateLimitConfig.requestTimeoutMs;
		if (timeoutMs <= 0) {
			return requestUrl(params);
		}

		return new Promise<RequestUrlResponse>((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error(`Request timed out after ${timeoutMs}ms: ${params.url}`)),
				timeoutMs,
			);
			requestUrl(params).then(
				(response) => {
					clearTimeout(timer);
					resolve(response);
				},
				(error) => {
					clearTimeout(timer);
					reject(error);
				},
			);
		});
	}

	private static resolveRetryDelayMs(response: RequestUrlResponse, attempt: number): number {
		const headers: Record<string, string> = response.headers ?? {};
		const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
		const retryAfterSeconds = Number(retryAfter);
		if (retryAfter !== undefined && retryAfter !== '' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
			return Math.min(retryAfterSeconds * 1000, MAX_RETRY_DELAY_MS);
		}

		return Math.min(GitlabApi.rateLimitConfig.baseRetryDelayMs * 2 ** attempt, MAX_RETRY_DELAY_MS);
	}

	private static async performRequest(params: RequestUrlParam, retryOnServerError: boolean): Promise<RequestUrlResponse> {
		const {maxRetries, sleep} = GitlabApi.rateLimitConfig;
		let attempt = 0;
		for (;;) {
			await GitlabApi.acquireRateLimitSlot();
			let response: RequestUrlResponse;
			try {
				response = await GitlabApi.requestWithTimeout(params);
			} catch (error) {
				// A timed-out request never settled (e.g. a dead keep-alive socket behind a
				// local proxy); retry on a fresh connection before giving up.
				if (!isRequestTimeoutError(error) || attempt >= maxRetries) {
					throw error;
				}
				await sleep(Math.min(TIMEOUT_RETRY_BASE_DELAY_MS * 2 ** attempt, MAX_TIMEOUT_RETRY_DELAY_MS));
				attempt += 1;
				continue;
			}
			const rateLimited = response.status === 429;
			const serverError = retryOnServerError && response.status >= 500 && response.status <= 599;
			if ((!rateLimited && !serverError) || attempt >= maxRetries) {
				return response;
			}

			await sleep(GitlabApi.resolveRetryDelayMs(response, attempt));
			attempt += 1;
		}
	}

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

		return GitlabApi.performRequest(params, true)
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

		return GitlabApi.performRequest(params, false)
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

import {classifyIssue, matchInternalAuthor} from "../../src/Classification/classification";
import {DEFAULT_SETTINGS} from "../../src/SettingsTab/settings";

describe('matchInternalAuthor', () => {
	it('marks an internal author using the matched source', () => {
		const result = matchInternalAuthor('org_user', {
			usernames: {
				org_user: {username: 'org_user', source: 'org'},
			},
		});

		expect(result).toEqual({
			isInternalAuthor: true,
			internalMatchedBy: 'org',
		});
	});

	it('marks an external author as non-internal when not present in the index', () => {
		const result = matchInternalAuthor('outside_user', {
			usernames: {
				org_user: {username: 'org_user', source: 'org'},
			},
		});

		expect(result).toEqual({
			isInternalAuthor: false,
			internalMatchedBy: 'none',
		});
	});
});

describe('classifyIssue', () => {
	it('classifies GitCode docs titles as requirements using title keywords when no prefix or label exists', () => {
		const result = classifyIssue(
			{
				title: '添加侧边栏容器用户手册',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);

		expect(result).toEqual({
			requestKind: 'requirement',
			requestKindMatchedBy: 'title-keyword',
		});
	});

	it('prefers explicit title prefixes over title keywords', () => {
		const result = classifyIssue(
			{
				title: '[BUG] 添加安全区避让相关的窗口适配手册',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);

		expect(result).toEqual({
			requestKind: 'bug',
			requestKindMatchedBy: 'title-prefix',
		});
	});
});

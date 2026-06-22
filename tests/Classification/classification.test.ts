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

	it('classifies English feature wording and replacement wording as requirements', () => {
		const supportResult = classifyIssue(
			{
				title: 'feat: support multiple comma-separated native dependency repositories',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);
		const replaceResult = classifyIssue(
			{
				title: 'harmonyApp 改用 OHPM compose 包替换本地 compose.har 依赖',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);

		expect(supportResult).toEqual({
			requestKind: 'requirement',
			requestKindMatchedBy: 'title-keyword',
		});
		expect(replaceResult).toEqual({
			requestKind: 'requirement',
			requestKindMatchedBy: 'title-keyword',
		});
	});

	it('classifies bug wording and crash signatures as bugs', () => {
		const fixResult = classifyIssue(
			{
				title: 'fix: result collection failed on ohos device',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);
		const crashResult = classifyIssue(
			{
				title: '编译成功后，推包到手机闪退',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);
		const uafResult = classifyIssue(
			{
				title: 'fix: OHPainter thread_local 析构访问悬垂 fOHFilter 的 UAF',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);

		expect(fixResult).toEqual({
			requestKind: 'bug',
			requestKindMatchedBy: 'title-keyword',
		});
		expect(crashResult).toEqual({
			requestKind: 'bug',
			requestKindMatchedBy: 'title-keyword',
		});
		expect(uafResult).toEqual({
			requestKind: 'bug',
			requestKindMatchedBy: 'title-keyword',
		});
	});

	it('classifies remaining crash and fix-pattern titles as bugs', () => {
		const crashResult = classifyIssue(
			{
				title: '模块化拆分场景下 as String 转换崩溃',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);
		const scopedFixResult = classifyIssue(
			{
				title: '[0.2]fix(ohos): dispatch RenderNode finalizer to UI thread',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);
		const sizeRegressionResult = classifyIssue(
			{
				title: '用工具链的模板，使用./gradlew publishDebugBinariesToHarmonyApp命令编出来的包体积为55.8M，体积偏大',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);

		expect(crashResult).toEqual({
			requestKind: 'bug',
			requestKindMatchedBy: 'title-keyword',
		});
		expect(scopedFixResult).toEqual({
			requestKind: 'bug',
			requestKindMatchedBy: 'title-keyword',
		});
		expect(sizeRegressionResult).toEqual({
			requestKind: 'bug',
			requestKindMatchedBy: 'title-keyword',
		});
	});

	it('classifies remaining migration and implementation-plan titles as requirements', () => {
		const ksgResult = classifyIssue(
			{
				title: 'KSG 前移和codegen直接生成K2RStub调用',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);
		const architectureResult = classifyIssue(
			{
				title: 'Mutilayer并行录制:将 OHOS 专属编排下沉,使跨平台 scene 零侵入',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);
		const loggingResult = classifyIssue(
			{
				title: '模块化配置打印模块名称',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);
		const testScriptResult = classifyIssue(
			{
				title: '修改自动化测试脚本',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);

		expect(ksgResult).toEqual({
			requestKind: 'requirement',
			requestKindMatchedBy: 'title-keyword',
		});
		expect(architectureResult).toEqual({
			requestKind: 'requirement',
			requestKindMatchedBy: 'title-keyword',
		});
		expect(loggingResult).toEqual({
			requestKind: 'requirement',
			requestKindMatchedBy: 'title-keyword',
		});
		expect(testScriptResult).toEqual({
			requestKind: 'requirement',
			requestKindMatchedBy: 'title-keyword',
		});
	});

	it('prefers bug keywords over later requirement keywords when a title contains both', () => {
		const result = classifyIssue(
			{
				title: 'fix: support multiple comma-separated native dependency repositories',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);

		expect(result).toEqual({
			requestKind: 'bug',
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

	it('classifies feature-prefixed titles as requirements', () => {
		const result = classifyIssue(
			{
				title: '[feature]: modify ohosapp decorator&annotation dependency',
				labels: [],
			},
			DEFAULT_SETTINGS.classificationRules,
		);

		expect(result).toEqual({
			requestKind: 'requirement',
			requestKindMatchedBy: 'title-prefix',
		});
	});
});

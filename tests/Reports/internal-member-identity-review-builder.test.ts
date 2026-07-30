import {buildInternalMemberIdentityReview} from '../../src/Reports/internal-member-identity-review-builder';
import {NormalizedIssueNote} from '../../src/Issues/issue-note';

function makeIssue(overrides: Partial<NormalizedIssueNote> = {}): NormalizedIssueNote {
	return {
		id: 1,
		iid: 1,
		title: '普通问题',
		state: 'open',
		createdAt: '2026-07-27T09:00:00+08:00',
		updatedAt: '2026-07-27T10:00:00+08:00',
		webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/1',
		projectId: 1,
		projectPath: 'CPF-KMP-CMP/repo-a',
		sourceScope: 'project',
		sourceRepo: 'repo-a',
		authorUsername: 'partner_a',
		authorName: 'Partner A',
		isInternalAuthor: false,
		internalMatchedBy: 'none',
		firstResponseAt: '',
		firstResponseCheckedAt: '',
		labels: [],
		issueTypeRaw: 'issue',
		requestKind: 'unknown',
		requestKindMatchedBy: 'none',
		referencesFull: 'CPF-KMP-CMP/repo-a#1',
		...overrides,
	};
}

describe('buildInternalMemberIdentityReview', () => {
	it('lists title-evidence authors missing from the confirmed member directory', () => {
		const result = buildInternalMemberIdentityReview([
			makeIssue({
				iid: 1,
				title: '【需求】 已确认成员提交的工作项',
				authorUsername: 'KNOWN_MEMBER',
				authorName: '已确认成员',
			}),
			makeIssue({
				iid: 2,
				title: '【bug】 登录失败',
				authorUsername: 'Missing_A',
				authorName: '开发甲',
				webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/2',
			}),
			makeIssue({
				iid: 3,
				title: '门禁测试',
				authorUsername: 'missing_a',
				authorName: '开发甲',
				isInternalAuthor: true,
				internalMatchedBy: 'repo',
				webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/3',
			}),
			makeIssue({
				iid: 4,
				title: '只有协作者证据的普通问题',
				authorUsername: 'collaborator_only',
				isInternalAuthor: true,
				internalMatchedBy: 'repo',
			}),
			makeIssue({
				iid: 5,
				title: '【需求】 没有作者账号',
				authorUsername: '',
				authorName: '',
			}),
			makeIssue({
				iid: 6,
				title: '【需求】 范围外的旧 Issue',
				authorUsername: 'old_candidate',
				createdAt: '2026-04-30T23:59:59+08:00',
			}),
		], {
			internalMemberDirectory: {known_member: '已确认成员'},
			startMonth: '2026-05',
		});

		expect(result.directoryAccountCount).toBe(1);
		expect(result.eligibleIssueCount).toBe(5);
		expect(result.evidenceIssueCount).toBe(4);
		expect(result.candidates).toEqual([
			{
				username: 'missing_a',
				displayNames: ['开发甲'],
				issues: [
					expect.objectContaining({
						issueKey: 'CPF-KMP-CMP/repo-a#2',
						evidence: '【bug】',
						collaboratorEvidence: '',
					}),
					expect.objectContaining({
						issueKey: 'CPF-KMP-CMP/repo-a#3',
						evidence: '门禁测试',
						collaboratorEvidence: '协作者目录:repo',
					}),
				],
			},
		]);
		expect(result.markdown).toContain('# 内部人员名单收集待补全报告');
		expect(result.markdown).toContain('当前已确认内部成员目录：**1 个唯一账号**');
		expect(result.markdown).toContain('待补全账号：**1 个 / 2 条 Issue**');
		expect(result.markdown).toContain('`missing_a`');
		expect(result.markdown).toContain('为什么可能是内部人员：标题命中内部工作标记 `【bug】`、`门禁测试`');
		expect(result.markdown).toContain('[CPF-KMP-CMP/repo-a#2：【bug】 登录失败](<https://gitcode.com/CPF-KMP-CMP/repo-a/issues/2>)');
		expect(result.markdown).toContain('补充证据：协作者目录:repo');
		expect(result.markdown).not.toContain('known_member');
		expect(result.markdown).not.toContain('collaborator_only');
		expect(result.markdown).not.toContain('old_candidate');
		expect(result.markdown).not.toContain('不配合');
	});

	it('deduplicates Issue revisions by absolute update time across timezone offsets', () => {
		const result = buildInternalMemberIdentityReview([
			makeIssue({
				iid: 9,
				title: '普通问题的最新版本',
				authorUsername: 'candidate_a',
				updatedAt: '2026-06-30T17:00:00Z',
			}),
			makeIssue({
				iid: 9,
				title: '【需求】 旧版本标题',
				authorUsername: 'candidate_a',
				updatedAt: '2026-07-01T00:30:00+08:00',
			}),
		], {
			internalMemberDirectory: {},
		});

		expect(result.evidenceIssueCount).toBe(0);
		expect(result.candidates).toEqual([]);
	});

	it('retains closed internal-reference Issues as roster identity evidence', () => {
		const result = buildInternalMemberIdentityReview([
			makeIssue({
				iid: 16,
				title: 'IR002: 历史内部工作项',
				state: 'closed',
				authorUsername: 'zhangjuncheng8',
				authorName: 'Kyoma',
				projectPath: 'CPF-KMP-CMP/docs',
				sourceRepo: 'docs',
				webUrl: 'https://gitcode.com/CPF-KMP-CMP/docs/issues/16',
			}),
		], {
			internalMemberDirectory: {},
		});

		expect(result.candidates).toEqual([
			expect.objectContaining({
				username: 'zhangjuncheng8',
				issues: [expect.objectContaining({
					issueKey: 'CPF-KMP-CMP/docs#16',
					state: 'closed',
					evidence: 'IR002',
				})],
			}),
		]);
		expect(result.markdown).toContain('已关闭 Issue 不进入首次台账，但会保留为内部身份判定证据');
	});
});

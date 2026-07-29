import {
	buildIssueLedger,
	IssueLedgerSerialState,
} from '../../src/Reports/issue-ledger-builder';
import {NormalizedIssueNote} from '../../src/Issues/issue-note';

function makeIssue(overrides: Partial<NormalizedIssueNote> = {}): NormalizedIssueNote {
	return {
		id: 1,
		iid: 1,
		title: '普通外部问题',
		state: 'open',
		createdAt: '2026-07-27T09:00:00+08:00',
		updatedAt: '2026-07-27T09:00:00+08:00',
		webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/1',
		projectId: 1,
		projectPath: 'CPF-KMP-CMP/repo-a',
		sourceScope: 'project',
		sourceRepo: 'repo-a',
		authorUsername: 'partner_a',
		authorName: 'Partner A',
		isInternalAuthor: false,
		internalMatchedBy: 'none',
		labels: [],
		issueTypeRaw: 'issue',
		requestKind: 'unknown',
		requestKindMatchedBy: 'none',
		referencesFull: 'CPF-KMP-CMP/repo-a#1',
		...overrides,
	};
}

describe('buildIssueLedger', () => {
	it('ignores historical closed issues before they have been tracked', () => {
		const result = buildIssueLedger(
			[
				makeIssue({
					iid: 7,
					title: '白名单人员问题',
					authorUsername: 'Dev_A',
					authorName: 'GitCode Dev',
					state: 'closed',
					webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/7',
				}),
				makeIssue({
					iid: 8,
					title: 'IR001 编号问题',
					authorUsername: 'not-listed',
					authorName: 'Internal Reporter',
					requestKind: 'requirement',
					webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/8',
				}),
				makeIssue({
					iid: 9,
					title: '外部伙伴提交的问题',
					authorUsername: 'partner_a',
					webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/9',
				}),
			],
			{
				internalMemberDirectory: {
					dev_a: '开发甲',
				},
				internalUserWhitelist: [],
				internalReferencePrefixes: ['IR', 'SR'],
			},
			null,
		);

		expect(result.rows).toEqual([
				expect.objectContaining({
					serial: 1,
					issueKey: 'CPF-KMP-CMP/repo-a#8',
					category: '需求',
					name: 'Internal Reporter',
					personnelType: '内部',
					evidence: 'IR001',
			}),
			expect.objectContaining({
				serial: 2,
				issueKey: 'CPF-KMP-CMP/repo-a#9',
				personnelType: '外部伙伴',
				evidence: '外部账号',
			}),
		]);
		expect(result.serialState).toEqual({
			nextSerial: 3,
			serialByIssueKey: {
				'CPF-KMP-CMP/repo-a#8': 1,
				'CPF-KMP-CMP/repo-a#9': 2,
			},
		});
		expect(result.csv).toContain('序号,问题,链接,响应人/责任人,分类,状态,Issue来源方,code账号,姓名,公司部门,创建时间,首次相应时间,首次相应时长格式');
		expect(result.csv).not.toContain('白名单人员问题');
		expect(result.csv).toContain('1,IR001 编号问题,https://gitcode.com/CPF-KMP-CMP/repo-a/issues/8,,需求,open,内部,not-listed,Internal Reporter,,2026/7/27 09:00:00,,');
	});

	it('starts tracking from the configured month and resets serials when the month changes', () => {
		const result = buildIssueLedger(
			[
				makeIssue({iid: 1, createdAt: '2026-04-30T23:59:59+08:00'}),
				makeIssue({iid: 2, createdAt: '2026-05-01T00:00:00+08:00'}),
			],
			{internalMemberDirectory: {}, internalUserWhitelist: [], startMonth: '2026-05'},
			{
				nextSerial: 15,
				serialByIssueKey: {
					'CPF-KMP-CMP/repo-a#1': 13,
					'CPF-KMP-CMP/repo-a#2': 14,
				},
				startMonth: '2026-04',
			},
		);

		expect(result.rows).toEqual([
			expect.objectContaining({serial: 1, issueKey: 'CPF-KMP-CMP/repo-a#2'}),
		]);
		expect(result.serialState).toEqual({
			nextSerial: 2,
			serialByIssueKey: {'CPF-KMP-CMP/repo-a#2': 1},
			startMonth: '2026-05',
		});
	});

	it('formats creation time in China Standard Time', () => {
		const result = buildIssueLedger(
			[makeIssue({createdAt: '2026-05-25T06:58:00Z'})],
			{internalMemberDirectory: {}, internalUserWhitelist: []},
			null,
		);

		expect(result.rows[0].createdAt).toBe('2026/5/25 14:58:00');
	});

	it('marks a tracked open issue when it later closes', () => {
		const result = buildIssueLedger(
			[makeIssue({iid: 7, state: 'closed'})],
			{internalMemberDirectory: {}, internalUserWhitelist: []},
			{
				nextSerial: 2,
				serialByIssueKey: {'CPF-KMP-CMP/repo-a#7': 1},
			},
		);

		expect(result.rows).toEqual([
			expect.objectContaining({serial: 1, state: 'closed'}),
		]);
		expect(result.serialState).toEqual({
			nextSerial: 2,
			serialByIssueKey: {'CPF-KMP-CMP/repo-a#7': 1},
		});
	});

	it('filters the GitLab opened state as visible', () => {
		const result = buildIssueLedger(
			[makeIssue({state: 'opened'})],
			{internalMemberDirectory: {}, internalUserWhitelist: []},
			null,
		);

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].state).toBe('opened');
	});

	it('uses internal workflow markers even when the author account is available', () => {
		const markers = ['【fix】', '【bug】', '【门禁测试】', '门禁测试', '【release】', '【next】', '【需求】'];
		const result = buildIssueLedger(
			markers.map((marker, index) => makeIssue({
				iid: index + 1,
				title: `${marker} 内部工作项`,
				authorUsername: `internal_candidate_${index + 1}`,
				authorName: `内部候选人 ${index + 1}`,
				webUrl: `https://gitcode.com/CPF-KMP-CMP/repo-a/issues/${index + 1}`,
			})),
			{internalMemberDirectory: {}, internalUserWhitelist: []},
			null,
		);

		expect(result.rows.map((row) => ({
			personnelType: row.personnelType,
			evidence: row.evidence,
		}))).toEqual(markers.map((marker) => ({
			personnelType: '内部',
			evidence: marker,
		})));
	});

	it('keeps an unmarked account external when there is no internal evidence', () => {
		const result = buildIssueLedger(
			[makeIssue({title: '外部伙伴提交的问题', authorUsername: 'external_partner'})],
			{internalMemberDirectory: {}, internalUserWhitelist: []},
			null,
		);

		expect(result.rows[0]).toEqual(expect.objectContaining({
			personnelType: '外部伙伴',
			evidence: '外部账号',
		}));
	});

	it('leaves the name blank for an external account that is absent from the member directory', () => {
		const result = buildIssueLedger(
			[makeIssue({authorUsername: 'cylde', authorName: '哎呀'})],
			{internalMemberDirectory: {}, internalUserWhitelist: []},
			null,
		);

		expect(result.rows[0]).toEqual(expect.objectContaining({
			username: 'cylde',
			name: '',
			personnelType: '外部伙伴',
			evidence: '外部账号',
		}));
		expect(result.csv).toContain('外部伙伴,cylde,,,');
		expect(result.csv).not.toContain('哎呀');
	});

	it('keeps a confirmed internal author internal before evaluating title markers', () => {
		const result = buildIssueLedger(
			[makeIssue({
				title: '【fix】 内部工作项',
				authorUsername: 'member_a',
				isInternalAuthor: true,
				internalMatchedBy: 'repo',
			})],
			{internalMemberDirectory: {}, internalUserWhitelist: []},
			null,
		);

		expect(result.rows[0]).toEqual(expect.objectContaining({
			name: 'Partner A',
			personnelType: '内部',
			evidence: '协作者目录:repo',
		}));
	});

	it('does not classify an embedded prefix as internal and escapes CSV fields', () => {
		const result = buildIssueLedger(
			[
				makeIssue({
					iid: 2,
					title: 'BIR123 is not an internal reference, "quoted"',
					authorUsername: 'external',
				}),
			],
			{internalMemberDirectory: {}, internalUserWhitelist: []},
			null,
		);

		expect(result.rows[0]).toEqual(expect.objectContaining({
			personnelType: '外部伙伴',
			evidence: '外部账号',
		}));
		expect(result.csv).toContain('1,"BIR123 is not an internal reference, ""quoted"""');
	});
});

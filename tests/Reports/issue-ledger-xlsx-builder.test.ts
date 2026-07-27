import {buildIssueLedgerXlsx} from '../../src/Reports/issue-ledger-xlsx-builder';
import {IssueLedgerRow} from '../../src/Reports/issue-ledger-builder';

function makeRow(overrides: Partial<IssueLedgerRow> = {}): IssueLedgerRow {
	return {
		serial: 1,
		issueKey: 'CPF-KMP-CMP/repo-a#1',
		title: 'Issue with <XML> characters',
		url: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/1?from=ledger&view=detail',
		responsible: '',
		category: '缺陷',
		state: 'open',
		createdAt: '2026/5/25 14:58:00',
		username: 'partner_a',
		name: 'Partner A',
		personnelType: '外部伙伴',
		department: '',
		firstResponseAt: '',
		firstResponseDuration: '',
		evidence: '未命中白名单或内部编号',
		...overrides,
	};
}

describe('buildIssueLedgerXlsx', () => {
	it('creates a native hyperlink relationship instead of a spreadsheet formula', () => {
		const text = new TextDecoder().decode(buildIssueLedgerXlsx([makeRow()]));

		expect(text).toContain('Issue Ledger');
		expect(text).toContain('repo-a #1');
		expect(text).not.toContain('打开 Issue');
		expect(text).toContain('<hyperlink ref="C2" r:id="rId1"/>');
		expect(text).toContain('Target="https://gitcode.com/CPF-KMP-CMP/repo-a/issues/1?from=ledger&amp;view=detail"');
		expect(text).toContain('Issue with &lt;XML&gt; characters');
		expect(text).not.toContain('HYPERLINK(');
	});

	it('omits a hyperlink relationship for blank issue URLs', () => {
		const text = new TextDecoder().decode(buildIssueLedgerXlsx([makeRow({url: ''})]));

		expect(text).not.toContain('<hyperlink ref="C2"');
		expect(text).toContain('<t></t>');
	});
});

import {ISSUE_LEDGER_HEADERS, IssueLedgerRow} from './issue-ledger-builder';

interface ZipEntry {
	name: string;
	data: Uint8Array;
}

const encoder = new TextEncoder();
const crcTable = createCrcTable();

export function buildIssueLedgerXlsx(rows: IssueLedgerRow[]) {
	const hyperlinks = rows
		.map((row, index) => ({cellRef: `C${index + 2}`, target: row.url.trim()}))
		.filter((hyperlink) => hyperlink.target.length > 0);

	return createStoredZip([
		{ name: '[Content_Types].xml', data: encode(buildContentTypesXml()) },
		{ name: '_rels/.rels', data: encode(buildRootRelationshipsXml()) },
		{ name: 'docProps/app.xml', data: encode(buildAppPropertiesXml()) },
		{ name: 'docProps/core.xml', data: encode(buildCorePropertiesXml()) },
		{ name: 'xl/workbook.xml', data: encode(buildWorkbookXml()) },
		{ name: 'xl/_rels/workbook.xml.rels', data: encode(buildWorkbookRelationshipsXml()) },
		{ name: 'xl/styles.xml', data: encode(buildStylesXml()) },
		{ name: 'xl/worksheets/sheet1.xml', data: encode(buildWorksheetXml(rows, hyperlinks)) },
		{ name: 'xl/worksheets/_rels/sheet1.xml.rels', data: encode(buildSheetRelationshipsXml(hyperlinks)) },
	]);
}

function buildContentTypesXml() {
	return xmlDocument(`
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
}

function buildRootRelationshipsXml() {
	return xmlDocument(`
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
}

function buildAppPropertiesXml() {
	return xmlDocument(`
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>IssueTracker</Application>
</Properties>`);
}

function buildCorePropertiesXml() {
	return xmlDocument(`
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>IssueTracker</dc:creator>
  <dc:title>GitCode Issue Ledger</dc:title>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:created>
</cp:coreProperties>`);
}

function buildWorkbookXml() {
	return xmlDocument(`
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView/></bookViews>
  <sheets><sheet name="Issue Ledger" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
}

function buildWorkbookRelationshipsXml() {
	return xmlDocument(`
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
}

function buildStylesXml() {
	return xmlDocument(`
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><color theme="1"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD9E2F3"/></left><right style="thin"><color rgb="FFD9E2F3"/></right><top style="thin"><color rgb="FFD9E2F3"/></top><bottom style="thin"><color rgb="FFD9E2F3"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`);
}

function buildWorksheetXml(rows: IssueLedgerRow[], hyperlinks: Array<{cellRef: string; target: string}>) {
	const columnWidths = [8, 42, 16, 18, 10, 10, 15, 18, 16, 18, 21, 21, 21];
	const columns = columnWidths
		.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
		.join('');
	const headerRow = `<row r="1" ht="28" customHeight="1">${ISSUE_LEDGER_HEADERS
		.map((header, index) => buildInlineStringCell(toCellReference(index + 1, 1), header, 1))
		.join('')}</row>`;
	const dataRows = rows.map((row, index) => {
		const rowNumber = index + 2;
		const values = [
			String(row.serial),
			row.title,
			row.url.trim() ? formatIssueLinkLabel(row.issueKey) : '',
			row.responsible,
			row.category,
			row.state,
			row.personnelType,
			row.username,
			row.name,
			row.department,
			row.createdAt,
			row.firstResponseAt,
			row.firstResponseDuration,
		];
		return `<row r="${rowNumber}" ht="30" customHeight="1">${values
			.map((value, columnIndex) => buildInlineStringCell(
				toCellReference(columnIndex + 1, rowNumber),
				value,
				columnIndex === 2 && row.url.trim() ? 2 : 3,
			))
			.join('')}</row>`;
	}).join('');
	const hyperlinkXml = hyperlinks.length > 0
		? `<hyperlinks>${hyperlinks.map((hyperlink, index) => `<hyperlink ref="${hyperlink.cellRef}" r:id="rId${index + 1}"/>`).join('')}</hyperlinks>`
		: '';

	return xmlDocument(`
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${columns}</cols>
  <sheetData>${headerRow}${dataRows}</sheetData>
  <autoFilter ref="A1:M${Math.max(rows.length + 1, 1)}"/>
  ${hyperlinkXml}
  <pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
</worksheet>`);
}

function buildSheetRelationshipsXml(hyperlinks: Array<{cellRef: string; target: string}>) {
	const relationships = hyperlinks
		.map((hyperlink, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(hyperlink.target)}" TargetMode="External"/>`)
		.join('');
	return xmlDocument(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`);
}

function formatIssueLinkLabel(issueKey: string) {
	const [projectPath, issueNumber] = issueKey.trim().split('#', 2);
	const repository = projectPath.split('/').filter(Boolean).pop();

	if (repository && issueNumber?.trim()) {
		return `${repository} #${issueNumber.trim()}`;
	}

	return issueKey.trim() || '打开 Issue';
}

function buildInlineStringCell(reference: string, value: string, styleIndex: number) {
	const preserveWhitespace = /^\s|\s$|\n/.test(value) ? ' xml:space="preserve"' : '';
	return `<c r="${reference}" s="${styleIndex}" t="inlineStr"><is><t${preserveWhitespace}>${escapeXml(value)}</t></is></c>`;
}

function toCellReference(column: number, row: number) {
	let value = column;
	let letters = '';
	while (value > 0) {
		const remainder = (value - 1) % 26;
		letters = String.fromCharCode(65 + remainder) + letters;
		value = Math.floor((value - 1) / 26);
	}
	return `${letters}${row}`;
}

function xmlDocument(content: string) {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${content.trim()}`;
}

function escapeXml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function encode(value: string) {
	return encoder.encode(value);
}

function createStoredZip(entries: ZipEntry[]) {
	const localEntries: Uint8Array[] = [];
	const centralDirectory: Uint8Array[] = [];
	let localOffset = 0;

	for (const entry of entries) {
		const name = encode(entry.name);
		const checksum = crc32(entry.data);
		const localHeader = concatBytes([
			uint32(0x04034b50), uint16(20), uint16(0x0800), uint16(0), uint16(0), uint16(0),
			uint32(checksum), uint32(entry.data.length), uint32(entry.data.length), uint16(name.length), uint16(0), name,
		]);
		localEntries.push(localHeader, entry.data);
		centralDirectory.push(concatBytes([
			uint32(0x02014b50), uint16(20), uint16(20), uint16(0x0800), uint16(0), uint16(0), uint16(0),
			uint32(checksum), uint32(entry.data.length), uint32(entry.data.length), uint16(name.length), uint16(0), uint16(0),
			uint16(0), uint16(0), uint32(0), uint32(localOffset), name,
		]));
		localOffset += localHeader.length + entry.data.length;
	}

	const centralDirectoryBytes = concatBytes(centralDirectory);
	const endOfCentralDirectory = concatBytes([
		uint32(0x06054b50), uint16(0), uint16(0), uint16(entries.length), uint16(entries.length),
		uint32(centralDirectoryBytes.length), uint32(localOffset), uint16(0),
	]);
	return concatBytes([...localEntries, centralDirectoryBytes, endOfCentralDirectory]);
}

function crc32(bytes: Uint8Array) {
	let checksum = 0xffffffff;
	for (const byte of bytes) {
		checksum = crcTable[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
	}
	return (checksum ^ 0xffffffff) >>> 0;
}

function createCrcTable() {
	const table: number[] = [];
	for (let index = 0; index < 256; index += 1) {
		let value = index;
		for (let bit = 0; bit < 8; bit += 1) {
			value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
		}
		table.push(value >>> 0);
	}
	return table;
}

function uint16(value: number) {
	const bytes = new Uint8Array(2);
	new DataView(bytes.buffer).setUint16(0, value, true);
	return bytes;
}

function uint32(value: number) {
	const bytes = new Uint8Array(4);
	new DataView(bytes.buffer).setUint32(0, value, true);
	return bytes;
}

function concatBytes(parts: Uint8Array[]) {
	const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		bytes.set(part, offset);
		offset += part.length;
	}
	return bytes;
}

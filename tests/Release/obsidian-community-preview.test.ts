import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../..');

function readWorkspaceFile(relativePath: string) {
	return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function compareSemver(left: string, right: string) {
	const leftParts = left.split('.').map(Number);
	const rightParts = right.split('.').map(Number);

	for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
		const leftPart = leftParts[index] ?? 0;
		const rightPart = rightParts[index] ?? 0;

		if (leftPart !== rightPart) {
			return leftPart - rightPart;
		}
	}

	return 0;
}

describe('Obsidian Community preview blockers', () => {
	it('keeps the manifest description free of Obsidian branding', () => {
		const manifest = JSON.parse(readWorkspaceFile('manifest.json')) as {description: string};

		expect(manifest.description).not.toMatch(/\bObsidian\b/i);
	});

	it('uses absolute README language-switch links so Community does not resolve them under /plugins/', () => {
		const englishReadme = readWorkspaceFile('README.md');
		const chineseReadme = readWorkspaceFile('README.zh-CN.md');
		const englishLink = englishReadme.match(/\[中文\]\(([^)]+)\)/)?.[1];
		const chineseLink = chineseReadme.match(/\[English\]\(([^)]+)\)/)?.[1];

		expect(englishLink).toMatch(/^https?:\/\//);
		expect(chineseLink).toMatch(/^https?:\/\//);
	});

	it('uses Setting headings instead of manually creating h2/h3 tags', () => {
		const settingsTabSource = readWorkspaceFile('src/SettingsTab/settings-tab.ts');
		const headingMatches = settingsTabSource.match(/\.setHeading\(\)/g) ?? [];

		expect(settingsTabSource).not.toMatch(/createEl\(\s*['"]h[23]['"]/i);
		expect(headingMatches.length).toBeGreaterThanOrEqual(2);
	});

	it('declares the required minAppVersion for the settings-tab APIs used in the source', () => {
		const manifest = JSON.parse(readWorkspaceFile('manifest.json')) as {minAppVersion: string};
		const settingsTabSource = readWorkspaceFile('src/SettingsTab/settings-tab.ts');
		const mainSource = readWorkspaceFile('src/main.ts');
		const filesystemSource = readWorkspaceFile('src/filesystem.ts');

		expect(settingsTabSource).toMatch(/\.setName\(/);
		expect(compareSemver(manifest.minAppVersion, '0.12.16')).toBeGreaterThanOrEqual(0);
		expect(mainSource).not.toMatch(/\bregisterInterval\s*\(/);
		expect(filesystemSource).not.toMatch(/\.createFolder\s*\(/);
	});
});

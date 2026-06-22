import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../..');

function readWorkspaceFile(relativePath: string) {
	return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('Obsidian Community preview blockers', () => {
	it('keeps the manifest description free of Obsidian branding', () => {
		const manifest = JSON.parse(readWorkspaceFile('manifest.json')) as {description: string};

		expect(manifest.description).not.toMatch(/\bObsidian\b/i);
	});

	it('uses Setting headings instead of manually creating h2/h3 tags', () => {
		const settingsTabSource = readWorkspaceFile('src/SettingsTab/settings-tab.ts');
		const headingMatches = settingsTabSource.match(/\.setHeading\(\)/g) ?? [];

		expect(settingsTabSource).not.toMatch(/createEl\(\s*['"]h[23]['"]/i);
		expect(headingMatches.length).toBeGreaterThanOrEqual(2);
	});

	it('preserves the declared 0.12.0 compatibility by avoiding newer APIs', () => {
		const manifest = JSON.parse(readWorkspaceFile('manifest.json')) as {minAppVersion: string};
		const mainSource = readWorkspaceFile('src/main.ts');
		const filesystemSource = readWorkspaceFile('src/filesystem.ts');

		expect(manifest.minAppVersion).toBe('0.12.0');
		expect(mainSource).not.toMatch(/\bregisterInterval\s*\(/);
		expect(filesystemSource).not.toMatch(/\.createFolder\s*\(/);
	});
});

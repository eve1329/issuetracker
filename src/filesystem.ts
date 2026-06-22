import {Vault, TFile, TAbstractFile, TFolder, parseYaml} from "obsidian";
import { compile } from 'handlebars';
import {ObsidianIssue} from "./GitlabLoader/issue-types";
import {GitlabIssuesSettings} from "./SettingsTab/settings-types";
import {buildIssueNoteMarkdown, NormalizedIssueNote} from "./Issues/issue-note";
import {DEFAULT_TEMPLATE, logger} from "./utils/utils";

export default class Filesystem {

	private vault: Vault;

	private settings: GitlabIssuesSettings;

	constructor(vault: Vault, settings: GitlabIssuesSettings) {
		this.vault = vault;
		this.settings = settings;
	}

	public createOutputDirectory() {
		void this.ensureFolders([this.settings.outputDir])
			.catch(() => logger('Could not create output directory'));
	}

	public async ensureFolders(paths: string[]) {
		const uniquePaths = Array.from(new Set(
			paths.flatMap((path) => this.expandFolderPath(path)),
		));

		for (const path of uniquePaths) {
			await this.createFolderIfMissing(path);
		}
	}

	public async upsertTextFile(path: string, content: string) {
		const existingFile = this.vault.getAbstractFileByPath(path);

		if (existingFile instanceof TFile) {
			await this.vault.modify(existingFile, content);
			return;
		}

		await this.vault.create(path, content);
	}

	public async writeJson(path: string, value: unknown) {
		const content = JSON.stringify(value, null, 2) ?? 'null';

		await this.upsertTextFile(path, `${content}\n`);
	}

	public async readJson<T>(path: string): Promise<T | null> {
		const existingFile = this.vault.getAbstractFileByPath(path);

		if (!(existingFile instanceof TFile)) {
			return null;
		}

		try {
			return JSON.parse(await this.vault.cachedRead(existingFile)) as T;
		} catch (error) {
			logger(error instanceof Error ? error.message : String(error));
			return null;
		}
	}

	public async writeIssueNotes(notes: NormalizedIssueNote[]) {
		const failures: Array<{path: string; message: string}> = [];

		for (const note of notes) {
			const path = `${this.settings.issuesFolder}/${this.buildIssueNoteFileName(note)}.md`;

			try {
				await this.upsertTextFile(path, buildIssueNoteMarkdown(note));
			} catch (error) {
				failures.push({
					path,
					message: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return failures;
	}

	public async readIssueNotes(): Promise<NormalizedIssueNote[]> {
		const issueFolder = this.vault.getAbstractFileByPath(this.settings.issuesFolder);

		if (!(issueFolder instanceof TFolder)) {
			return [];
		}

		const noteFiles: TFile[] = [];
		Vault.recurseChildren(issueFolder, (existingFile: TAbstractFile) => {
			if (existingFile instanceof TFile && existingFile.extension === 'md') {
				noteFiles.push(existingFile);
			}
		});

		const noteResults = await Promise.all(noteFiles.map(async (file) => this.readIssueNote(file)));

		return noteResults.filter((note): note is NormalizedIssueNote => note !== null);
	}

	public async listMarkdownFileBasenames(folderPath: string): Promise<string[]> {
		const folder = this.vault.getAbstractFileByPath(folderPath);

		if (!(folder instanceof TFolder)) {
			return [];
		}

		const basenames: string[] = [];
		Vault.recurseChildren(folder, (existingFile: TAbstractFile) => {
			if (existingFile instanceof TFile && existingFile.extension === 'md') {
				basenames.push(existingFile.basename);
			}
		});

		return basenames;
	}

	public async purgeIssueNotes(repoNames?: string[]) {
		const issueFolder = this.vault.getAbstractFileByPath(this.settings.issuesFolder);

		if (!(issueFolder instanceof TFolder)) {
			return;
		}

		const repoNameSet = repoNames ? new Set(repoNames) : null;
		const filesToDelete: TFile[] = [];
		Vault.recurseChildren(issueFolder, (existingFile: TAbstractFile) => {
			if (existingFile instanceof TFile && existingFile.extension === 'md') {
				filesToDelete.push(existingFile);
			}
		});

		for (const file of filesToDelete) {
			if (!repoNameSet) {
				await this.vault.delete(file);
				continue;
			}

			const note = await this.readIssueNote(file);
			if (note && repoNameSet.has(note.sourceRepo)) {
				await this.vault.delete(file);
			}
		}
	}

	public purgeExistingIssues() {
		const outputDir: TAbstractFile|null = this.vault.getAbstractFileByPath(this.settings.outputDir);

		if (outputDir instanceof TFolder) {
			Vault.recurseChildren(outputDir, (existingFile: TAbstractFile) => {
				if (existingFile instanceof TFile) {
					this.vault.delete(existingFile)
						.catch(error => logger(error.message));
				}
			});
		}
	}

	public processIssues(issues: Array<ObsidianIssue>)
	{
		this.vault.adapter.read(this.settings.templateFile)
			.then((rawTemplate: string) => {
				issues.map(
					(issue: ObsidianIssue) => this.writeFile(issue, compile(rawTemplate))
				);
			})
			.catch((error) => {
				issues.map(
					(issue: ObsidianIssue) => this.writeFile(issue, compile(DEFAULT_TEMPLATE.toString()))
				);
			})
		;
	}

	private writeFile(issue: ObsidianIssue, template: HandlebarsTemplateDelegate)
	{
		this.vault.create(this.buildFileName(issue), template(issue))
			.catch((error) => logger(error.message))
		;
	}

	private buildFileName(issue: ObsidianIssue): string
	{
		return this.settings.outputDir + '/' + issue.filename + '.md';
	}

	private async createFolderIfMissing(path: string) {
		try {
			await this.vault.createFolder(path);
		} catch (error) {
			if (error.message !== 'Folder already exists.') {
				throw error;
			}
		}
	}

	private expandFolderPath(path: string) {
		const normalizedPath = path.replace(/\/+$/, '');
		const prefix = normalizedPath.startsWith('/') ? '/' : '';
		const pathSegments = normalizedPath.split('/').filter(Boolean);

		return pathSegments.map((_, index) => `${prefix}${pathSegments.slice(0, index + 1).join('/')}`);
	}

	private buildIssueNoteFileName(note: NormalizedIssueNote) {
		const pathSegments = note.projectPath.split('/').filter(Boolean);
		const repoName = pathSegments[pathSegments.length - 1] || note.sourceRepo;
		const orgName = pathSegments.slice(0, -1).join('/');

		return [
			this.encodePathSegment(orgName),
			this.encodePathSegment(repoName),
			String(note.iid),
		].join('__');
	}

	private encodePathSegment(value: string) {
		return value
			.split('/')
			.filter(Boolean)
			.map((segment) => encodeURIComponent(segment))
			.join('%2F');
	}

	private async readIssueNote(file: TFile): Promise<NormalizedIssueNote | null> {
		try {
			const content = await this.vault.cachedRead(file);
			const frontmatter = this.extractFrontmatter(content);

			if (!frontmatter) {
				return null;
			}

			return {
				id: Number(frontmatter.id),
				iid: Number(frontmatter.iid),
				title: String(frontmatter.title ?? ''),
				state: String(frontmatter.state ?? ''),
				createdAt: String(frontmatter.createdAt ?? ''),
				updatedAt: String(frontmatter.updatedAt ?? ''),
				webUrl: String(frontmatter.webUrl ?? ''),
				projectId: Number(frontmatter.projectId),
				projectPath: String(frontmatter.projectPath ?? ''),
				sourceScope: String(frontmatter.sourceScope ?? 'project') as NormalizedIssueNote['sourceScope'],
				sourceRepo: String(frontmatter.sourceRepo ?? ''),
				authorUsername: String(frontmatter.authorUsername ?? ''),
				authorName: String(frontmatter.authorName ?? ''),
				isInternalAuthor: Boolean(frontmatter.isInternalAuthor),
				internalMatchedBy: String(frontmatter.internalMatchedBy ?? 'none') as NormalizedIssueNote['internalMatchedBy'],
				labels: Array.isArray(frontmatter.labels) ? frontmatter.labels.map((label: unknown) => String(label)) : [],
				issueTypeRaw: String(frontmatter.issueTypeRaw ?? ''),
				requestKind: String(frontmatter.requestKind ?? 'unknown') as NormalizedIssueNote['requestKind'],
				requestKindMatchedBy: String(frontmatter.requestKindMatchedBy ?? 'none') as NormalizedIssueNote['requestKindMatchedBy'],
				referencesFull: String(frontmatter.referencesFull ?? ''),
			};
		} catch (error) {
			logger(error instanceof Error ? error.message : String(error));
			return null;
		}
	}

	private extractFrontmatter(content: string) {
		const match = content.match(/^---\n([\s\S]*?)\n---/);

		if (!match) {
			return null;
		}

		return parseYaml(match[1]);
	}
}

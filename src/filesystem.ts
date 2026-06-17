import {Vault, TFile, TAbstractFile, TFolder} from "obsidian";
import { compile } from 'handlebars';
import {ObsidianIssue} from "./GitlabLoader/issue-types";
import {GitlabIssuesSettings} from "./SettingsTab/settings-types";
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
}

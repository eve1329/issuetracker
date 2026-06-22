import {App, normalizePath, PluginSettingTab, Setting} from "obsidian";
import GitlabIssuesPlugin from "../main";
import {getSettingsUi} from "./settings";
import {GitlabIssuesLevel, GitlabRefreshInterval} from "./settings-types";


export class GitlabIssuesSettingTab extends PluginSettingTab {
	plugin: GitlabIssuesPlugin;

	constructor(app: App, plugin: GitlabIssuesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		const currentUi = getSettingsUi(this.plugin.settings.uiLanguage);
		const {
			title,
			languageSetting,
			settingInputs,
			dropdowns,
			checkBoxInputs,
			gitlabDocumentation,
			getGitlabIssuesLevel,
			getGitlabIdLinkText,
			getGitlabIdSettingName,
			moreInformationTitle
		} = currentUi;

		containerEl.empty();
		new Setting(containerEl)
			.setName(title)
			.setHeading();

		new Setting(containerEl)
			.setName(languageSetting.title)
			.setDesc(languageSetting.description)
			.addDropdown(dropdown => dropdown
				.addOptions(languageSetting.options)
				.setValue(this.plugin.settings.uiLanguage)
				.onChange(async (value) => {
					this.plugin.settings.uiLanguage = value as typeof this.plugin.settings.uiLanguage;
					await this.plugin.saveSettings();
					this.display();
				}));

		settingInputs.forEach((setting) => {
			const handleSetValue = (): string => {
				const currentValue = this.plugin.settings[setting.value];

				if (setting.modifier === 'normalizePath') {
					return normalizePath(currentValue as string);
				}
				if (setting.modifier === 'stringArray') {
					return (currentValue as string[]).join('\n');
				}
				if (setting.modifier === 'json') {
					return JSON.stringify(currentValue, null, 2);
				}
				return String(currentValue);
			};

			const saveValue = async (value: string) => {
				if (setting.modifier === "normalizePath") {
					this.plugin.settings[setting.value] = normalizePath(value) as never;
				} else if (setting.modifier === 'stringArray') {
					this.plugin.settings[setting.value] = value
						.split('\n')
						.map(item => item.trim())
						.filter(Boolean) as never;
				} else if (setting.modifier === 'json') {
					try {
						this.plugin.settings[setting.value] = JSON.parse(value) as never;
					} catch (error) {
						console.error(error);
						return;
					}
				} else {
					this.plugin.settings[setting.value] = value as never;
				}
				await this.plugin.saveSettings();
			};

			const uiSetting = new Setting(containerEl)
				.setName(setting.title)
				.setDesc(setting.description);

			if (setting.inputType === 'textarea') {
				uiSetting.addTextArea(text => text
					.setPlaceholder(setting.placeholder ?? "")
					.setValue(handleSetValue())
					.onChange(async (value) => {
						await saveValue(value);
					}));
				return;
			}

			uiSetting.addText(text => text
				.setPlaceholder(setting.placeholder ?? "")
				.setValue(handleSetValue())
				.onChange(async (value) => {
					await saveValue(value);
				}));
		});

		dropdowns.forEach((dropwdown) => {
			const currentValue = dropwdown.value;

			new Setting(containerEl)
				.setName(dropwdown.title)
				.setDesc(dropwdown.description)
				.addDropdown(value => value
					.addOptions(dropwdown.options)
					.setValue(this.plugin.settings[currentValue])
					.onChange(async (value) => {
						if (currentValue === 'gitlabIssuesLevel') {
							this.plugin.settings[currentValue] = value as GitlabIssuesLevel;
						} else {
							this.plugin.settings[currentValue] = value as GitlabRefreshInterval;
							this.plugin.scheduleAutomaticRefresh();
						}
						await this.plugin.saveSettings();
						this.display();
					}));
		});

		if (this.plugin.settings.gitlabIssuesLevel !== "personal") {
			const gitlabIssuesLevelIdObject = getGitlabIssuesLevel(this.plugin.settings.gitlabIssuesLevel);
			const descriptionDocumentFragment = document.createDocumentFragment();
			const descriptionLinkElement = descriptionDocumentFragment.createEl('a', {
				href: gitlabIssuesLevelIdObject.url,
				text: getGitlabIdLinkText(gitlabIssuesLevelIdObject.title),
				title: `Goto ${gitlabIssuesLevelIdObject.url}`
			});
			descriptionDocumentFragment.appendChild(descriptionLinkElement);

			new Setting(containerEl)
				.setName(getGitlabIdSettingName(gitlabIssuesLevelIdObject.title))
				.setDesc(descriptionDocumentFragment)
				.addText(value => value
					.setValue(this.plugin.settings.gitlabAppId)
					.onChange(async (value: string) => {
						this.plugin.settings.gitlabAppId = value;
						await this.plugin.saveSettings();
					}));
		}
		checkBoxInputs.forEach(checkboxSetting => {
			new Setting(containerEl)
				.setName(checkboxSetting.title)
				.addToggle(value => value
					.setValue(this.plugin.settings[checkboxSetting.value])
					.onChange(async (value) => {
						this.plugin.settings[checkboxSetting.value] = value;
						await this.plugin.saveSettings();
				}));
		});

		new Setting(containerEl)
			.setName(moreInformationTitle)
			.setHeading();
		containerEl.createEl('a', {
			text: gitlabDocumentation.title,
			href: gitlabDocumentation.url
		});
	}
}

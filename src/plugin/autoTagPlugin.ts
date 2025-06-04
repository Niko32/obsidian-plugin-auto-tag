import {Command, Plugin} from 'obsidian';
import {AutoTagPluginSettings, AutoTagSettingTab, DEFAULT_SETTINGS} from 'src/plugin/settings/settings';
import Logger from './Logger';
import {createCommandList} from './commands/commands';

// 用于调试模态的接口
export interface DebugInfo {
    apiEndpoint: string;
    requestBody: string;
    responseData?: string;
    errorMessage?: string;
    timestamp: number;
}

export default class AutoTagPlugin extends Plugin {
	public settings: AutoTagPluginSettings;
	public debugLogs: DebugInfo[] = [];
	static Logger = Logger;

	async onload() {
		await this.loadSettings();

		await AutoTagPlugin.Logger.initialize(this.app, this.settings, this.manifest);
		await Logger.log("AutoTag Logger loaded");

		/***************************************
		 *    Initialize the commands
		 ***************************************/
		const commandList: Command[] = createCommandList(this.app, this.settings);
		commandList.forEach((command) => {
			this.addCommand(command);
		});

		/***************************************
		 *    Add the settings tab
		 ***************************************/
		this.addSettingTab(new AutoTagSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// 添加调试日志
	addDebugLog(log: DebugInfo) {
		// 保留最近的20条日志
		if (this.debugLogs.length >= 20) {
			this.debugLogs.shift(); // 移除最旧的日志
		}
		this.debugLogs.push(log);
	}
}

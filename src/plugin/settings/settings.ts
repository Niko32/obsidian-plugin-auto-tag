import {App, FileSystemAdapter, Modal, Notice, PluginSettingTab, Setting} from "obsidian";
import AutoTagPlugin from "../autoTagPlugin";
import {createDocumentFragment} from "src/utils/utils";
import {OPENAI_API_MODELS} from "../../services/openaiModelsList";
import {LlmModel} from "../../services/models/openai.models";
import {Simulate} from "react-dom/test-utils";
import drop = Simulate.drop;

export interface AutoTagPluginSettings {
	useAutotagPrefix: boolean;
	useFrontmatterAutotagsKey: boolean;
	tagsFormat: "kebabCase"|"snakeCase"|"pascalCase"|"camelCase"| "pascalSnakeCase"|"trainCase"|"constantCase";
	checkCostEstimation: boolean;
	showPreUpdateDialog: boolean;
	showPostUpdateDialog: boolean;
	demoMode: boolean;
	writeToLogFile: boolean;
	openaiApiKey: string;
	openaiModel: LlmModel;
	openaiTemperature: number;
	customBaseUrl: string;
	useCustomBaseUrl: boolean;
	customModels: LlmModel[];
}

export const DEFAULT_SETTINGS: AutoTagPluginSettings = {
	useAutotagPrefix: true,
	useFrontmatterAutotagsKey: false,
	tagsFormat: "kebabCase",
	checkCostEstimation: true,
	showPreUpdateDialog: true,
	showPostUpdateDialog: true,
	demoMode: true,
	writeToLogFile: false,
	openaiApiKey: "",
	openaiModel: OPENAI_API_MODELS[0],
	openaiTemperature: 0.2,
	customBaseUrl: "",
	useCustomBaseUrl: false,
	customModels: [],
}

export class AutoTagSettingTab extends PluginSettingTab {
	plugin: AutoTagPlugin;

	constructor(app: App, plugin: AutoTagPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl, app} = this;

		containerEl.empty();

		/***************************************
		 *    Feedback & support
		 ***************************************/

		new Setting(containerEl)
		.setName('Feedback')
		.setDesc(createDocumentFragment(`This plugin is new. Your feedback helps shape what it becomes.<br>- <a href="https://forms.gle/6XWpoHKXRqzSKyZj7" target="_blank">Link to your feedback form</a><br>- by email at <a href="mailto:control.alt.focus@gmail.com">control.alt.focus@gmail.com</a><br>- on X (= Twitter) <a href="https://twitter.com/ctrl_alt_focus" target="_blank"><strong>@ctrl_alt_focus</strong></a>`))
		
		/***************************************
		 *    Main tag settings
		 ***************************************/

		new Setting(containerEl)
		.setHeading()
		.setName('Tagging options');

		new Setting(containerEl)
		.setName(`Prefix newly suggested tags with "#autotag/"`)
		.setDesc(
			createDocumentFragment(`Example: "#autotag/recipe" instead of "#recipe".<br>Read about the benefits and use cases of <a href='https://duckduckgo.com' target='_blank'>nested tags</a>.`)
		)
		.addToggle(toggle => {
			toggle.setValue(this.plugin.settings.useAutotagPrefix)
			toggle.onChange(async (toggleValue: boolean) => {
				this.plugin.settings.useAutotagPrefix = toggleValue;
				await this.plugin.saveSettings();
			})
		});

		new Setting(containerEl)
		.setName(`In front-matter insert under "autotags:" instead of "tags:"`)
		.setDesc(createDocumentFragment(`Benefit: don't mix your tags and auto tags in the front matter of your notes.<br>Downside: tags in a different property are not recognized as tags by Obsidian, no auto-complete when typing "#..".`))
		.addToggle(toggle => {
			toggle.setValue(this.plugin.settings.useFrontmatterAutotagsKey)
			toggle.onChange(async (toggleValue: boolean) => {
				this.plugin.settings.useFrontmatterAutotagsKey = toggleValue;
				await this.plugin.saveSettings();
			})
		});

		new Setting(containerEl)
		.setName('How to format tags?')
		.setDesc('You can indicate your own preference. Only applies to new suggested tags, does not update existing tags.')
		.addDropdown(dropdown => dropdown
		.addOption("kebabCase", 'two-words (kebak case)')
		.addOption("snakeCase", 'two_words (snake case)')
		.addOption("pascalCase", 'TwoWords (pascal case)')
		.addOption("camelCase", 'twoWords (camel case)')
		.addOption("pascalSnakeCase", 'Two_Words (pascal snake case)')
		.addOption("trainCase", 'Two-Words (train case)')
		.addOption("constantCase", 'TWO_WORDS (constant case)')
		.setValue(`${this.plugin.settings.tagsFormat}`)
		.onChange(async (value) => {
			this.plugin.settings.tagsFormat = value as AutoTagPluginSettings["tagsFormat"];
			await this.plugin.saveSettings();
		}));

		new Setting(containerEl)
		.setName("See estimated cost before taking action")
		.setDesc(createDocumentFragment("Get an idea of the approximate API cost of fetching tags.<br>Depends on the chosen API service and model used."))
		.addToggle(toggle => {
			toggle.setValue(this.plugin.settings.checkCostEstimation);
			toggle.onChange(async (toggleValue: boolean) => {
				this.plugin.settings.checkCostEstimation = toggleValue;
				await this.plugin.saveSettings();
			});
		});

		/*
		Possible names for this:
		** "Tag change approval" (or "Tag change confirmation")
		** "Pre-update tag summary" (or "Summary of tag changes")
		"Tag update confirmation" (or "Tag update approval")
		"Suggested tag changes" (or "Suggested tag updates")
		"Tag review and edit" (or ** "Auto tags review and approval")
		*/
		new Setting(containerEl)
		.setName("Review and approve suggested tags before inserting them")
		.setDesc(createDocumentFragment("Shows the suggested tags that will be added to the note.<br>You can make changes before accepting them."))
		.addToggle(toggle => {
			toggle.setValue(this.plugin.settings.showPreUpdateDialog);
			toggle.onChange(async (toggleValue: boolean) => {
				this.plugin.settings.showPreUpdateDialog = toggleValue;
				await this.plugin.saveSettings();
			});
		});

		/***************************************
		 *    Demo settings
		 ***************************************/

		new Setting(containerEl)
		.setHeading()
		.setName('Test mode / Demo mode');

		new Setting(containerEl)
		.setName(`Use demo mode to test with sample tags`)
		.setDesc(createDocumentFragment(`Test easily without API key or internet connection.<br>Inserts numbered sample tags, instead of generating real tags. Uses the configured settings.`))
		.addToggle(toggle => {
			toggle.setValue(this.plugin.settings.demoMode)
			toggle.onChange(async (toggleValue: boolean) => {
				this.plugin.settings.demoMode = toggleValue;
				await this.plugin.saveSettings();
			})
		});

		/***************************************
		 *    Service provider settings
		 ***************************************/

		new Setting(containerEl)
		.setHeading()
		.setName(`Service provider`);

		new Setting(containerEl)
		.setName(`Custom API Base URL`)
		.setDesc(createDocumentFragment(`Use a custom API URL instead of the default OpenAI URL. Useful for self-hosted models or OpenAI-compatible APIs.`))
		.addToggle(toggle => {
			toggle.setValue(this.plugin.settings.useCustomBaseUrl)
			toggle.onChange(async (toggleValue: boolean) => {
				this.plugin.settings.useCustomBaseUrl = toggleValue;
				await this.plugin.saveSettings();
			})
		});

		if (this.plugin.settings.useCustomBaseUrl) {
			new Setting(containerEl)
			.setName(`Base URL`)
			.setDesc(createDocumentFragment(`The base URL for the API. Should be in the format "https://api.example.com".`))
			.addText(text => text
				.setPlaceholder('https://api.example.com')
				.setValue(this.plugin.settings.customBaseUrl)
				.onChange(async (value) => {
					this.plugin.settings.customBaseUrl = value;
					await this.plugin.saveSettings();
				})
			);
		}

		const getAllModels = () => {
			return [...OPENAI_API_MODELS, ...this.plugin.settings.customModels];
		};

		new Setting(containerEl)
		.setName(`API model`)
		.setDesc(createDocumentFragment(`The model used to generate tags.`))
		.addDropdown(dropdown => {
				getAllModels().forEach(model => dropdown.addOption(model.id, model.name));
				dropdown.setValue(`${this.plugin.settings.openaiModel.id}`);
				dropdown.onChange(async (value) => {
					this.plugin.settings.openaiModel = getAllModels().find(model => model.id === value) || getAllModels()[0];
					await this.plugin.saveSettings();
				});
			}
		);

		new Setting(containerEl)
		.setName(`Add custom model`)
		.setDesc(createDocumentFragment(`Add a custom model to use with the API.`))
		.addButton(button => button
			.setButtonText("+")
			.onClick(async () => {
				const newCustomModelModal = new CustomModelModal(this.app, async (model: LlmModel) => {
					this.plugin.settings.customModels.push(model);
					await this.plugin.saveSettings();
					this.display(); // Refresh the settings page
				});
				newCustomModelModal.open();
			})
		);

		// Display custom models with edit/delete buttons
		if (this.plugin.settings.customModels.length > 0) {
			const customModelsContainer = containerEl.createDiv();
			customModelsContainer.addClass("custom-models-container");
			
			const customModelsHeader = customModelsContainer.createEl("h3", {
				text: "Custom Models"
			});
			
			this.plugin.settings.customModels.forEach((model, index) => {
				const modelContainer = customModelsContainer.createDiv();
				modelContainer.addClass("custom-model-item");
				
				const modelInfo = modelContainer.createDiv();
				modelInfo.innerHTML = `<strong>${model.name}</strong> (${model.id})<br>
					Context: ${model.context}, Input cost: ${model.inputCost1KTokens}, Output cost: ${model.outputCost1KTokens}`;
				
				const buttonContainer = modelContainer.createDiv();
				buttonContainer.addClass("custom-model-buttons");
				
				const editButton = buttonContainer.createEl("button", {
					text: "Edit"
				});
				editButton.addClass("mod-cta");
				editButton.addEventListener("click", () => {
					const editCustomModelModal = new CustomModelModal(this.app, async (updatedModel: LlmModel) => {
						this.plugin.settings.customModels[index] = updatedModel;
						
						// If the current model is the one being edited, update it too
						if (this.plugin.settings.openaiModel.id === model.id) {
							this.plugin.settings.openaiModel = updatedModel;
						}
						
						await this.plugin.saveSettings();
						this.display(); // Refresh the settings page
					}, model);
					editCustomModelModal.open();
				});
				
				const deleteButton = buttonContainer.createEl("button", {
					text: "Delete"
				});
				deleteButton.addEventListener("click", async () => {
					// If the current model is the one being deleted, reset to default
					if (this.plugin.settings.openaiModel.id === model.id) {
						this.plugin.settings.openaiModel = OPENAI_API_MODELS[0];
					}
					
					this.plugin.settings.customModels.splice(index, 1);
					await this.plugin.saveSettings();
					this.display(); // Refresh the settings page
				});
			});
		}

		new Setting(containerEl)
		.setName(`Predictability of the results`)
		.setDesc(createDocumentFragment(`You can change how "creative" the results will be.<br>The default value ("More predictable") offers a good balance between creativity and predictability.`))
			.addDropdown(dropdown => dropdown
				.addOption("0.2", 'More predictable')
				.addOption("0.9", 'More creative')
				.setValue(`${this.plugin.settings.openaiTemperature}`)
				.onChange(async (value) => {
					this.plugin.settings.openaiTemperature = parseFloat(value);
					await this.plugin.saveSettings();
					console.debug('this.plugin.settings.openaiTemperature', this.plugin.settings.openaiTemperature);
				})
			);

		new Setting(containerEl)
		.setName('API key')
		.setDesc(createDocumentFragment(`API key for authentication. For OpenAI, create a new API key at <a href="https://platform.openai.com" target="_blank">https://platform.openai.com</a>, set up your billing (set a max limit of 1$ or 5$ for example) and paste the key here.`))
		.addText(text => text
			.setPlaceholder('secret-key-...')
			.setValue(this.plugin.settings.openaiApiKey)
			.onChange(async (value) => {
				this.plugin.settings.openaiApiKey = value;
				await this.plugin.saveSettings();
				new Notice('API key saved.');
			})
		);

		/***************************************
		 *    Debugging info & stats
		 ***************************************/

		new Setting(containerEl)
		.setHeading()
		.setName('Debugging info & stats');

		let logFilePath;
		const adapter = app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			logFilePath = `${adapter.getBasePath()}/${this.plugin.manifest.dir}/autotag.log`;

			new Setting(containerEl)
			.setName("Write logs to a log file")
			.setDesc(createDocumentFragment("Helpful for to see what actions the plugin took and what the results were.<br>Log file location:<br>" + (logFilePath ? `<strong>${logFilePath}</strong>` : "(the plugin folder could not be determined)")))
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.writeToLogFile);
				toggle.onChange(async (toggleValue: boolean) => {
					this.plugin.settings.writeToLogFile = toggleValue;
					await this.plugin.saveSettings();
				});
			});
		}
	}
}

// Modal for adding/editing custom models
export class CustomModelModal extends Modal {
	model: LlmModel | undefined;
	onSubmit: (model: LlmModel) => void;

	constructor(app: App, onSubmit: (model: LlmModel) => void, model?: LlmModel) {
		super(app);
		this.onSubmit = onSubmit;
		this.model = model;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();

		contentEl.createEl("h2", {text: this.model ? "Edit Custom Model" : "Add Custom Model"});

		// Model ID
		const modelIdSetting = new Setting(contentEl)
			.setName("Model ID")
			.setDesc("The identifier of the model")
			.addText(text => text
				.setPlaceholder("my-custom-model")
				.setValue(this.model?.id || "")
				.onChange(value => {
					// Just update the field, we'll collect on submit
				})
			);

		// Model Name
		const modelNameSetting = new Setting(contentEl)
			.setName("Model Name")
			.setDesc("The display name of the model")
			.addText(text => text
				.setPlaceholder("My Custom Model")
				.setValue(this.model?.name || "")
				.onChange(value => {
					// Just update the field, we'll collect on submit
				})
			);

		// Context size
		const contextSizeSetting = new Setting(contentEl)
			.setName("Context Size")
			.setDesc("Maximum number of tokens this model can process")
			.addText(text => text
				.setPlaceholder("4096")
				.setValue(this.model?.context?.toString() || "4096")
				.onChange(value => {
					// Just update the field, we'll collect on submit
				})
			);

		// Input cost
		const inputCostSetting = new Setting(contentEl)
			.setName("Input Cost per 1K tokens")
			.setDesc("Cost in USD per 1,000 tokens for input")
			.addText(text => text
				.setPlaceholder("0.0005")
				.setValue(this.model?.inputCost1KTokens?.toString() || "0.0005")
				.onChange(value => {
					// Just update the field, we'll collect on submit
				})
			);

		// Output cost
		const outputCostSetting = new Setting(contentEl)
			.setName("Output Cost per 1K tokens")
			.setDesc("Cost in USD per 1,000 tokens for output")
			.addText(text => text
				.setPlaceholder("0.0015")
				.setValue(this.model?.outputCost1KTokens?.toString() || "0.0015")
				.onChange(value => {
					// Just update the field, we'll collect on submit
				})
			);

		// Submit button
		new Setting(contentEl)
			.addButton(button => button
				.setButtonText(this.model ? "Save" : "Add")
				.setCta()
				.onClick(() => {
					const id = modelIdSetting.controlEl.querySelector('input')?.value;
					const name = modelNameSetting.controlEl.querySelector('input')?.value;
					const contextStr = contextSizeSetting.controlEl.querySelector('input')?.value;
					const inputCostStr = inputCostSetting.controlEl.querySelector('input')?.value;
					const outputCostStr = outputCostSetting.controlEl.querySelector('input')?.value;

					if (!id || !name || !contextStr || !inputCostStr || !outputCostStr) {
						new Notice("All fields are required");
						return;
					}

					const context = parseInt(contextStr);
					const inputCost = parseFloat(inputCostStr);
					const outputCost = parseFloat(outputCostStr);

					if (isNaN(context) || isNaN(inputCost) || isNaN(outputCost)) {
						new Notice("Invalid number format");
						return;
					}

					const newModel: LlmModel = {
						id,
						name,
						features: ["function-calling"],
						context,
						inputCost1KTokens: inputCost,
						outputCost1KTokens: outputCost
					};

					this.onSubmit(newModel);
					this.close();
				})
			)
			.addButton(button => button
				.setButtonText("Cancel")
				.onClick(() => {
					this.close();
				})
			);
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

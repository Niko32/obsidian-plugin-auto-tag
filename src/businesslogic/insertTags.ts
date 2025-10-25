import AutoTagPlugin from "main";
import {Editor, EditorPosition, MarkdownView, Notice, App, getAllTags, TFile} from "obsidian";
import {PreUpdateModal} from "src/plugin/modals/preUpdateModal/preUpdateModal";
import {AutoTagPluginSettings} from "src/plugin/settings/settings";
import {createDocumentFragment, customCaseConversion} from "src/utils/utils";
import {kebabCase, camelCase, pascalCase, snakeCase, constantCase, pascalSnakeCase, trainCase} from "change-case";
import { errors } from "../locales/en.json"
import { OllamaApi } from "src/services/ollama";
import { OpenAiModel } from "src/services/openai.api";
import { Model } from "src/services/models/openai.models";

/**
 * Prompts an llm to generate tags for the given text.
 * @param text Text to feed into the llm.
 * @param settings 
 * @returns 
 */
// const getAutoTags = async (text: string, model: Model) => {
// 	let autotags: string[];
// 	if (model instanceof OpenAiModel && !model.apiKey) {
// 		new Notice(createDocumentFragment(errors.missingApiKey));
// 		return [];
// 	}

// 	// Remove the frontmatter from the document; should not be taken into account for tag generation.
// 	const YAMLFrontMatter = /---\s*[\s\S]*?\s*---/g;
// 	text = text.replace(YAMLFrontMatter, "");

// 	autotags = await model.generateTags(text)

// 	try {
// 		// Avoid empty tags
// 		autotags = autotags.filter((tag) => tag.length > 0);

// 		// Apply tag formatting preference
// 		autotags = autotags.map((tag) => {
// 			// Check if tag contains any characters outside of the Basic Latin and Latin-1 Supplement blocks
// 			const notLatin = /[^\u0020-\u007F\u0080-\u00FF\u0100-\u017F\u0180-\u024F]/.test(tag);

// 			if (notLatin) {
// 				return customCaseConversion(tag, settings.tagsFormat);
// 			}

// 			switch (settings.tagsFormat) {
// 				case "kebabCase":
// 					return kebabCase(tag);
// 				case "snakeCase":
// 					return snakeCase(tag);
// 				case "pascalCase":
// 					return pascalCase(tag);
// 				case "camelCase":
// 					return camelCase(tag);
// 				case "constantCase":
// 					return constantCase(tag);
// 				case "pascalSnakeCase":
// 					return pascalSnakeCase(tag);
// 				case "trainCase":
// 					return trainCase(tag);
// 				default:
// 					return kebabCase(tag);
// 			}
// 		});
// 	} catch (error) {
// 		AutoTagPlugin.Logger.error(error);
// 		const notice = createDocumentFragment(`<strong>Auto Tag plugin</strong><br>Error sanitizing tags: {{errorMessage}}`, {errorMessage: error.message});
// 		new Notice(notice);
// 	}

// 	if (settings.useAutotagPrefix) {
// 		autotags = autotags.map(tag => `autotag/${tag}`);
// 	}

// 	return autotags;
// };

/**
 * Inserts or updates the "tags" field in the frontmatter of a document.
 *
 * @param view
 * @param newTags - An array of tags to be inserted or appended.
 * @param editor - The editor instance containing the content to modify.
 * @param settings - The AutoTagPluginSettings object, may help indicate how to insert the tags, under which key.
 * @returns A boolean indicating whether the operation was successful or not.
 */
export const insertTagsInFrontMatter = async (view: MarkdownView, newTags: string[], editor: Editor, settings: AutoTagPluginSettings): Promise<boolean> => {
	if (!view.file) {
		AutoTagPlugin.Logger.error("insertTagsInFrontMatter: view.file is null.");
		return false;
	}
	try {
		const frontmatterKey = settings.useFrontmatterAutotagsKey ? 'autotags' : 'tags';

		await view.app.fileManager.processFrontMatter(view.file, (frontmatter: {
			autotags?: string[];
			tags: string[]
		}) => {
			if (!frontmatter[frontmatterKey]) {
				AutoTagPlugin.Logger.log(`Front matter ${frontmatterKey} key created.`);
			}

			frontmatter[frontmatterKey] = (frontmatter[frontmatterKey] || []).concat(newTags);

			// TODO filter out duplicate tags (and inform user afterwards of what tags were inserted or not)
			// TODO let user pick in what order the tags are inserted? or alphabetical order by default, keep options simple?
		});

		const notice = createDocumentFragment(`<strong>Auto Tag plugin</strong><br>${newTags.length} tags inserted`);
		new Notice(notice);
		AutoTagPlugin.Logger.log(`Inserted ${newTags.length} tags in frontmatter [${newTags.map((tag) => `#${tag}`).join(", ")}]`);
	} catch (error) {
		AutoTagPlugin.Logger.error(error);
		const notice = createDocumentFragment(`<strong>Auto Tag plugin</strong><br>Error: {{errorMessage}}`, {errorMessage: error.message});
		new Notice(notice);
		return false;
	}

	return true;
};

/**
 * Get all known tags in the given file or the entire vault.
 * @param app 
 * @param file File to search. If no file is given, search the entire vault. 
 * @returns 
 */
export const knownTags = async (app: App, file: TFile | null = null): Promise<string[]> => {
    const { vault, metadataCache } = app;
    const tags: string[] = [];

	const files = file ? [file] : vault.getMarkdownFiles();

	for (const f of files) {
		const mdc = metadataCache.getFileCache(f);
		if (mdc) {
			const x = getAllTags(mdc) || [];
			tags.push(...x)
		}
    };

    return tags.map(tag => tag.replace('#', ''));
}

const insertTags = async (view: MarkdownView, insertLocation: "frontmatter" | "after-selection" | "before-selection", suggestedTags: string[], editor: Editor, settings: AutoTagPluginSettings, initialCursorPos: EditorPosition, selectedTextLength: number) => {
	if (insertLocation === "frontmatter") {
		await insertTagsInFrontMatter(view, suggestedTags, editor, settings);

		// TODO show modal "Document already had tags abc, we added new tags xyz"
	} else if (insertLocation === "after-selection") {
		// https://stackoverflow.com/questions/23733455/inserting-a-new-text-at-given-cursor-position
		// https://docs.obsidian.md/Reference/TypeScript+API/EditorPosition/EditorPosition
		const endOfSelectedText = {
			line: initialCursorPos.line,
			ch: initialCursorPos.ch + selectedTextLength
		};
		editor.setCursor(endOfSelectedText);
		AutoTagPlugin.Logger.log(`Inserting tags after the selected text.`);
		// TODO insert tags after the selected text
	} else if (insertLocation === "before-selection") {
		editor.setCursor(initialCursorPos);
		AutoTagPlugin.Logger.log(`Inserting tags before the selected text.`);
		// TODO insert tags before the selected text
	} else {
		AutoTagPlugin.Logger.error(`Unknown insertLocation: ${insertLocation}`);
		const notice = createDocumentFragment(`<strong>Auto Tag plugin</strong><br>Unknown insertLocation.`);
		new Notice(notice);
	}
}

export function commandFnInsertTagsForNote(editor: Editor) {
	const noteContent = editor.getValue();
	AutoTagPlugin.Logger.debug(`Finding tags for full note contents (${noteContent.length} chars)`);
}

/**
 * This function takes the selected text or note contents, fetches tag suggestions for it, and inserts them in the note.
 */
export const commandFnInsertTagsForSelectedText = async (editor: Editor, view: MarkdownView, settings: AutoTagPluginSettings, insertLocation: "frontmatter" | "after-selection" | "before-selection" = "frontmatter") => {
	if (!settings.useCustomBaseUrl && !settings.openaiApiKey.length) {
		new Notice(createDocumentFragment(errors.missingApiKey));
		return [];
	}
	
	const selection = editor.getSelection();
	if (!selection) {
		const notice = createDocumentFragment(errors.noTextSelection);
		new Notice(notice);
		return;
	}
	
	AutoTagPlugin.Logger.debug(`Finding tags for user-selected text (${selection.length} chars)`);
	const initialCursorPos: EditorPosition = editor.getCursor();

	const fetchTagsFunction = async () => {
		const allTags = await knownTags(view.app);
		const nodeTags = await knownTags(view.app, view.file);
		const suggestedTags = await settings.selectedModel.generateTags(selection);

		return suggestedTags.filter(x => !nodeTags.includes(x));
	};

	if (settings.showPreUpdateDialog) {
		const onAccept = async (acceptedTags: string[]) => {
			AutoTagPlugin.Logger.debug("Tags accepted for insertion:", acceptedTags);

			/**
			 * Insert only the tags accepted by the user in the modal.
			 */
			await insertTags(view, insertLocation, acceptedTags, editor, settings, initialCursorPos, selection.length);
		};

		const onCancel = () => {
			AutoTagPlugin.Logger.debug("Tags insertion cancelled by user.");
		}

		new PreUpdateModal(view.app, settings, fetchTagsFunction, onAccept, onCancel).open();
	} else {
		/**
		 * Retrieve tag suggestions.
		 */
		const finalTags = await fetchTagsFunction();

		/**
		 * Insert the tags in the note right away.
		 */
		await insertTags(view, insertLocation, finalTags, editor, settings, initialCursorPos, selection.length);
	}
}

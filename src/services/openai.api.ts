import {GptFunction, Model} from './models/openai.models';
import AutoTagPlugin from 'src/plugin/autoTagPlugin';
import {Notice, requestUrl, RequestUrlParam, RequestUrlResponse} from "obsidian";
import {createDocumentFragment} from "../utils/utils";
import {AutoTagPluginSettings} from "../plugin/settings/settings";
import { errors } from "../locales/en.json"

const DEFAULT_OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// const llmPromptTagSuggestionsAlternative  = 'You are ChatGPT, a helpful multi-lingual assistant and text analysis tool. You help with semantic understanding and text classification of received user input text and provide suggestions for tags that best allow to categorize and identify the text, for use in search engines or content linking and grouping or semantic search of related content. You will receive the input text from the user, delimited by the --start-- and --end-- tags. Consider the context of the text, reason step by step about what it is about, then suggest tags that best describe the user\'s text. Rather than specific to this text, it should grasp the topic and meaning so that the tags can help find other related similar content.';
// const llmPromptTagSuggestions = 'You are ChatGPT, a helpful multi-lingual assistant and text analysis tool. You help with semantic understanding and text classification of received user input text and provide suggestions for tags that best allow to categorize and identify the text, for use in search engines or content linking and grouping or semantic search of related content. You will receive the input text from the user, delimited by <text> and </text>. Existing tags to consider using are below, between <existingTags> and </existingTags>. Consider the context of the text, what is it about if you take a step back? Suggest tags that best describe the user\'s text. The tags should grasp the topic and meaning so that the tags can help find other related similar content. Always create tags for names and places found in the text. Always try to generate at least 5 tags, and at most 15 tags.';
const llmPromptTagSuggestions = 'Analyze the following text and suggest 5-15 high-quality tags, using the language of the input. Consider the provided existing tags if relevant.'
const llmPromptSystem = 'You are ChatGPT, a backend multilingual tag suggestion module. Your only job is to analyze the semantic content of user-provided text and always return your results by calling the`handleTagSuggestions` function. Never output tags or any explanations directly to the chat. Always extract at least 5 and at most 15 concise, relevant tags for each text, following these rules: - Tags must accurately represent the main topics, entities (names, places, organizations), and semantic themes of the input text. - Tags should use the same language as the input text whenever possible. - Tags should be lowercase and use underscores instead of spaces or special symbols. - Do not generate redundant, repetitive, or overly similar tags. - For long texts, summarize the main topics and entities first, then generate tags based on your summary. - Only respond by calling the function, never as plain text.'
const gptTagHandlingFunctionDescription = 'This function receives a list of tags that best describe the user-provided input text for categorization, search, or semantic linking. Tags should be concise, use lowercase letters and underscores, and match the language of the input text. Tags must not be redundant or overly similar. Always return at least 5 and at most 15 tags.';

export class OpenAiModel implements Model {
	url: string
	apiKey?: string
	id: string;
	label: string;
	description?: string;
	features: ("function-calling")[];
	context: number;
	inputCpm: number;
	outputCpm: number;
	parameters?: {
		maxTokens: number;
		temperature: number;
		topP: number;
		presencePenalty: number;
		frequencyPenalty: number;
		stop: string[];
	};

	constructor(id: string, label: string, features: ("function-calling")[], context: number, inputCpm: number, outputCpm: number, apiKey?: string) {
		this.url = "https://api.openai.com/v1/chat/completions"
		this.apiKey = apiKey
		this.id = id
		this.label = label
		this.features = features
		this.context = context
		this.inputCpm = inputCpm
		this.outputCpm = outputCpm
	}
	
	async generateTags(text: string) {
		const body = JSON.stringify({
			model: this.id,
			max_tokens: this.parameters?.maxTokens, // could set a multiple of the max number of tags desired
			temperature: this.parameters?.temperature,
			messages: [
				{
					role: 'system',
					content: llmPromptSystem,
				},
				{
					role: 'user',
					content: llmPromptTagSuggestions + "<text>\n" + text + "\n</text>",
				},
			],
			functions: [gptFunction],
			function_call: {name: gptFunction.name},
		});

		const response: RequestUrlResponse = await requestUrl({
			url: "https://api.openai.com/v1/chat/completions",
			method: "POST",
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: body
		});

		if (response.status !== 200 || !response.json?.choices?.[0]?.message?.function_call) {
			throw new Error(`failed to get tags from OpenAI: ${response.json.error}`)
		}
		
		return JSON.parse(response.json.choices[0].message.function_call.arguments)
	}
}

export const gptFunction: GptFunction = {
	name: 'handleTagSuggestions',
	// TODO set max number of tags to return based on value in settings
	description: gptTagHandlingFunctionDescription,
	parameters: {
		type: 'object',
		properties: {
			tags: {
				type: 'array',
				description:
					'An array of tags (utf8 unicode strings) representing the main topics, entities, and semantic meaning of the input text. Tags should use only lowercase letters and underscores, with no spaces or special symbols.',
				items: {
					type: 'string',
				},
			},
		},
		required: ['tags'],
	},
};

// export async function getTagSuggestions(settings: AutoTagPluginSettings, inputText: string, openaiApiKey: string): Promise<string[] | null> {
// 	if (!settings.useCustomBaseUrl && !openaiApiKey) {
// 		new Notice(createDocumentFragment(errors.missingApiKey));
// 		return [];
// 	}

// 	try {
// 		const responseData: {
// 			tags?: string[],
// 			error?: { type: string, message: string, param: any, code: any }
// 		} = await fetchOpenAIFunctionCall(settings, openaiApiKey, inputText, gptFunction);

// 		if (responseData?.tags) {
// 			AutoTagPlugin.Logger.debug('LLM API suggested tags:', JSON.stringify(responseData));
// 			return responseData.tags;
// 		} else if (responseData?.error) {
// 			AutoTagPlugin.Logger.error('LLM API response is missing a "tags" property.', JSON.stringify(responseData));
// 			new Notice(createDocumentFragment(`<strong>Auto Tag plugin</strong><br>Error: {{errorMessage}}`, {errorMessage: responseData.error.message}));
// 			throw new Error('LLM API response is missing a "tags" property.');
// 		}
// 	} catch (error) {
// 		throw Error(JSON.stringify(error, null, 2));
// 	}

// 	return [];
// }

// export function getOpenAIFunctionCallBody(settings: AutoTagPluginSettings, inputText: string) {
// 	return JSON.stringify({
// 		model: settings.selectedModel.label,
// 		max_tokens: settings.selectedModel.parameters?.maxTokens, // could set a multiple of the max number of tags desired
// 		temperature: settings.openaiTemperature,
// 		messages: [
// 			{
// 				role: 'system',
// 				content: llmPromptSystem,
// 			},
// 			{
// 				role: 'user',
// 				content: llmPromptTagSuggestions + "<text>\n" + inputText + "\n</text>",
// 			},
// 		],
// 		functions: [gptFunction],
// 		function_call: {name: gptFunction.name},
// 	});
// }

/**
 * Uses LLM API to request tags for the given input text.
 * Uses Function Calling to easily handle the response.
 */
// export async function fetchOpenAIFunctionCall(settings: AutoTagPluginSettings, openaiApiKey: string, inputText: string, gptFunction: GptFunction): Promise<{
// 	tags: string[]
// }> {
// 	if (inputText.trim().length === 0) {
// 		AutoTagPlugin.Logger.warn('fetchOpenAIFunctionCall: invalid input text.', JSON.stringify(inputText));
// 		throw new Error('fetchOpenAIFunctionCall: invalid input text.');
// 	}

// 	const apiEndpoint = getApiEndpoint(settings);
// 	const requestBody = getOpenAIFunctionCallBody(settings, inputText);

// 	try {
// 		AutoTagPlugin.Logger.log(`LLM API request starting...`);
// 		AutoTagPlugin.Logger.debug(`Using API endpoint: ${apiEndpoint}`);
		
// 		const response: RequestUrlResponse = await requestUrl({
// 			url: apiEndpoint,
// 			method: "POST",
// 			headers: {
// 				'Content-Type': 'application/json',
// 				Authorization: `Bearer ${openaiApiKey}`,
// 			},
// 			body: requestBody
// 		});
// 		AutoTagPlugin.Logger.log(`LLM API request response received.`);

// 		if (response.status === 200 && response.json?.choices?.[0]?.message?.function_call) {
// 			return JSON.parse(response.json.choices[0].message.function_call.arguments);
// 		} else if (response.json.error) {
// 			AutoTagPlugin.Logger.error(`LLM API request Error:`, JSON.stringify(response.json));
// 			return JSON.parse(response.json);
// 		} else {
// 			throw new Error('Error: Failed to get tags from OpenAI API.');
// 		}
// 	} catch (error) {
// 		throw new Error(`LLM API request Error: ` + error?.response?.data?.error?.message || JSON.stringify(error, null, 2));
// 	}
// }

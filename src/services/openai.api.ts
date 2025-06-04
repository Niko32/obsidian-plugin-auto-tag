import {GptFunction} from './models/openai.models';
import AutoTagPlugin from 'src/plugin/autoTagPlugin';
import {Notice, requestUrl, RequestUrlParam, RequestUrlResponse} from "obsidian";
import {createDocumentFragment} from "../utils/utils";
import {AutoTagPluginSettings} from "../plugin/settings/settings";

const DEFAULT_OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// const llmPromptTagSuggestionsAlternative  = 'You are ChatGPT, a helpful multi-lingual assistant and text analysis tool. You help with semantic understanding and text classification of received user input text and provide suggestions for tags that best allow to categorize and identify the text, for use in search engines or content linking and grouping or semantic search of related content. You will receive the input text from the user, delimited by the --start-- and --end-- tags. Consider the context of the text, reason step by step about what it is about, then suggest tags that best describe the user\'s text. Rather than specific to this text, it should grasp the topic and meaning so that the tags can help find other related similar content.';
const llmPromptTagSuggestions = 'You are ChatGPT, a helpful multi-lingual assistant and text analysis tool. You help with semantic understanding and text classification of received user input text and provide suggestions for tags that best allow to categorize and identify the text, for use in search engines or content linking and grouping or semantic search of related content. You will receive the input text from the user, delimited by <text> and </text>. Existing tags to consider using are below, between <existingTags> and </existingTags>. Consider the context of the text, what is it about if you take a step back? Suggest tags that best describe the user\'s text. The tags should grasp the topic and meaning so that the tags can help find other related similar content. Always create tags for names and places found in the text. Always try to generate at least 5 tags, and at most 15 tags.';

const gptTagHandlingFunctionDescription = 'This function needs to receive a list of tags, that you suggest based on the best matching tags that describe the user-provided input text. The tags should be in the language of the user-provided input text.';

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
					'An array of utf8 unicode values representing tags. Tags ideally should only contain lowercase letters and underscores. Tags might represent strings in various languages and alphabets.',
				items: {
					type: 'string',
				},
			},
		},
		required: ['tags'],
	},
};

// 获取API endpoint URL
function getApiEndpoint(settings: AutoTagPluginSettings): string {
	if (settings.useCustomBaseUrl && settings.customBaseUrl) {
		// 确保URL以/结尾
		const baseUrl = settings.customBaseUrl.endsWith('/') 
			? settings.customBaseUrl 
			: `${settings.customBaseUrl}/`;
			
		// 假设自定义API也使用chat/completions端点，如果不是，可能需要额外配置
		return `${baseUrl}chat/completions`;
	}
	return DEFAULT_OPENAI_API_URL;
}

export async function getTagSuggestions(settings: AutoTagPluginSettings, inputText: string, knownTags: string[], openaiApiKey: string): Promise<string[] | null> {
	if (openaiApiKey === '' || !openaiApiKey) {
		new Notice(createDocumentFragment(`<strong>Auto Tag plugin</strong><br>Error: API key is missing. Please add it in the plugin settings.`));
		return [];
	}

	try {
		const responseData: {
			tags?: string[],
			error?: { type: string, message: string, param: any, code: any }
		} = await fetchOpenAIFunctionCall(settings, openaiApiKey, inputText, knownTags, gptFunction);

		if (responseData?.tags) {
			AutoTagPlugin.Logger.debug('LLM API suggested tags:', JSON.stringify(responseData));
			return responseData.tags;
		} else if (responseData?.error) {
			AutoTagPlugin.Logger.error('LLM API response is missing a "tags" property.', JSON.stringify(responseData));
			new Notice(createDocumentFragment(`<strong>Auto Tag plugin</strong><br>Error: {{errorMessage}}`, {errorMessage: responseData.error.message}));
			throw new Error('LLM API response is missing a "tags" property.');
		}
	} catch (error) {
		throw Error(JSON.stringify(error, null, 2));
	}

	return [];
}

export function getOpenAIFunctionCallBody(settings: AutoTagPluginSettings, inputText: string, knownTags: string[] = []) {
	return JSON.stringify({
		model: settings.openaiModel.id,
		max_tokens: settings.openaiModel.parameters?.maxTokens, // could set a multiple of the max number of tags desired
		temperature: settings.openaiTemperature,
		messages: [
			{
				role: 'system',
				content: llmPromptSystem,
			},
			{
				role: 'user',
				content: llmPromptTagSuggestions + " <text>\n" + inputText + "\n</text>\n\n<existingTags>\n" + knownTags + "\n</existingTags>",
			},
		],
		functions: [gptFunction],
		function_call: {name: gptFunction.name},
	});
}

/**
 * Uses LLM API to request tags for the given input text.
 * Uses Function Calling to easily handle the response.
 */
export async function fetchOpenAIFunctionCall(settings: AutoTagPluginSettings, openaiApiKey: string, inputText: string, knownTags: string[], gptFunction: GptFunction): Promise<{
	tags: string[]
}> {
	if (inputText.trim().length === 0) {
		AutoTagPlugin.Logger.warn('fetchOpenAIFunctionCall: invalid input text.', JSON.stringify(inputText));
		throw new Error('fetchOpenAIFunctionCall: invalid input text.');
	}

	const requestId = Math.random().toString(36).substring(2, 10).toUpperCase();

	try {
		const requestUrlParam: RequestUrlParam = {
			url: OPENAI_API_URL,
			method: "POST",
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${openaiApiKey}`,
			},
			body: getOpenAIFunctionCallBody(settings, inputText, knownTags)
		};
		AutoTagPlugin.Logger.log(`OpenAI API request (ID ${requestId}) starting...`);
		const response: RequestUrlResponse = await requestUrl(
			requestUrlParam
		);
		AutoTagPlugin.Logger.log(`OpenAI API request (ID ${requestId}) response received.`);

		if (response.status === 200 && response.json?.choices?.[0]?.message?.function_call) {
			return JSON.parse(response.json.choices[0].message.function_call.arguments);
		} else if (response.json.error) {
			AutoTagPlugin.Logger.error("OpenAI API request (ID ${requestId}) Error:", JSON.stringify(response.json));
			return JSON.parse(response.json);
		} else {
			throw new Error('Error: Failed to get tags from OpenAI API.');
		}
	} catch (error) {
		AutoTagPlugin.Logger.warn(`OpenAI API request (ID ${requestId}) Error: ` + error?.response?.data?.error?.message || JSON.stringify(error, null, 2));
		throw new Error(`OpenAI API request (ID ${requestId}) Error: ` + error?.response?.data?.error?.message || JSON.stringify(error, null, 2));
	}
}

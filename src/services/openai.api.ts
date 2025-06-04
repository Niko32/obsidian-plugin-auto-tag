import {GptFunction} from './models/openai.models';
import AutoTagPlugin from 'src/plugin/autoTagPlugin';
import {Notice, requestUrl, RequestUrlParam, RequestUrlResponse} from "obsidian";
import {createDocumentFragment} from "../utils/utils";
import {AutoTagPluginSettings} from "../plugin/settings/settings";

const DEFAULT_OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// const llmPromptTagSuggestionsAlternative  = 'You are ChatGPT, a helpful multi-lingual assistant and text analysis tool. You help with semantic understanding and text classification of received user input text and provide suggestions for tags that best allow to categorize and identify the text, for use in search engines or content linking and grouping or semantic search of related content. You will receive the input text from the user, delimited by the --start-- and --end-- tags. Consider the context of the text, reason step by step about what it is about, then suggest tags that best describe the user\'s text. Rather than specific to this text, it should grasp the topic and meaning so that the tags can help find other related similar content.';
// const llmPromptTagSuggestions = 'You are ChatGPT, a helpful multi-lingual assistant and text analysis tool. You help with semantic understanding and text classification of received user input text and provide suggestions for tags that best allow to categorize and identify the text, for use in search engines or content linking and grouping or semantic search of related content. You will receive the input text from the user, delimited by <text> and </text>. Existing tags to consider using are below, between <existingTags> and </existingTags>. Consider the context of the text, what is it about if you take a step back? Suggest tags that best describe the user\'s text. The tags should grasp the topic and meaning so that the tags can help find other related similar content. Always create tags for names and places found in the text. Always try to generate at least 5 tags, and at most 15 tags.';
const llmPromptTagSuggestions = 'Analyze the following text and suggest 5-15 high-quality tags, using the language of the input. Consider the provided existing tags if relevant.'
const llmPromptSystem = 'You are ChatGPT, a backend multilingual tag suggestion module. Your only job is to analyze the semantic content of user-provided text and always return your results by calling the`handleTagSuggestions` function. Never output tags or any explanations directly to the chat. Always extract at least 5 and at most 15 concise, relevant tags for each text, following these rules: - Tags must accurately represent the main topics, entities (names, places, organizations), and semantic themes of the input text. - Tags should use the same language as the input text whenever possible. - Tags should be lowercase and use underscores instead of spaces or special symbols. - Do not generate redundant, repetitive, or overly similar tags. - For long texts, summarize the main topics and entities first, then generate tags based on your summary. - Only respond by calling the function, never as plain text.'
const gptTagHandlingFunctionDescription = 'This function receives a list of tags that best describe the user-provided input text for categorization, search, or semantic linking. Tags should be concise, use lowercase letters and underscores, and match the language of the input text. Tags must not be redundant or overly similar. Always return at least 5 and at most 15 tags.';

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
	const apiEndpoint = getApiEndpoint(settings);
	const requestBody = getOpenAIFunctionCallBody(settings, inputText, knownTags);

	// 获取插件实例以记录调试信息
	const plugin = (window as any).app.plugins.plugins["auto-tag"];
	if (!plugin) {
		AutoTagPlugin.Logger.warn('Could not find plugin instance for debugging');
	}

	// 创建调试日志条目
	const debugLog: {
		apiEndpoint: string;
		requestBody: string;
		responseData?: string;
		errorMessage?: string;
		timestamp: number;
	} = {
		apiEndpoint,
		requestBody,
		timestamp: Date.now()
	};

	try {
		const requestUrlParam: RequestUrlParam = {
			url: apiEndpoint,
			method: "POST",
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${openaiApiKey}`,
			},
			body: requestBody
		};
		AutoTagPlugin.Logger.log(`LLM API request (ID ${requestId}) starting...`);
		AutoTagPlugin.Logger.debug(`Using API endpoint: ${apiEndpoint}`);
		
		const response: RequestUrlResponse = await requestUrl(
			requestUrlParam
		);
		AutoTagPlugin.Logger.log(`LLM API request (ID ${requestId}) response received.`);

		// 记录响应数据到调试日志
		debugLog.responseData = JSON.stringify(response.json);
		
		if (plugin) {
			plugin.addDebugLog(debugLog);
		}

		if (response.status === 200 && response.json?.choices?.[0]?.message?.function_call) {
			return JSON.parse(response.json.choices[0].message.function_call.arguments);
		} else if (response.json.error) {
			AutoTagPlugin.Logger.error(`LLM API request (ID ${requestId}) Error:`, JSON.stringify(response.json));
			
			// 记录错误到调试日志
			if (debugLog) {
				debugLog.errorMessage = JSON.stringify(response.json.error);
				if (plugin) {
					plugin.addDebugLog(debugLog);
				}
			}
			
			return JSON.parse(response.json);
		} else {
			const errorMsg = 'Error: Failed to get tags from LLM API.';
			
			// 记录错误到调试日志
			if (debugLog) {
				debugLog.errorMessage = errorMsg;
				if (plugin) {
					plugin.addDebugLog(debugLog);
				}
			}
			
			throw new Error(errorMsg);
		}
	} catch (error) {
		const errorMsg = `LLM API request (ID ${requestId}) Error: ` + error?.response?.data?.error?.message || JSON.stringify(error, null, 2);
		AutoTagPlugin.Logger.warn(errorMsg);
		
		// 记录错误到调试日志
		if (debugLog) {
			debugLog.errorMessage = errorMsg;
			if (plugin) {
				plugin.addDebugLog(debugLog);
			}
		}
		
		throw new Error(errorMsg);
	}
}

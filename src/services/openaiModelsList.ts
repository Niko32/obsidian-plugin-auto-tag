import {LlmModel} from "./models/openai.models";

export const OPENAI_API_MODELS: LlmModel[] = [
	{
		id: "gpt-3.5-turbo",
		name: "GPT-3.5 Turbo",
		features: ["function-calling"],
		context: 16000,
		inputCost1KTokens: 0.0005,
		outputCost1KTokens: 0.0015
	},
	{
		id: "gpt-4o-mini",
		name: "GPT-4o mini",
		features: ["function-calling"],
		context: 16384,
		inputCost1KTokens: 0.00015,
		outputCost1KTokens: 0.00060
	}
	// For now no point in using GPT-4, it's not much better than GPT-3.5 Turbo for this task and more expensive
	// {
	// 	id: "gpt-4",
	// 	name: "GPT-4",
	// 	features: ["function-calling"],
	// 	context: 8000,
	// 	inputCost1KTokens: 0.03,
	// 	outputCost1KTokens: 0.06
	// },
	// {
	// 	id: "gpt-4-32k",
	// 	name: "GPT-4 (32K context)",
	// 	features: ["function-calling"],
	// 	context: 32000,
	// 	inputCost1KTokens: 0.06,
	// 	outputCost1KTokens: 0.12
	// }
];

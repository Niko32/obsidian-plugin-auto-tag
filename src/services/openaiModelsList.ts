import { OpenAiModel } from "./openai.api";

export const OPENAI_API_MODELS: OpenAiModel[] = [
	new OpenAiModel("gpt-3.5-turbo", "GPT-3.5 Turbo",["function-calling"],16000, 0.0005, 0.0015),
	new OpenAiModel("gpt-4o-mini", "GPT-4o mini",["function-calling"],16384, 0.00015, 0.0006)
	// For now no point in using GPT-4, it's not much better than GPT-3.5 Turbo for this task and more expensive
	// {
	// 	id: "gpt-4",
	// 	name: "GPT-4",
	// 	features: ["function-calling"],
	// 	context: 8000,
	// 	inputCpm: 0.03,
	// 	outputCpm: 0.06
	// },
	// {
	// 	id: "gpt-4-32k",
	// 	name: "GPT-4 (32K context)",
	// 	features: ["function-calling"],
	// 	context: 32000,
	// 	inputCpm: 0.06,
	// 	outputCpm: 0.12
	// }
];

export type GptFunctionParameter = {
    type: "string" | "number" | "integer" | "boolean" | "array" | "object";
    description?: string;
    enum?: string[]; // For type: "string"
    items?: GptFunctionParameter; // For type: "array"
    properties?: Record<string, GptFunctionParameter>; // For type: "object"
    required?: string[]; // Required properties for type: "object"
};

export type GptFunction = {
    name: string;
    description?: string;
    parameters?: GptFunctionParameter;
};

export enum ModelType {
	OpenAPI,
	Ollama
}

export interface Model {
    label: string
	url: string

	/**
	 * Generates tags describing the given text.
	 * @param text Input text
	 * @returns List of generated tags
	 */
	generateTags: (text: string) => Promise<string[]>
}


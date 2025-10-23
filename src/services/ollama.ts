import { Model } from "./models/openai.models";

export class OllamaApi implements Model {
    url: string
    
    constructor(url: string) {
        this.url = url
    }

    async generateTags(text: string) {
        return [""]
    }
}
import {App, getAllTags, TFile} from "obsidian";

export const getKnownTags = async (app: App, file: TFile | null = null): Promise<string[]> => {
    const { vault, metadataCache } = app;
    const tags: string[] = [];

	const mkdFiles = file ? [file] : vault.getMarkdownFiles();

    mkdFiles.forEach((file, index) => {
		const mdc = metadataCache.getFileCache(file);
		if (mdc) {
			const x = getAllTags(mdc) || [];
			tags.push(...x)
		}
    });

    return tags.map(tag => tag.replace('#', ''));
}

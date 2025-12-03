import { readFileSync } from "fs";
import { join } from "path";
import type { Language } from "../types/language";

let promptCache: Record<Language, string> | null = null;

const loadPrompt = (language: Language): string => {
  if (promptCache?.[language]) {
    return promptCache[language];
  }

  try {
    const promptsDir = join(process.cwd(), "src/app/api/prompts");
    const filePath = join(promptsDir, `${language}.md`);
    const content = readFileSync(filePath, "utf-8");
    const trimmed = content.trim();

    if (!promptCache) {
      promptCache = {} as Record<Language, string>;
    }
    promptCache[language] = trimmed;

    return trimmed;
  } catch (error) {
    throw new Error(
      `Failed to load prompt file for language "${language}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const getSystemPrompt = (language: Language): string => loadPrompt(language);


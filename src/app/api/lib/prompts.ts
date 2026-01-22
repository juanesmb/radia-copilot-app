import { readFileSync } from "fs";
import { join } from "path";
import type { Language } from "../types/language";
import type { Report } from "../repositories/reportRepository";

let promptCache: Record<Language, string> | null = null;
let enhancementPromptCache: Record<Language, string> | null = null;
let chatPromptCache: Record<Language, string> | null = null;

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

const loadChatPrompt = (language: Language): string => {
  if (chatPromptCache?.[language]) {
    return chatPromptCache[language];
  }

  try {
    const promptsDir = join(process.cwd(), "src/app/api/prompts");
    const filePath = join(promptsDir, `${language}-chat.md`);
    const content = readFileSync(filePath, "utf-8");
    const trimmed = content.trim();

    if (!chatPromptCache) {
      chatPromptCache = {} as Record<Language, string>;
    }
    chatPromptCache[language] = trimmed;

    return trimmed;
  } catch (error) {
    throw new Error(
      `Failed to load chat prompt file for language "${language}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const loadEnhancementPrompt = (language: Language): string => {
  if (enhancementPromptCache?.[language]) {
    return enhancementPromptCache[language];
  }

  try {
    const promptsDir = join(process.cwd(), "src/app/api/prompts");
    const filePath = join(promptsDir, `${language}-enhance.md`);
    const content = readFileSync(filePath, "utf-8");
    const trimmed = content.trim();

    if (!enhancementPromptCache) {
      enhancementPromptCache = {} as Record<Language, string>;
    }
    enhancementPromptCache[language] = trimmed;

    return trimmed;
  } catch (error) {
    throw new Error(
      `Failed to load enhancement prompt file for language "${language}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const getSystemPrompt = (language: Language): string => loadPrompt(language);

export const getEnhancementPrompt = (language: Language): string => loadEnhancementPrompt(language);

export const getChatSystemPrompt = (language: Language): string => loadChatPrompt(language);

export const getChatReportContextPrompt = (report: Report, language: Language): string => {
  const transcription = report.updated_transcription || report.generated_transcription;
  const reportContent = report.updated_report || report.generated_report;
  const heading =
    language === "es"
      ? "Contexto del informe seleccionado (este contenido ya fue provisto):"
      : "Selected report context (this content has already been provided):";

  return (
    `${heading}\n` +
    `Título: ${report.report_title ?? "(sin título)"}\n` +
    `Transcripción: ${transcription}\n` +
    `Informe: ${reportContent}`
  );
};


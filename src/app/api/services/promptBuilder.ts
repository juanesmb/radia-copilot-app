import { getSystemPrompt } from "../lib/prompts";
import type { GenerateReportRequest } from "../types/generate-report";
import type { Language } from "../types/language";

interface PromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export interface PromptBuilder {
  build(input: GenerateReportRequest): PromptResult;
}

const buildUserPrompt = (transcription: string, language: Language) => {
  const instructions =
    language === "en"
      ? "Summarize the dictation, draft organized findings, and finish with an actionable impression."
      : "Resume la dictación, redacta hallazgos organizados y finaliza con una impresión accionable.";

  return `
${instructions}

Transcription:
"""
${transcription}
"""
`.trim();
};

export const createPromptBuilder = (): PromptBuilder => ({
  build: (input) => ({
    systemPrompt: getSystemPrompt(input.language),
    userPrompt: buildUserPrompt(input.transcription, input.language),
  }),
});


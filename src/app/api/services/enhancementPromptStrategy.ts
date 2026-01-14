import { getEnhancementPrompt } from "../lib/prompts";
import type { GenerateReportRequest } from "../types/generate-report";
import type { PromptStrategy } from "./promptStrategy";

export const createEnhancementPromptStrategy = (): PromptStrategy => ({
  async buildSystemPrompt(
    input: GenerateReportRequest,
    _template: string,
    _studyType: string
  ): Promise<string> {
    return getEnhancementPrompt(input.language);
  },

  buildUserPrompt(_input: GenerateReportRequest, template: string): string {
    return template.trim();
  },
});

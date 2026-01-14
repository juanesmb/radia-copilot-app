import type { GenerateReportRequest } from "../types/generate-report";

export interface PromptStrategy {
  buildSystemPrompt(
    input: GenerateReportRequest,
    template: string,
    studyType: string
  ): Promise<string>;
  buildUserPrompt(input: GenerateReportRequest, template: string): string;
}

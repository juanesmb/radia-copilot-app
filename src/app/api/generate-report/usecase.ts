import type { OpenAIClient } from "../clients/openaiClient";
import type { ResponseFormatter } from "../services/responseFormatter";
import type { PromptBuilder } from "../services/promptBuilder";
import type { GenerateReportRequest, GenerateReportResult } from "../types/generate-report";

type Dependencies = {
  promptBuilder: PromptBuilder;
  responseFormatter: ResponseFormatter;
  openAIClient: OpenAIClient;
};

export const createGenerateReportUseCase = (deps: Dependencies) => {
  return {
    async execute(input: GenerateReportRequest): Promise<GenerateReportResult> {
      const prompt = deps.promptBuilder.build(input);
      const rawContent = await deps.openAIClient.generateReport(prompt);
      return deps.responseFormatter.format(rawContent);
    },
  };
};


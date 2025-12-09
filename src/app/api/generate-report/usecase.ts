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
      const prompt = await deps.promptBuilder.build(input);
      
      // Log selected template and full prompt before calling the model
      console.log("\n" + "=".repeat(80));
      console.log("📋 SELECTED TEMPLATE:", prompt.selectedTemplate);
      console.log("=".repeat(80));
      console.log("\n📝 SYSTEM PROMPT:");
      console.log("-".repeat(80));
      console.log(prompt.systemPrompt);
      console.log("-".repeat(80));
      console.log("\n💬 USER PROMPT:");
      console.log("-".repeat(80));
      console.log(prompt.userPrompt);
      console.log("-".repeat(80));
      console.log("=".repeat(80) + "\n");
      
      const rawContent = await deps.openAIClient.generateReport(prompt);
      return deps.responseFormatter.format(rawContent);
    },
  };
};


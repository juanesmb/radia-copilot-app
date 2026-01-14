import type { OpenAIClient } from "../clients/openaiClient";
import type { ResponseFormatter } from "../services/responseFormatter";
import type { PromptBuilder } from "../services/promptBuilder";
import type { ReportRepository, Report } from "../repositories/reportRepository";
import type { StreamFormatter } from "../services/streamFormatter";
import type { GenerateReportRequest } from "../types/generate-report";

type Dependencies = {
  promptBuilder: PromptBuilder;
  openAIClient: OpenAIClient;
  responseFormatter: ResponseFormatter;
  reportRepository: ReportRepository;
  streamFormatter: StreamFormatter;
  modelUsed: string;
};

export type StreamEvent = 
  | { type: "chunk"; content: string }
  | { type: "metadata"; data: Record<string, unknown> }
  | { type: "error"; message: string };

export const createStreamingReportUseCase = (deps: Dependencies) => {
  return {
    async *executeStream(
      input: GenerateReportRequest,
      userId: string,
      reportId?: string
    ): AsyncGenerator<StreamEvent> {
      try {
        // Build prompt
        const prompt = await deps.promptBuilder.build(input);

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

        // Stream from OpenAI
        let accumulatedContent = "";
        const stream = deps.openAIClient.generateReportStream({
          systemPrompt: prompt.systemPrompt,
          userPrompt: prompt.userPrompt,
        });

        for await (const chunk of stream) {
          accumulatedContent += chunk;
          yield { type: "chunk", content: chunk };
        }

        // Log the final raw response from OpenAI
        console.log("\n" + "=".repeat(80));
        console.log("🤖 OPENAI RAW RESPONSE:");
        console.log("=".repeat(80));
        console.log(accumulatedContent);
        console.log("=".repeat(80));
        console.log(`📏 Response length: ${accumulatedContent.length} characters\n`);

        // Format the complete response
        const formatted = deps.responseFormatter.format(accumulatedContent);

        // Log the formatted response
        console.log("\n" + "=".repeat(80));
        console.log("📄 FORMATTED RESPONSE:");
        console.log("=".repeat(80));
        console.log("Title:", formatted.title);
        console.log("Report:", formatted.report);
        console.log("=".repeat(80) + "\n");

        const reportData = {
          ...formatted,
          studyType: prompt.detection?.studyType,
          detectionConfidence: prompt.detection?.confidence,
          modelUsed: deps.modelUsed,
          selectedTemplate: prompt.selectedTemplate,
        };

        // Prepare report fields for database
        const baseReportFields = {
          generated_transcription: input.transcription,
          updated_transcription: input.transcription,
          generated_report: reportData.report,
          updated_report: reportData.report,
          used_template: reportData.selectedTemplate,
          model_used: reportData.modelUsed,
        };

        // Save to database - update existing report or create new one
        const savedReport: Report = reportId
          ? await deps.reportRepository.updateReport(reportId, userId, {
              ...baseReportFields,
              report_title: reportData.title || undefined,
              template_content: input.isCustomTemplate && input.template ? input.template : undefined,
              study_type: reportData.studyType || undefined,
              detection_confidence: reportData.detectionConfidence || undefined,
            })
          : await deps.reportRepository.createReport({
              user_id: userId,
              ...baseReportFields,
              report_title: reportData.title || null,
              template_content: input.isCustomTemplate && input.template ? input.template : null,
              study_type: reportData.studyType || null,
              detection_confidence: reportData.detectionConfidence || null,
              language: input.language,
            });

        // Send metadata
        yield {
          type: "metadata",
          data: {
            reportId: savedReport.report_id,
            title: savedReport.report_title || reportData.title,
            studyType: savedReport.study_type || undefined,
            detectionConfidence: savedReport.detection_confidence || undefined,
            modelUsed: savedReport.model_used,
            selectedTemplate: reportData.selectedTemplate,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error occurred";
        yield { type: "error", message };
      }
    },
  };
};

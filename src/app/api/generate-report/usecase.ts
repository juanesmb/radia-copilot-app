import type { AIClient } from "../clients/aiClient";
import type { ResponseFormatter } from "../services/responseFormatter";
import type { PromptBuilder } from "../services/promptBuilder";
import type { ReportRepository } from "../repositories/reportRepository";
import type { GenerateReportRequest, GenerateReportResult } from "../types/generate-report";

type Dependencies = {
  promptBuilder: PromptBuilder;
  responseFormatter: ResponseFormatter;
  aiClient: AIClient;
  modelUsed: string;
  reportRepository: ReportRepository;
};

export interface GenerateReportUseCaseResult extends GenerateReportResult {
  report_id: string;
  selectedTemplate: string;
}

export const createGenerateReportUseCase = (deps: Dependencies) => {
  return {
    async execute(input: GenerateReportRequest, userId: string): Promise<GenerateReportUseCaseResult> {
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
      
      const rawContent = await deps.aiClient.generateReport(prompt);
      
      // Log the final raw response from AI Gateway
      console.log("\n" + "=".repeat(80));
      console.log("🤖 AI GATEWAY RAW RESPONSE:");
      console.log("=".repeat(80));
      console.log(rawContent);
      console.log("=".repeat(80));
      console.log(`📏 Response length: ${rawContent.length} characters\n`);

      const formatted = deps.responseFormatter.format(rawContent);

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

      // Ensure used_template is "custom" if isCustomTemplate is true
      const usedTemplate = input.isCustomTemplate ? "custom" : reportData.selectedTemplate;

      const savedReport = await deps.reportRepository.createReport({
        user_id: userId,
        generated_transcription: input.transcription,
        updated_transcription: input.transcription,
        report_title: reportData.title || null,
        generated_report: reportData.report,
        updated_report: reportData.report,
        used_template: usedTemplate,
        template_id: input.templateId ?? null,
        template_content: input.isCustomTemplate && input.template ? input.template : null,
        study_type: reportData.studyType || null,
        detection_confidence: reportData.detectionConfidence || null,
        model_used: reportData.modelUsed,
        language: input.language,
      });

      return {
        report_id: savedReport.report_id,
        title: savedReport.report_title || reportData.title,
        report: savedReport.updated_report,
        studyType: savedReport.study_type || undefined,
        detectionConfidence: savedReport.detection_confidence || undefined,
        modelUsed: savedReport.model_used,
        selectedTemplate: reportData.selectedTemplate,
      };
    },
  };
};


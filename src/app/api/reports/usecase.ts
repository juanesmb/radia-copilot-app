import type { ReportRepository } from "../repositories/reportRepository";
import type { Report } from "../repositories/reportRepository";

type Dependencies = {
  reportRepository: ReportRepository;
};

export const createGetReportsUseCase = (deps: Dependencies) => {
  return {
    async execute(userId: string): Promise<Report[]> {
      return deps.reportRepository.getUserReports(userId);
    },
  };
};

export const createCreateReportUseCase = (deps: Dependencies) => {
  return {
    async execute(userId: string, payload: { report_title: string | null; language: string }): Promise<Report> {
      return deps.reportRepository.createReport({
        user_id: userId,
        report_title: payload.report_title,
        language: payload.language,
        // Initialize empty content for draft creation
        generated_transcription: "",
        updated_transcription: "",
        generated_report: "",
        updated_report: "",
        used_template: "",
        template_content: null,
        study_type: null,
        detection_confidence: null,
        model_used: "",
      });
    },
  };
};

import type { ReportRepository, UpdateReportData } from "../../repositories/reportRepository";
import type { Report } from "../../repositories/reportRepository";

type Dependencies = {
  reportRepository: ReportRepository;
};

export const createUpdateReportUseCase = (deps: Dependencies) => {
  return {
    async execute(
      reportId: string,
      userId: string,
      updates: UpdateReportData
    ): Promise<Report> {
      return deps.reportRepository.updateReport(reportId, userId, updates);
    },
  };
};


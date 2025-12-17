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


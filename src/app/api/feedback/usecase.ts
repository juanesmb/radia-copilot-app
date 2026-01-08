import { HttpError } from "../lib/errorHandler";
import type { FeedbackRepository } from "../repositories/feedbackRepository";
import type { Feedback } from "../repositories/feedbackRepository";
import type { ReportRepository } from "../repositories/reportRepository";
import type { FeedbackRequest } from "../types/feedback";

type Dependencies = {
  feedbackRepository: FeedbackRepository;
  reportRepository: ReportRepository;
};

export const createFeedbackUseCase = (deps: Dependencies) => {
  return {
    async execute(
      data: FeedbackRequest,
      userId: string
    ): Promise<Feedback> {
      // Verify that the user owns the report
      const reports = await deps.reportRepository.getUserReports(userId);
      const userOwnsReport = reports.some((r) => r.report_id === data.reportId);

      if (!userOwnsReport) {
        throw new HttpError("Report not found or you do not have access to it", {
          status: 404,
        });
      }

      // Check if feedback already exists for this report
      const existingFeedback = await deps.feedbackRepository.getFeedbackByReportId(
        data.reportId,
        userId
      );

      if (existingFeedback) {
        throw new HttpError("Feedback already submitted for this report", {
          status: 409,
        });
      }

      // Create feedback
      const feedback = await deps.feedbackRepository.createFeedback({
        user_id: userId,
        report_id: data.reportId,
        confidence: data.confidence,
        reason: data.reason ?? null,
      });

      return feedback;
    },
  };
};


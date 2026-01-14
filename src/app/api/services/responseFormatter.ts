import type { GenerateReportResult } from "../types/generate-report";

export interface ResponseFormatter {
  format(content: string): GenerateReportResult;
}

export const createResponseFormatter = (): ResponseFormatter => ({
  format: (content) => {
    const base: GenerateReportResult = {
      title: "",
      report: "",
    };

    if (!content) {
      return base;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      return base;
    }

    // Split by newlines and extract first line as title
    const lines = trimmed.split('\n');
    const firstLine = lines[0] || ''; // Always use first line, even if empty
    const reportBody = lines.slice(1).join('\n').trim();

    return {
      title: firstLine,
      report: firstLine ? `${firstLine}\n\n${reportBody}` : reportBody,
    };
  },
});


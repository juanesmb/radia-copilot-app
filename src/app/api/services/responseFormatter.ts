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

    if (!content.trim()) {
      return base;
    }

    const normalized = content.replace(/\r\n/g, "\n").trimEnd();

    // Split by newlines and extract first line as title (preserve empty first line)
    const lines = normalized.split("\n");
    const firstLine = lines[0] ?? "";
    const reportBody = lines.slice(1).join("\n").trim();

    const report = (() => {
      if (firstLine && reportBody) {
        return `${firstLine}\n\n${reportBody}`;
      }
      if (firstLine) {
        return firstLine;
      }
      return reportBody;
    })();

    return {
      title: firstLine,
      report,
    };
  },
});

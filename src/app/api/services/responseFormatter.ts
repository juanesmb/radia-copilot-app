import type { GenerateReportResult } from "../types/generate-report";

export interface ResponseFormatter {
  format(content: string): GenerateReportResult;
}

const sanitizeJsonString = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    const withoutFence = trimmed.replace(/```json|```/g, "");
    return withoutFence.trim();
  }
  return trimmed;
};

export const createResponseFormatter = (): ResponseFormatter => ({
  format: (content) => {
    const base: GenerateReportResult = {
      title: "",
      report: "",
    };

    if (!content) {
      return base;
    }

    try {
      const parsed = JSON.parse(sanitizeJsonString(content));
      return {
        title: parsed.title ?? base.title,
        report: parsed.report ?? base.report,
      };
    } catch {
      const cleaned = sanitizeJsonString(content);
      if (!cleaned) {
        return base;
      }

      // Fallback: return the raw content as the report
      return {
        title: base.title,
        report: cleaned,
      };
    }
  },
});


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
      studyTitle: "",
      findings: "",
      impression: "",
    };

    if (!content) {
      return base;
    }

    try {
      const parsed = JSON.parse(sanitizeJsonString(content));
      const mergedFindings = [parsed.findings, parsed.results].filter(Boolean).join("\n\n").trim();

      return {
        studyTitle: parsed.studyTitle ?? base.studyTitle,
        findings: mergedFindings || base.findings,
        impression: parsed.impression ?? base.impression,
      };
    } catch {
      const cleaned = sanitizeJsonString(content);
      if (!cleaned) {
        return base;
      }

      // Fallback: try to extract sections from plain text
      const lines = cleaned.split("\n");
      let currentSection: "studyTitle" | "findings" | "impression" | null = null;
      const sections: Record<string, string[]> = {
        studyTitle: [],
        findings: [],
        impression: [],
      };

      for (const line of lines) {
        const upperLine = line.toUpperCase().trim();
        if (upperLine.includes("TITLE") || upperLine.includes("TÍTULO") || upperLine.includes("ESTUDIO")) {
          currentSection = "studyTitle";
        } else if (upperLine.includes("FINDINGS") || upperLine.includes("HALLAZGOS")) {
          currentSection = "findings";
        } else if (upperLine.includes("RESULTS") || upperLine.includes("RESULTADOS")) {
          currentSection = "findings";
        } else if (upperLine.includes("IMPRESSION") || upperLine.includes("IMPRESIÓN") || upperLine.includes("CONCLUSIÓN")) {
          currentSection = "impression";
        } else if (currentSection) {
          sections[currentSection].push(line);
        } else {
          // If no section identified, add to findings as default
          sections.findings.push(line);
        }
      }

      return {
        studyTitle: sections.studyTitle.join("\n").trim() || "",
        findings: sections.findings.join("\n").trim() || cleaned,
        impression: sections.impression.join("\n").trim() || "",
      };
    }
  },
});


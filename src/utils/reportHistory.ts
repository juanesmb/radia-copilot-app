import type { GenerateReportResponse } from "@/types/frontend/api";
import type { Report } from "@/lib/api";
import type { Language } from "@/lib/translations";

export interface ReportMetadata {
  patientName?: string;
}

export interface ReportHistoryItem {
  id: string;
  title: string;
  transcription: string;
  updatedTranscription?: string;
  report: string;
  createdAt: Date;
  usedTemplate?: string;
  templateId?: string | null;
  templateContent?: string | null;
  isCustomTemplate?: boolean | null;
  studyType?: string | null;
  metadata: ReportMetadata;
}

export const extractPatientName = (transcription: string) => {
  if (!transcription) return undefined;

  const pattern = /(?:Patient|Paciente)\s*(?:Name)?:\s*([A-ZÁÉÍÓÚÜÑ][\wÁÉÍÓÚÜÑ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\wÁÉÍÓÚÜÑ]+){0,2})/i;
  const match = transcription.match(pattern);
  if (match) {
    return match[1].trim();
  }

  const firstLine = transcription.split("\n")[0]?.trim();
  if (firstLine && /^[A-ZÁÉÍÓÚÜÑ][\wÁÉÍÓÚÜÑ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\wÁÉÍÓÚÜÑ]+){1,2}$/.test(firstLine)) {
    return firstLine;
  }

  return undefined;
};

interface CreateReportParams {
  response: GenerateReportResponse;
  transcription: string;
  language: Language;
}

export const createReportHistoryItem = ({
  response,
  transcription,
  language,
}: CreateReportParams): ReportHistoryItem => {
  const now = new Date();
  const defaultTitle =
    language === "es" ? "Estudio sin título" : "Untitled study";

  return {
    id: response.report_id,
    title: response.title?.trim() || defaultTitle,
    transcription,
    updatedTranscription: transcription,
    report: response.report?.trim() || "",
    createdAt: now,
    usedTemplate: response.selectedTemplate,
    templateId: response.templateId ?? null,
    studyType: response.studyType ?? response.selectedTemplate ?? null,
    metadata: {
      patientName: extractPatientName(transcription),
    },
  };
};

export const mapReportToHistoryItem = (report: Report): ReportHistoryItem => {
  console.log("[mapReportToHistoryItem] Report data:", {
    report_id: report.report_id,
    study_type: report.study_type,
    used_template: report.used_template,
    is_custom_template: report.is_custom_template,
    template_id: report.template_id,
    has_template_content: !!report.template_content
  });

  // Fix incorrect study_type for custom templates
  // If study_type is "custom" but used_template is also "custom", 
  // we need to infer the original study type from template_id or other means
  let fixedStudyType = report.study_type;
  if (report.study_type === "custom" && report.used_template === "custom") {
    // This is incorrect data - study_type should never be "custom"
    // Try to infer from template_id if available
    if (report.template_id) {
      // For now, we'll set it to null and let the frontend handle it
      fixedStudyType = null;
    }
  }

  // Determine if it's custom based on multiple factors for backwards compatibility
  const isCustom = report.is_custom_template ?? 
    (report.used_template === "custom" && !!report.template_content);

  return {
    id: report.report_id,
    title: report.report_title || "",
    transcription: report.updated_transcription,
    updatedTranscription: report.updated_transcription,
    report: report.updated_report,
    createdAt: new Date(report.created_at),
    usedTemplate: report.used_template,
    templateId: report.template_id ?? null,
    templateContent: report.template_content ?? null,
    isCustomTemplate: isCustom,
    studyType: fixedStudyType,
    metadata: {
      patientName: extractPatientName(report.updated_transcription),
    },
  };
};


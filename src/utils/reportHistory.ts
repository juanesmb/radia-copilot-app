import type { GenerateReportResponse } from "@/types/frontend/api";
import type { Report } from "@/lib/api";
import type { Language } from "@/lib/translations";

export interface ReportMetadata {
  caseId: string;
  patientName?: string;
}

export interface ReportHistoryItem {
  id: string; // report_id from database
  title: string;
  transcription: string;
  report: string;
  createdAt: Date;
  metadata: ReportMetadata;
}

let reportSequence = 1;

export const generateCaseId = () => {
  const year = new Date().getFullYear();
  const padded = String(reportSequence).padStart(3, "0");
  reportSequence = reportSequence >= 999 ? 1 : reportSequence + 1;
  return `RAD-${year}-${padded}`;
};

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
  const caseId = generateCaseId();
  const defaultTitle =
    language === "es" ? "Estudio sin título" : "Untitled study";

  return {
    id: response.report_id, // Use database ID
    title: response.title?.trim() || defaultTitle,
    transcription,
    report: response.report?.trim() || "",
    createdAt: now,
    metadata: {
      caseId,
      patientName: extractPatientName(transcription),
    },
  };
};

export const mapReportToHistoryItem = (report: Report): ReportHistoryItem => {
  const caseId = generateCaseId();
  
  return {
    id: report.report_id,
    title: report.report_title || "",
    transcription: report.updated_transcription,
    report: report.updated_report,
    createdAt: new Date(report.created_at),
    metadata: {
      caseId,
      patientName: extractPatientName(report.updated_transcription),
    },
  };
};


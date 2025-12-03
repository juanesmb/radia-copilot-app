import type { GenerateReportResponse } from "@/types/frontend/api";
import type { Language } from "@/lib/translations";

export interface ReportMetadata {
  caseId: string;
  patientName?: string;
  templatePath?: string;
}

export interface ReportHistoryItem {
  id: string;
  title: string;
  transcription: string;
  findings: string;
  results: string;
  impression: string;
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

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

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
    id: createId(),
    title: response.studyTitle?.trim() || defaultTitle,
    transcription,
    findings: response.findings?.trim() || "",
    results: response.results?.trim() || "",
    impression: response.impression?.trim() || "",
    createdAt: now,
    metadata: {
      caseId,
      patientName: extractPatientName(transcription),
    },
  };
};



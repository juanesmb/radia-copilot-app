import type { Language } from "./language";

export interface GenerateReportRequest {
  transcription: string;
  language: Language;
}

export interface GenerateReportResult {
  studyTitle: string;
  findings: string;
  impression: string;
}


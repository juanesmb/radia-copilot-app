import type { Language } from "@/contexts/LanguageContext";

export interface GenerateReportRequest {
  transcription: string;
  language: Language;
}

export interface GenerateReportResponse {
  studyTitle: string;
  findings: string;
  results: string;
  impression: string;
}

export interface ApiError {
  message: string;
  status?: number;
  details?: string;
}


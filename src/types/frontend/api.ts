import type { Language } from "@/contexts/LanguageContext";

export interface GenerateReportRequest {
  transcription: string;
  language: Language;
}

export interface GenerateReportResponse {
  title: string;
  report: string;
}

export interface ApiError {
  message: string;
  status?: number;
  details?: string;
}


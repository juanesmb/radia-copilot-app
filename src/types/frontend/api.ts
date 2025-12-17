import type { Language } from "@/contexts/LanguageContext";

export interface GenerateReportRequest {
  transcription: string;
  language: Language;
}

export interface GenerateReportResponse {
  report_id: string;
  title: string;
  report: string;
  studyType?: string;
  detectionConfidence?: number;
  modelUsed: string;
}

export interface ApiError {
  message: string;
  status?: number;
  details?: string;
}


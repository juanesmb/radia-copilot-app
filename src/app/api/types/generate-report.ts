import type { Language } from "./language";

export interface GenerateReportRequest {
  transcription: string;
  language: Language;
  studyType?: string;
}

export interface GenerateReportResult {
  title: string;
  report: string;
  studyType?: string;
  detectionConfidence?: number;
  modelUsed?: string;
}


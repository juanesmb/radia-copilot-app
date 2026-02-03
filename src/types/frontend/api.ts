import type { Language } from "@/contexts/LanguageContext";

export interface GenerateReportRequest {
  transcription: string;
  language: Language;
  studyType?: string;
  template?: string;
  isCustomTemplate?: boolean;
  templateId?: string;
  reportId?: string;
}

export interface GenerateReportResponse {
  report_id: string;
  title: string;
  report: string;
  studyType?: string;
  detectionConfidence?: number;
  modelUsed: string;
  selectedTemplate?: string;
  templateId?: string;
}

export interface ApiError {
  message: string;
  status?: number;
  details?: string;
}

export interface StreamChunkEvent {
  type: "chunk";
  content: string;
}

export interface StreamMetadataEvent {
  type: "metadata";
  reportId: string;
  title: string;
  studyType?: string;
  detectionConfidence?: number;
  modelUsed: string;
  selectedTemplate: string;
}

export interface StreamErrorEvent {
  type: "error";
  message: string;
}

export interface StreamDoneEvent {
  type: "done";
  reportId: string;
}


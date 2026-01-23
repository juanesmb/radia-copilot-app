import type { Language } from "./language";

export interface Template {
  template_id: string;
  study_type: string;
  language: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface StudyTypeDetection {
  studyType: string;
  confidence: number;
  reasoning?: string;
  keywords?: string[];
}

export interface GetTemplateContentRequest {
  studyType: string;
  language: Language;
}

export interface GetTemplateContentResponse {
  content: string;
  studyType: string;
  language: string;
}


export interface TemplateMetadata {
  studyType: string;
  modality: string;
  region?: string;
  keywords: string[];
  requiredKeywords?: string[];
  excludeKeywords?: string[];
}

export interface StudyTypeDetection {
  studyType: string;
  confidence: number;
  reasoning?: string;
  keywords?: string[];
}

export interface TemplateSearchResult {
  template: TemplateMetadata;
  score: number;
}



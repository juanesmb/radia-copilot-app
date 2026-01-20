import type { AIClient } from "../clients/aiClient";
import type { GenerateReportRequest } from "../types/generate-report";
import type { Language } from "../types/language";
import { detectStudyType, extractModalityAndRegion } from "./studyTypeDetector";
import {
  loadTemplate,
  loadAllTemplateMetadata,
  templateExists,
} from "./templateLoader";
import { findBestMatchByKeywords } from "./templateSearcher";
import type { PromptModeDetector } from "./promptModeDetector";
import type { PromptStrategy } from "./promptStrategy";

interface PromptResult {
  systemPrompt: string;
  userPrompt: string;
  selectedTemplate: string;
  detection?: {
    studyType: string;
    confidence: number;
    keywords?: string[];
  };
}

export interface PromptBuilder {
  build(input: GenerateReportRequest): Promise<PromptResult>;
}

type Dependencies = {
  aiClient: AIClient;
  modeDetector: PromptModeDetector;
  transcriptionStrategy: PromptStrategy;
  enhancementStrategy: PromptStrategy;
};

const getDefaultTemplate = (language: Language): string => {
  return language === "es"
    ? "ECOGRAFÍA\n\n[Estructura genérica - ajustar según hallazgos]"
    : "ULTRASOUND\n\n[Generic structure - adjust according to findings]";
};

const findTemplateWithFallback = async (
  detection: { studyType: string; keywords?: string[] },
  language: Language
): Promise<{ studyType: string; template: string }> => {
  if (templateExists(detection.studyType, language)) {
    try {
      const template = loadTemplate(detection.studyType, language);
      return { studyType: detection.studyType, template };
    } catch (error) {
      console.warn(
        `Failed to load template "${detection.studyType}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const { modality, region } = extractModalityAndRegion({
    studyType: detection.studyType,
    confidence: 0,
    keywords: detection.keywords,
  });

  const allMetadata = await loadAllTemplateMetadata(language);
  const bestMatch = findBestMatchByKeywords(
    detection.keywords || [],
    modality,
    region,
    allMetadata
  );

  if (bestMatch && bestMatch.score > 0.3) {
    try {
      const template = loadTemplate(bestMatch.template.studyType, language);
      return { studyType: bestMatch.template.studyType, template };
    } catch (error) {
      console.warn(
        `Failed to load fallback template "${bestMatch.template.studyType}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    studyType: "default",
    template: getDefaultTemplate(language),
  };
};

export const createPromptBuilder = (
  deps: Dependencies
): PromptBuilder => ({
  build: async (input) => {
    try {
      // Detect which prompt mode to use
      const mode = deps.modeDetector.detectMode(input.transcription);
      const strategy = mode === 'transcription' 
        ? deps.transcriptionStrategy 
        : deps.enhancementStrategy;

      // Use provided studyType if available, otherwise detect
      let detection: { studyType: string; confidence: number; keywords?: string[] };
      
      if (input.studyType && input.studyType.trim()) {
        // User provided studyType - use it directly
        detection = {
          studyType: input.studyType.trim(),
          confidence: 1.0,
          keywords: [],
        };
      } else if (input.isCustomTemplate && input.template) {
        // Custom template without studyType - use "custom" as studyType
        detection = {
          studyType: "custom",
          confidence: 1.0,
          keywords: [],
        };
      } else {
        // For enhancement mode with empty transcription, we still need a studyType
        // Use provided studyType or try to infer from template if available
        if (mode === 'enhancement' && input.template) {
          // In enhancement mode, try to extract studyType from template or use default
          detection = {
            studyType: input.studyType?.trim() || "default",
            confidence: 1.0,
            keywords: [],
          };
        } else {
          // Run detection (will use empty string for enhancement mode, but that's okay)
          detection = await detectStudyType(
            input.transcription || "",
            input.language,
            deps.aiClient
          );
        }
      }

      // Use provided template if available, otherwise load from filesystem
      let template: string;
      let studyType: string;
      
      if (input.template && input.template.trim()) {
        // Use the template provided by the user (edited in UI)
        template = input.template.trim();
        studyType = detection.studyType;
      } else {
        // Load template from filesystem
        const result = await findTemplateWithFallback(
          detection,
          input.language
        );
        template = result.template;
        studyType = result.studyType;
      }

      // Use strategy to build prompts
      const systemPrompt = await strategy.buildSystemPrompt(input, template, studyType);
      const userPrompt = strategy.buildUserPrompt(input, template);

      return {
        systemPrompt,
        userPrompt,
        selectedTemplate: studyType,
        detection: {
          studyType: detection.studyType,
          confidence: detection.confidence,
          keywords: detection.keywords,
        },
      };
    } catch (error) {
      console.error(
        `Template detection failed: ${error instanceof Error ? error.message : String(error)}`
      );
      const defaultTemplate = getDefaultTemplate(input.language);
      const mode = deps.modeDetector.detectMode(input.transcription);
      const strategy = mode === 'transcription' 
        ? deps.transcriptionStrategy 
        : deps.enhancementStrategy;

      const systemPrompt = await strategy.buildSystemPrompt(
        input,
        defaultTemplate,
        "default"
      );
      const userPrompt = strategy.buildUserPrompt(input, defaultTemplate);

      return {
        systemPrompt,
        userPrompt,
        selectedTemplate: "default",
        detection: undefined,
      };
    }
  },
});


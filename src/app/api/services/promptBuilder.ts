import type { AIClient } from "../clients/aiClient";
import type { GenerateReportRequest } from "../types/generate-report";
import type { Language } from "../types/language";
import { detectStudyType } from "./studyTypeDetector";
import type { TemplateLoader } from "./templateLoader";
import type { PromptModeDetector } from "./promptModeDetector";
import type { PromptStrategy } from "./promptStrategy";
import { HttpError } from "../lib/errorHandler";

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
  templateLoader: TemplateLoader;
};

const loadTemplateByIdentifiedType = async (
  studyType: string,
  language: Language,
  templateLoader: TemplateLoader
): Promise<{ studyType: string; template: string }> => {
  const exists = await templateLoader.templateExists(studyType, language);

  if (!exists) {
    throw new HttpError(
      `Template "${studyType}" not found for language "${language}"`,
      { status: 404 }
    );
  }

  const template = await templateLoader.loadTemplate(studyType, language);
  return { studyType, template };
};

const createDetectionFromInput = (
  input: GenerateReportRequest,
  mode: "transcription" | "enhancement"
): { studyType: string; confidence: number; keywords?: string[] } | null => {
  // For custom templates, use the provided studyType (the original study type)
  if (input.isCustomTemplate && input.template) {
    if (input.studyType?.trim()) {
      return {
        studyType: input.studyType.trim(), // Use the original study type (e.g., "abdomen")
        confidence: 1.0,
        keywords: [],
      };
    }
    // If no studyType provided, we can't determine the original type
    return null;
  }

  if (input.studyType?.trim()) {
    return {
      studyType: input.studyType.trim(),
      confidence: 1.0,
      keywords: [],
    };
  }

  if (mode === "enhancement" && input.template) {
    return {
      studyType: input.studyType?.trim() || "default",
      confidence: 1.0,
      keywords: [],
    };
  }

  return null;
};

export const createPromptBuilder = (
  deps: Dependencies
): PromptBuilder => ({
  build: async (input) => {
    try {
      const mode = deps.modeDetector.detectMode(input.transcription);
      const strategy =
        mode === "transcription"
        ? deps.transcriptionStrategy
          : deps.enhancementStrategy;

      // Determine study type detection
      const manualDetection = createDetectionFromInput(input, mode);
      const detection = manualDetection
        ? manualDetection
        : await detectStudyType(
            input.transcription || "",
            input.language,
            deps.aiClient,
            deps.templateLoader
          );

      // Load template content
      const template = input.template?.trim()
        ? input.template.trim()
        : (
            await loadTemplateByIdentifiedType(
              detection.studyType,
              input.language,
              deps.templateLoader
            )
          ).template;

      const studyType = detection.studyType;

      // Build prompts using strategy
      const systemPrompt = await strategy.buildSystemPrompt(
        input,
        template,
        studyType
      );
      const userPrompt = strategy.buildUserPrompt(input, template);

      // Ensure selectedTemplate is "custom" if isCustomTemplate is true, regardless of detection
      const selectedTemplate = input.isCustomTemplate ? "custom" : studyType;

      return {
        systemPrompt,
        userPrompt,
        selectedTemplate,
        detection: {
          studyType: detection.studyType,
          confidence: detection.confidence,
          keywords: detection.keywords,
        },
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError(
        `Template detection failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { status: 500 }
      );
    }
  },
});

import type { OpenAIClient } from "../clients/openaiClient";
import { getSystemPrompt } from "../lib/prompts";
import type { GenerateReportRequest } from "../types/generate-report";
import type { Language } from "../types/language";
import { detectStudyType, extractModalityAndRegion } from "./studyTypeDetector";
import {
  loadTemplate,
  loadAllTemplateMetadata,
  templateExists,
} from "./templateLoader";
import { findBestMatchByKeywords } from "./templateSearcher";

interface PromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export interface PromptBuilder {
  build(input: GenerateReportRequest): Promise<PromptResult>;
}

const buildUserPrompt = (transcription: string, language: Language): string => {
  const instructions =
    language === "en"
      ? "Summarize the dictation, draft organized findings, and finish with an actionable impression."
      : "Resume la dictación, redacta hallazgos organizados y finaliza con una conclusión accionable.";

  return `
${instructions}

Transcription:
"""
${transcription}
"""
`.trim();
};

const replaceTemplateInPrompt = (
  basePrompt: string,
  template: string,
  studyType: string,
  language: Language
): string => {
  const title = language === "es"
    ? `## Plantilla de referencia: ${studyType}`
    : `## Reference template: ${studyType}`;

  const instruction = language === "es"
    ? "**ESTRUCTURA OBLIGATORIA A SEGUIR (modifica solo lo mencionado en la transcripción):**"
    : "**MANDATORY STRUCTURE TO FOLLOW (modify only what is mentioned in the transcription):**";

  const replacement = `${title}\n\n${instruction}\n\n\`\`\`\n${template}\n\`\`\``;

  const regex = /## Plantilla de referencia:[\s\S]*?```/;
  const englishRegex = /## Reference template:[\s\S]*?```/;

  if (language === "es") {
    return basePrompt.replace(regex, replacement);
  }
  return basePrompt.replace(englishRegex, replacement);
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
  openAIClient: OpenAIClient
): PromptBuilder => ({
  build: async (input) => {
    const basePrompt = getSystemPrompt(input.language);

    try {
      const detection = await detectStudyType(
        input.transcription,
        input.language,
        openAIClient
      );

      const { studyType, template } = await findTemplateWithFallback(
        detection,
        input.language
      );

      const enrichedPrompt = replaceTemplateInPrompt(
        basePrompt,
        template,
        studyType,
        input.language
      );

      return {
        systemPrompt: enrichedPrompt,
        userPrompt: buildUserPrompt(input.transcription, input.language),
      };
    } catch (error) {
      console.error(
        `Template detection failed: ${error instanceof Error ? error.message : String(error)}`
      );
      const defaultTemplate = getDefaultTemplate(input.language);
      const enrichedPrompt = replaceTemplateInPrompt(
        basePrompt,
        defaultTemplate,
        "default",
        input.language
      );

      return {
        systemPrompt: enrichedPrompt,
        userPrompt: buildUserPrompt(input.transcription, input.language),
      };
    }
  },
});


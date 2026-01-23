import type { AIClient } from "../clients/aiClient";
import type { Language } from "../types/language";
import type { StudyTypeDetection } from "../types/template";
import type { TemplateLoader } from "./templateLoader";
import { HttpError } from "../lib/errorHandler";

const SYSTEM_MESSAGES = {
  es: "Eres un clasificador experto de tipos de estudios radiológicos. Debes distinguir cuidadosamente entre estudios completos del abdomen (ct-abdomen) y estudios específicos del tracto urinario (ct-uro). Si la transcripción menciona múltiples órganos abdominales (hígado, bazo, páncreas, etc.), es ct-abdomen. Solo elige ct-uro si el estudio se enfoca exclusivamente en el sistema urinario. Responde únicamente con JSON válido.",
  en: "You are an expert radiological study type classifier. You must carefully distinguish between comprehensive abdomen studies (ct-abdomen) and specific urinary tract studies (ct-uro). If the transcription mentions multiple abdominal organs (liver, spleen, pancreas, etc.), it's ct-abdomen. Only choose ct-uro if the study focuses exclusively on the urinary system. Respond only with valid JSON.",
} as const;

const buildDetectionPrompt = (
  transcription: string,
  availableTemplates: string[],
  language: Language
): string => {
  const templatesList = availableTemplates.map((t) => `- ${t}`).join("\n");

  if (language === "es") {
    return `Analiza la siguiente transcripción médica y determina qué tipo de estudio radiológico es.

IMPORTANTE - Diferencias clave:
- "ct-abdomen" (TC de Abdomen): Estudio COMPLETO del abdomen que incluye múltiples órganos (hígado, bazo, páncreas, riñones, glándulas adrenales, vesícula biliar, retroperitoneo, pelvis, etc.). Si la transcripción menciona hallazgos en múltiples órganos abdominales, es ct-abdomen.
- "ct-uro" (Urotomografía): Estudio ESPECÍFICO y EXCLUSIVO del tracto urinario (solo riñones, uréteres, vejiga). Solo elige ct-uro si la transcripción se enfoca ÚNICAMENTE en el sistema urinario sin mencionar otros órganos abdominales.

Transcripción:
"""
${transcription}
"""

Plantillas disponibles (usa EXACTAMENTE estos nombres):
${templatesList}

Responde ÚNICAMENTE con JSON válido:
{
  "studyType": "<nombre exacto de la plantilla que mejor corresponde>",
  "confidence": <número entre 0 y 1>,
  "reasoning": "<breve explicación de por qué elegiste este tipo, mencionando qué órganos se mencionan>",
  "keywords": ["palabra1", "palabra2", "..."]
}`;
  }

  return `Analyze the following medical transcription and determine what type of radiological study it is.

IMPORTANT - Key differences:
- "ct-abdomen" (CT Abdomen): COMPREHENSIVE study of the abdomen including multiple organs (liver, spleen, pancreas, kidneys, adrenal glands, gallbladder, retroperitoneum, pelvis, etc.). If the transcription mentions findings in multiple abdominal organs, it's ct-abdomen.
- "ct-uro" (Urotomography): SPECIFIC and EXCLUSIVE study of the urinary tract (only kidneys, ureters, bladder). Only choose ct-uro if the transcription focuses EXCLUSIVELY on the urinary system without mentioning other abdominal organs.

Transcription:
"""
${transcription}
"""

Available templates (use EXACTLY these names):
${templatesList}

Respond ONLY with valid JSON:
{
  "studyType": "<exact template name that best matches>",
  "confidence": <number between 0 and 1>,
  "reasoning": "<brief explanation of why you chose this type, mentioning which organs are mentioned>",
  "keywords": ["word1", "word2", "..."]
}`;
};

/**
 * Extracts JSON from a response that may contain markdown code blocks or other text
 */
const extractJsonFromResponse = (response: string): string => {
  let cleaned = response.trim();

  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
  cleaned = cleaned.replace(/^```\s*/i, "").replace(/```\s*$/, "");

  // Try to find JSON object boundaries
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  // Fix common JSON issues
  // Remove trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

  return cleaned.trim();
};

/**
 * Attempts to fix common JSON parsing issues
 */
const fixJsonIssues = (jsonString: string): string => {
  let fixed = jsonString;

  // Remove trailing commas before closing braces/brackets
  fixed = fixed.replace(/,(\s*[}\]])/g, "$1");

  return fixed;
};

const parseDetectionResponse = (response: string): StudyTypeDetection => {
  try {
    let cleaned = extractJsonFromResponse(response);

    // First attempt: parse as-is
    try {
      const parsed = JSON.parse(cleaned) as StudyTypeDetection;
      return parsed;
    } catch (firstError) {
      // Second attempt: try fixing common issues
      try {
        const fixed = fixJsonIssues(cleaned);
        const parsed = JSON.parse(fixed) as StudyTypeDetection;
        return parsed;
      } catch (secondError) {
        // Log the problematic response for debugging
        console.error("[StudyTypeDetector] Failed to parse JSON response:", {
          original: response.substring(0, 200),
          cleaned: cleaned.substring(0, 200),
          firstError: firstError instanceof Error ? firstError.message : String(firstError),
          secondError: secondError instanceof Error ? secondError.message : String(secondError),
        });

        throw new HttpError(
          `Failed to parse AI detection response. The model returned invalid JSON. Please try again.`,
          {
            status: 500,
            details: {
              parsingError: secondError instanceof Error ? secondError.message : String(secondError),
              responsePreview: response.substring(0, 500),
            },
          }
        );
      }
    }
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unknown parsing error";
    throw new HttpError(`Failed to parse detection response: ${message}`, {
      status: 500,
      details: error instanceof Error ? message : undefined,
    });
  }
};

export const detectStudyType = async (
  transcription: string,
  language: Language,
  aiClient: AIClient,
  templateLoader: TemplateLoader
): Promise<StudyTypeDetection> => {
  const availableTemplates = await templateLoader.listAvailableTemplates(language);

  if (availableTemplates.length === 0) {
    throw new HttpError(`No templates available for language "${language}"`, {
      status: 404,
    });
  }

  const prompt = buildDetectionPrompt(transcription, availableTemplates, language);
  const systemMessage = SYSTEM_MESSAGES[language];

  const response = await aiClient.generateCompletion([
    { role: "system", content: systemMessage },
    { role: "user", content: prompt },
  ]);

  const detection = parseDetectionResponse(response);

  // Validate and normalize the detection result
  if (!detection.studyType || typeof detection.studyType !== "string") {
    throw new HttpError("Invalid detection response: missing or invalid studyType", {
      status: 500,
    });
  }

  if (typeof detection.confidence !== "number" || detection.confidence < 0 || detection.confidence > 1) {
    detection.confidence = 0.5; // Default confidence if invalid
  }

  // Ensure keywords array exists
  if (!Array.isArray(detection.keywords)) {
    detection.keywords = [];
  }

  return detection;
};

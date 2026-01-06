import type { OpenAIClient } from "../clients/openaiClient";
import type { Language } from "../types/language";
import type { StudyTypeDetection } from "../types/template";
import { listAvailableTemplates } from "./templateLoader";

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

const parseDetectionResponse = (response: string): StudyTypeDetection => {
  try {
    const cleaned = response.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned) as StudyTypeDetection;
    return parsed;
  } catch (error) {
    throw new Error(
      `Failed to parse detection response: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const extractModalityFromKeywords = (keywords: string[] | undefined): string | undefined => {
  if (!keywords || keywords.length === 0) {
    return undefined;
  }

  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  
  if (lowerKeywords.some((k) => k.includes("doppler") || k.includes("ecodoppler"))) {
    return "ecodoppler";
  }
  if (lowerKeywords.some((k) => k.includes("tomografía") || k.includes("ct") || k.includes("tc"))) {
    return "ct";
  }
  if (lowerKeywords.some((k) => k.includes("mri") || k.includes("resonancia"))) {
    return "mri";
  }
  if (lowerKeywords.some((k) => k.includes("rayos") || k.includes("radiografía") || k.includes("xray"))) {
    return "xray";
  }
  if (lowerKeywords.some((k) => k.includes("ecografía") || k.includes("ultrasound") || k.includes("ultrasonido"))) {
    return "ultrasound";
  }

  return undefined;
};

const extractRegionFromKeywords = (keywords: string[] | undefined): string | undefined => {
  if (!keywords || keywords.length === 0) {
    return undefined;
  }

  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  
  if (lowerKeywords.some((k) => k.includes("abdomen") || k.includes("abdominal"))) {
    return "abdomen";
  }
  if (lowerKeywords.some((k) => k.includes("tórax") || k.includes("chest") || k.includes("pulmón"))) {
    return "chest";
  }
  if (lowerKeywords.some((k) => k.includes("cerebro") || k.includes("brain") || k.includes("craneal"))) {
    return "brain";
  }
  if (lowerKeywords.some((k) => k.includes("testicular") || k.includes("testículo"))) {
    return "testicular";
  }
  if (lowerKeywords.some((k) => k.includes("renal") || k.includes("riñón"))) {
    return "renal";
  }
  if (lowerKeywords.some((k) => k.includes("miembros inferiores") || k.includes("lower limbs"))) {
    return "lower limbs";
  }

  return undefined;
};

export const detectStudyType = async (
  transcription: string,
  language: Language,
  openAIClient: OpenAIClient
): Promise<StudyTypeDetection> => {
  const availableTemplates = listAvailableTemplates(language);

  if (availableTemplates.length === 0) {
    throw new Error(`No templates available for language "${language}"`);
  }

  const prompt = buildDetectionPrompt(transcription, availableTemplates, language);

  const systemMessage = language === "es"
    ? "Eres un clasificador experto de tipos de estudios radiológicos. Debes distinguir cuidadosamente entre estudios completos del abdomen (ct-abdomen) y estudios específicos del tracto urinario (ct-uro). Si la transcripción menciona múltiples órganos abdominales (hígado, bazo, páncreas, etc.), es ct-abdomen. Solo elige ct-uro si el estudio se enfoca exclusivamente en el sistema urinario. Responde únicamente con JSON válido."
    : "You are an expert radiological study type classifier. You must carefully distinguish between comprehensive abdomen studies (ct-abdomen) and specific urinary tract studies (ct-uro). If the transcription mentions multiple abdominal organs (liver, spleen, pancreas, etc.), it's ct-abdomen. Only choose ct-uro if the study focuses exclusively on the urinary system. Respond only with valid JSON.";

  const response = await openAIClient.generateCompletion([
    { role: "system", content: systemMessage },
    { role: "user", content: prompt },
  ]);

  const detection = parseDetectionResponse(response);

  if (!detection.keywords) {
    detection.keywords = [];
  }

  return detection;
};

export const extractModalityAndRegion = (
  detection: StudyTypeDetection
): { modality: string | undefined; region: string | undefined } => {
  return {
    modality: extractModalityFromKeywords(detection.keywords),
    region: extractRegionFromKeywords(detection.keywords),
  };
};


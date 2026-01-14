import { getSystemPrompt } from "../lib/prompts";
import type { GenerateReportRequest } from "../types/generate-report";
import type { Language } from "../types/language";
import type { PromptStrategy } from "./promptStrategy";

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

  if (!template || template.trim().length === 0) {
    console.error(`❌ Template is empty for studyType: ${studyType}, language: ${language}`);
  }

  const replacement = `${title}\n\n${instruction}\n\n\`\`\`\n${template}\n\`\`\``;

  if (language === "es") {
    // Spanish: Replace the section from "PLANTILLA:" through the closing code block
    const plantillaIndex = basePrompt.indexOf("PLANTILLA:");
    if (plantillaIndex === -1) {
      console.error("❌ Could not find 'PLANTILLA:' in prompt");
      return basePrompt;
    }
    
    // Find the code block that starts after PLANTILLA:
    const afterPlantilla = basePrompt.substring(plantillaIndex);
    const codeBlockStart = afterPlantilla.indexOf("```");
    if (codeBlockStart === -1) {
      console.error("❌ Could not find code block start after 'PLANTILLA:'");
      return basePrompt;
    }
    
    // Find the closing ``` of the code block
    const codeBlockContent = afterPlantilla.substring(codeBlockStart + 3);
    const codeBlockEnd = codeBlockContent.indexOf("```");
    if (codeBlockEnd === -1) {
      console.error("❌ Could not find code block end");
      return basePrompt;
    }
    
    // Calculate the end position (plantillaIndex + codeBlockStart + 3 + codeBlockEnd + 3)
    const endIndex = plantillaIndex + codeBlockStart + 3 + codeBlockEnd + 3;
    
    // Replace the section
    const before = basePrompt.substring(0, plantillaIndex);
    const after = basePrompt.substring(endIndex);
    return before + replacement + after;
  }
  
  // English: Replace the section from "TEMPLATE:" through the closing code block
  const templateIndex = basePrompt.indexOf("TEMPLATE:");
  if (templateIndex === -1) {
    console.error("❌ Could not find 'TEMPLATE:' in prompt");
    return basePrompt;
  }
  
  // Find the code block that starts after TEMPLATE:
  const afterTemplate = basePrompt.substring(templateIndex);
  const codeBlockStart = afterTemplate.indexOf("```");
  if (codeBlockStart === -1) {
    console.error("❌ Could not find code block start after 'TEMPLATE:'");
    return basePrompt;
  }
  
  // Find the closing ``` of the code block
  const codeBlockContent = afterTemplate.substring(codeBlockStart + 3);
  const codeBlockEnd = codeBlockContent.indexOf("```");
  if (codeBlockEnd === -1) {
    console.error("❌ Could not find code block end");
    return basePrompt;
  }
  
  // Calculate the end position (templateIndex + codeBlockStart + 3 + codeBlockEnd + 3)
  const endIndex = templateIndex + codeBlockStart + 3 + codeBlockEnd + 3;
  
  // Replace the section
  const before = basePrompt.substring(0, templateIndex);
  const after = basePrompt.substring(endIndex);
  return before + replacement + after;
};

export const createTranscriptionPromptStrategy = (): PromptStrategy => ({
  async buildSystemPrompt(
    input: GenerateReportRequest,
    template: string,
    studyType: string
  ): Promise<string> {
    const basePrompt = getSystemPrompt(input.language);
    return replaceTemplateInPrompt(basePrompt, template, studyType, input.language);
  },

  buildUserPrompt(input: GenerateReportRequest, _template: string): string {
    return input.transcription.trim();
  },
});

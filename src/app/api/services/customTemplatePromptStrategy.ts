import { getCustomTemplatePrompt } from "../lib/prompts";
import type { GenerateReportRequest } from "../types/generate-report";
import type { PromptStrategy } from "./promptStrategy";

export const createCustomTemplatePromptStrategy = (): PromptStrategy => ({
  async buildSystemPrompt(
    input: GenerateReportRequest,
    template: string,
    _studyType: string
  ): Promise<string> {
    // Get the base custom template prompt
    const basePrompt = getCustomTemplatePrompt(input.language);
    
    // Add the custom template to the prompt
    const templateSection = input.language === 'es'
      ? `## Plantilla personalizada\n\nA continuación se muestra la plantilla personalizada que debes seguir al generar el informe. Mantén la estructura, formato y estilo exactos de la plantilla.\n\n\`\`\`\n${template}\n\`\`\``
      : `## Custom Template\n\nBelow is the custom template you must follow when generating the report. Maintain the exact structure, format, and style of the template.\n\n\`\`\`\n${template}\n\`\`\``;

    return `${basePrompt}\n\n${templateSection}`;
  },

  buildUserPrompt(input: GenerateReportRequest, _template: string): string {
    // For custom templates, we include the transcription as is
    return input.transcription.trim();
  },
});

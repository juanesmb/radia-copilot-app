import type { Language } from "../types/language";
import type { TemplateRepository } from "../repositories/templateRepository";
import { HttpError } from "../lib/errorHandler";

export interface TemplateLoader {
  templateExists(studyType: string, language: Language): Promise<boolean>;
  loadTemplate(studyType: string, language: Language): Promise<string>;
  listAvailableTemplates(language: Language): Promise<string[]>;
}

type Dependencies = {
  templateRepository: TemplateRepository;
};

export const createTemplateLoader = (deps: Dependencies): TemplateLoader => {
  const { templateRepository } = deps;

  return {
    templateExists: (studyType: string, language: Language) =>
      templateRepository.templateExists(studyType, language),

    async loadTemplate(studyType: string, language: Language): Promise<string> {
      console.log(`[TemplateLoader] Loading template: studyType="${studyType}", language="${language}"`);
      
      const template = await templateRepository.getSystemTemplate(studyType, language);

      if (!template) {
        console.error(`[TemplateLoader] Template NOT found: studyType="${studyType}", language="${language}"`);
        throw new HttpError(
          `Template "${studyType}" not found for language "${language}"`,
          { status: 404 }
        );
      }

      console.log(`[TemplateLoader] Template found: studyType="${studyType}", contentLength=${template.content.length}`);
      return template.content.trim();
    },

    listAvailableTemplates: async (language: Language) => {
      const templates = await templateRepository.listAvailableTemplates(language);
      console.log(`[TemplateLoader] Available templates for language "${language}":`, templates);
      return templates;
    },
  };
};

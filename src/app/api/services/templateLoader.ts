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
      const template = await templateRepository.getTemplate(studyType, language);

      if (!template) {
        throw new HttpError(
          `Template "${studyType}" not found for language "${language}"`,
          { status: 404 }
        );
      }

      return template.content.trim();
    },

    listAvailableTemplates: (language: Language) =>
      templateRepository.listAvailableTemplates(language),
  };
};

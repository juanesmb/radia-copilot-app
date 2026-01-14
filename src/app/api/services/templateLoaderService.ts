import type { Language } from "../types/language";
import { loadTemplate } from "./templateLoader";

export interface TemplateLoader {
  loadTemplate(
    studyType: string,
    language: Language,
    customContent?: string | null
  ): Promise<string>;
}

export interface TemplateLoaderStrategy {
  canLoad(studyType: string, customContent?: string | null): boolean;
  load(
    studyType: string,
    language: Language,
    customContent?: string | null
  ): Promise<string>;
}

// Database strategy (for custom templates)
export const createDatabaseTemplateStrategy = (): TemplateLoaderStrategy => ({
  canLoad: (studyType, customContent) =>
    customContent !== null &&
    customContent !== undefined &&
    customContent.trim().length > 0,
  load: async (studyType, language, customContent) => {
    if (!customContent) {
      throw new Error("Custom content not provided");
    }
    return customContent;
  },
});

// Filesystem strategy (for predefined templates)
export const createFilesystemTemplateStrategy = (): TemplateLoaderStrategy => ({
  canLoad: (studyType, customContent) =>
    !customContent || customContent.trim().length === 0,
  load: async (studyType, language) => {
    // Use existing loadTemplate from templateLoader
    return loadTemplate(studyType, language);
  },
});

export const createTemplateLoaderService = (
  strategies: TemplateLoaderStrategy[]
): TemplateLoader => ({
  loadTemplate: async (studyType, language, customContent) => {
    const strategy = strategies.find((s) => s.canLoad(studyType, customContent));
    if (!strategy) {
      throw new Error(
        `No template loader strategy found for studyType: ${studyType}`
      );
    }
    return strategy.load(studyType, language, customContent);
  },
});

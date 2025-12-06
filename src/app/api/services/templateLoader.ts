import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import type { Language } from "../types/language";
import type { TemplateMetadata } from "../types/template";

type TemplateCache = Map<string, string>;
type MetadataCache = Map<string, TemplateMetadata>;

const templateCache: TemplateCache = new Map();
const metadataCache: MetadataCache = new Map();

const getTemplatesDirectory = (language: Language): string => {
  return join(process.cwd(), "src/app/api/templates", language);
};

const getTemplatePath = (studyType: string, language: Language): string => {
  const templatesDir = getTemplatesDirectory(language);
  return join(templatesDir, `${studyType}.md`);
};

const getMetadataPath = (studyType: string, language: Language): string => {
  const templatesDir = getTemplatesDirectory(language);
  return join(templatesDir, `${studyType}.metadata.json`);
};

const getCacheKey = (studyType: string, language: Language): string => {
  return `${studyType}-${language}`;
};

export const templateExists = (studyType: string, language: Language): boolean => {
  const templatePath = getTemplatePath(studyType, language);
  return existsSync(templatePath);
};

export const loadTemplate = (studyType: string, language: Language): string => {
  const cacheKey = getCacheKey(studyType, language);

  if (templateCache.has(cacheKey)) {
    return templateCache.get(cacheKey)!;
  }

  try {
    const templatePath = getTemplatePath(studyType, language);
    const content = readFileSync(templatePath, "utf-8").trim();
    templateCache.set(cacheKey, content);
    return content;
  } catch (error) {
    throw new Error(
      `Failed to load template "${studyType}" for language "${language}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

export const loadTemplateMetadata = (
  studyType: string,
  language: Language
): TemplateMetadata | null => {
  const cacheKey = getCacheKey(studyType, language);

  if (metadataCache.has(cacheKey)) {
    return metadataCache.get(cacheKey)!;
  }

  try {
    const metadataPath = getMetadataPath(studyType, language);
    if (!existsSync(metadataPath)) {
      return null;
    }

    const content = readFileSync(metadataPath, "utf-8");
    const metadata = JSON.parse(content) as TemplateMetadata;
    metadataCache.set(cacheKey, metadata);
    return metadata;
  } catch (error) {
    console.warn(
      `Failed to load metadata for "${studyType}" (${language}): ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
};

export const loadAllTemplateMetadata = async (
  language: Language
): Promise<TemplateMetadata[]> => {
  const templatesDir = getTemplatesDirectory(language);
  if (!existsSync(templatesDir)) {
    return [];
  }

  const files = readdirSync(templatesDir);
  const metadataFiles = files.filter((file) => file.endsWith(".metadata.json"));

  const metadataPromises = metadataFiles.map((file) => {
    const studyType = file.replace(".metadata.json", "");
    return loadTemplateMetadata(studyType, language);
  });

  const metadataResults = await Promise.all(metadataPromises);
  return metadataResults.filter((meta): meta is TemplateMetadata => meta !== null);
};

export const listAvailableTemplates = (language: Language): string[] => {
  const templatesDir = getTemplatesDirectory(language);
  if (!existsSync(templatesDir)) {
    return [];
  }

  const files = readdirSync(templatesDir);
  return files
    .filter((file) => file.endsWith(".md") && !file.endsWith(".metadata.md"))
    .map((file) => file.replace(".md", ""));
};


import type { TemplateMetadata, TemplateSearchResult } from "../types/template";

const calculateKeywordScore = (
  extractedKeywords: string[],
  templateKeywords: string[]
): number => {
  if (extractedKeywords.length === 0) {
    return 0;
  }

  const lowerExtracted = extractedKeywords.map((k) => k.toLowerCase());
  const lowerTemplate = templateKeywords.map((k) => k.toLowerCase());

  const matches = lowerExtracted.filter((keyword) =>
    lowerTemplate.some(
      (templateKeyword) =>
        templateKeyword.includes(keyword) || keyword.includes(templateKeyword)
    )
  ).length;

  return matches / extractedKeywords.length;
};

const calculateModalityScore = (
  extractedModality: string | undefined,
  templateModality: string
): number => {
  if (!extractedModality) {
    return 0;
  }
  return extractedModality.toLowerCase() === templateModality.toLowerCase() ? 1 : 0;
};

const calculateRegionScore = (
  extractedRegion: string | undefined,
  templateRegion: string | undefined
): number => {
  if (!extractedRegion || !templateRegion) {
    return 0;
  }
  return extractedRegion.toLowerCase() === templateRegion.toLowerCase() ? 1 : 0;
};

const checkRequiredKeywords = (
  extractedKeywords: string[],
  requiredKeywords: string[] | undefined
): boolean => {
  if (!requiredKeywords || requiredKeywords.length === 0) {
    return true;
  }

  const lowerExtracted = extractedKeywords.map((k) => k.toLowerCase());
  return requiredKeywords.every((required) =>
    lowerExtracted.some((extracted) =>
      extracted.includes(required.toLowerCase()) ||
      required.toLowerCase().includes(extracted)
    )
  );
};

const checkExcludeKeywords = (
  extractedKeywords: string[],
  excludeKeywords: string[] | undefined
): boolean => {
  if (!excludeKeywords || excludeKeywords.length === 0) {
    return false;
  }

  const lowerExtracted = extractedKeywords.map((k) => k.toLowerCase());
  return excludeKeywords.some((exclude) =>
    lowerExtracted.some((extracted) =>
      extracted.includes(exclude.toLowerCase()) ||
      exclude.toLowerCase().includes(extracted)
    )
  );
};

export const findBestMatchByKeywords = (
  extractedKeywords: string[],
  extractedModality: string | undefined,
  extractedRegion: string | undefined,
  allMetadata: TemplateMetadata[]
): TemplateSearchResult | null => {
  if (allMetadata.length === 0) {
    return null;
  }

  const results: TemplateSearchResult[] = allMetadata
    .map((template) => {
      const hasRequired = checkRequiredKeywords(extractedKeywords, template.requiredKeywords);
      const hasExclude = checkExcludeKeywords(extractedKeywords, template.excludeKeywords);

      if (!hasRequired || hasExclude) {
        return { template, score: 0 };
      }

      const keywordScore = calculateKeywordScore(extractedKeywords, template.keywords);
      const modalityScore = calculateModalityScore(extractedModality, template.modality);
      const regionScore = calculateRegionScore(extractedRegion, template.region);

      const totalScore =
        keywordScore * 0.5 + modalityScore * 0.3 + regionScore * 0.2;

      return { template, score: totalScore };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);

  return results.length > 0 ? results[0] : null;
};


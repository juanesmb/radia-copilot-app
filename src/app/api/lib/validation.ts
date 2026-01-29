import { z } from "zod";

import type { GenerateReportRequest } from "../types/generate-report";

const generateReportSchema = z.object({
  transcription: z
    .string()
    .trim()
    .max(4000, "Transcription is too long.")
    .default(""),
  language: z.enum(["en", "es"]).default("en"),
  studyType: z.string().min(1, "Study type (template) is required.").optional(),
  template: z.string().optional(),
  isCustomTemplate: z.boolean().optional(),
  templateId: z.string().optional(),
  reportId: z.string().optional(),
}).refine((data) => {
  // Either studyType must be provided, or isCustomTemplate must be true with template provided
  return data.studyType || (data.isCustomTemplate && data.template && data.template.trim().length > 0);
}, {
  message: "Either a study type or a custom template is required.",
});

export type ValidationSuccess = {
  success: true;
  data: GenerateReportRequest;
};

export type ValidationError = {
  success: false;
  message: string;
};

export const validateGenerateReportRequest = (
  payload: unknown,
): ValidationSuccess | ValidationError => {
  const result = generateReportSchema.safeParse(payload);
  if (!result.success) {
    const issue = result.error.issues.at(0);
    return {
      success: false,
      message: issue?.message ?? "Invalid input payload.",
    };
  }

  return {
    success: true,
    data: result.data,
  };
};


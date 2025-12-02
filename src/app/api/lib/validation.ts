import { z } from "zod";

import type { GenerateReportRequest } from "../types/generate-report";

const generateReportSchema = z.object({
  transcription: z
    .string()
    .trim()
    .min(10, "Transcription must include at least 10 characters.")
    .max(4000, "Transcription is too long."),
  language: z.enum(["en", "es"]).default("en"),
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


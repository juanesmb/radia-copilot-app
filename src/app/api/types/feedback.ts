import { z } from "zod";

export const feedbackSchema = z.object({
  reportId: z.string().uuid("Invalid report ID format."),
  confidence: z
    .number()
    .int("Confidence must be an integer.")
    .min(1, "Confidence must be at least 1.")
    .max(5, "Confidence must be at most 5."),
  reason: z.string().trim().max(1000, "Reason is too long.").optional().nullable(),
});

export type FeedbackRequest = z.infer<typeof feedbackSchema>;

export type ValidationSuccess = {
  success: true;
  data: FeedbackRequest;
};

export type ValidationError = {
  success: false;
  message: string;
};

export const validateFeedbackRequest = (
  payload: unknown,
): ValidationSuccess | ValidationError => {
  const result = feedbackSchema.safeParse(payload);
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


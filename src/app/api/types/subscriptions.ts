import { z } from "zod";

export const subscriptionPlanSchema = z.enum(["pro"]);

export const createSubscriptionSchema = z.object({
  plan: subscriptionPlanSchema,
});

export type CreateSubscriptionRequest = z.infer<typeof createSubscriptionSchema>;

export type ValidationSuccess = {
  success: true;
  data: CreateSubscriptionRequest;
};

export type ValidationError = {
  success: false;
  message: string;
};

export const validateCreateSubscriptionRequest = (
  payload: unknown,
): ValidationSuccess | ValidationError => {
  const result = createSubscriptionSchema.safeParse(payload);
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

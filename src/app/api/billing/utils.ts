import { billingPlans, type BillingPlanConfig } from "./planConfig";

export const findPlanByProductId = (productId: string | null | undefined): BillingPlanConfig | null => {
  if (!productId) return null;
  return billingPlans.find((plan) => plan.productId === productId) ?? null;
};

export const findPlanByKey = (planKey: string | null | undefined): BillingPlanConfig | null => {
  if (!planKey) return null;
  return billingPlans.find((plan) => plan.key === planKey) ?? null;
};

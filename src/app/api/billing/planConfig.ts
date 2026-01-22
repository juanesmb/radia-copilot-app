export type BillingPlanKey = "pro" | "business" | "enterprise";

export interface BillingPlanConfig {
  key: BillingPlanKey;
  label: string;
  description: string;
  productId: string;
}

export const billingPlans: BillingPlanConfig[] = [
  {
    key: "pro",
    label: "Pro",
    description: "Para profesionales individuales y pequeños equipos.",
    productId: "prod_Tq3Yn7EvOlKe8S",
  },
  {
    key: "business",
    label: "Business",
    description: "Flujos avanzados para equipos clínicos y admins.",
    productId: "prod_Tq3ZQIC0BjM7DM",
  },
  {
    key: "enterprise",
    label: "Enterprise",
    description: "Implementación completa con soporte prioritario.",
    productId: "prod_Tq3ay1W5buWBkv",
  },
];

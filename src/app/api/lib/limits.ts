import { z } from "zod";

import rawLimits from "@/lib/limits.json";

const limitsSchema = z.object({
  free: z.object({
    monthly: z.object({
      reports: z.number().int().nonnegative(),
      chatTokens: z.number().int().nonnegative(),
    }),
  }),
});

export type AppLimits = z.infer<typeof limitsSchema>;

export const getAppLimits = (): AppLimits => {
  return limitsSchema.parse(rawLimits);
};

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { createSupabaseClient } from "../../clients/supabaseClient";
import { getAppLimits } from "../../lib/limits";
import { mapErrorToResponse } from "../../lib/errorHandler";
import { createSubscriptionRepository } from "../../repositories/subscriptionRepository";
import { createUserMonthlyUsageRepository } from "../../repositories/userMonthlyUsageRepository";

type UsageStage = "ok" | "half" | "one_left" | "low" | "reached";

const clampNonNegativeInt = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

const computeReportStage = (used: number, limit: number): UsageStage => {
  if (limit <= 0) return "reached";
  if (used >= limit) return "reached";
  const remaining = limit - used;
  if (remaining === 1) return "one_left";
  if (used >= Math.ceil(limit / 2)) return "half";
  return "ok";
};

const computeChatTokenStage = (used: number, limit: number): UsageStage => {
  if (limit <= 0) return "reached";
  if (used >= limit) return "reached";
  const remaining = limit - used;
  if (remaining <= 1000) return "low";
  if (used >= Math.ceil(limit / 2)) return "half";
  return "ok";
};

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const supabaseClient = createSupabaseClient({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    });

    const subscriptionRepository = createSubscriptionRepository({
      supabaseClient: supabaseClient.getClient(),
    });

    const usageRepository = createUserMonthlyUsageRepository({
      supabaseClient: supabaseClient.getClient(),
    });

    const limits = getAppLimits();

    const subscription = await subscriptionRepository.getLatestByUserId(userId);
    const isPaidUser = subscription?.status === "active";

    if (isPaidUser) {
      return NextResponse.json(
        {
          isPaidUser: true,
          reports: {
            stage: "ok" as const,
          },
          chatTokens: {
            stage: "ok" as const,
          },
        },
        { status: 200 }
      );
    }

    const usage = await usageRepository.getOrCreate(userId);

    const reportLimit = clampNonNegativeInt(limits.free.monthly.reports);
    const reportUsed = clampNonNegativeInt(usage.report_count);
    const reportRemaining = Math.max(0, reportLimit - reportUsed);
    const reportPercentUsed = reportLimit > 0 ? reportUsed / reportLimit : 1;

    const chatLimit = clampNonNegativeInt(limits.free.monthly.chatTokens);
    const chatUsed = clampNonNegativeInt(usage.chat_token_count);
    const chatRemaining = Math.max(0, chatLimit - chatUsed);
    const chatPercentUsed = chatLimit > 0 ? chatUsed / chatLimit : 1;

    const reportStage = computeReportStage(reportUsed, reportLimit);
    const chatStage = computeChatTokenStage(chatUsed, chatLimit);

    return NextResponse.json(
      {
        isPaidUser: false,
        reports: {
          used: reportUsed,
          limit: reportLimit,
          remaining: reportRemaining,
          percentUsed: reportPercentUsed,
          stage: reportStage,
        },
        chatTokens: {
          used: chatUsed,
          limit: chatLimit,
          remaining: chatRemaining,
          percentUsed: chatPercentUsed,
          stage: chatStage,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[usage/monthly] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

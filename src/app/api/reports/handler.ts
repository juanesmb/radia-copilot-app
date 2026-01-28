import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "../clients/supabaseClient";
import { getAppLimits } from "../lib/limits";
import { mapErrorToResponse } from "../lib/errorHandler";
import { createSubscriptionRepository } from "../repositories/subscriptionRepository";
import { createUserMonthlyUsageRepository } from "../repositories/userMonthlyUsageRepository";
import { createReportRepository } from "../repositories/reportRepository";
import { createCreateReportUseCase, createGetReportsUseCase } from "./usecase";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const reportRepository = createReportRepository({
  supabaseClient: supabaseClient.getClient(),
});

const subscriptionRepository = createSubscriptionRepository({
  supabaseClient: supabaseClient.getClient(),
});

const userMonthlyUsageRepository = createUserMonthlyUsageRepository({
  supabaseClient: supabaseClient.getClient(),
});

const useCase = createGetReportsUseCase({
  reportRepository,
});

const createUseCase = createCreateReportUseCase({
  reportRepository,
});

export const getReportsHandler = async (request: NextRequest) => {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const reports = await useCase.execute(userId);
    return NextResponse.json(reports, { status: 200 });
  } catch (error) {
    console.error("[getReportsHandler] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
};

export const createReportHandler = async (request: NextRequest) => {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const subscription = await subscriptionRepository.getLatestByUserId(userId);
    const isPaidUser = subscription?.status === "active";
    if (!isPaidUser) {
      const limits = getAppLimits();
      const usage = await userMonthlyUsageRepository.getOrCreate(userId);
      if (usage.report_count >= limits.free.monthly.reports) {
        return NextResponse.json(
          {
            message: "Monthly report limit reached",
            details: "REPORT_LIMIT_REACHED",
          },
          { status: 402 }
        );
      }
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    if (typeof payload !== "object" || payload === null) {
      return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }

    const payloadRecord = payload as Record<string, unknown>;
    const report_title = typeof payloadRecord.report_title === "string" ? payloadRecord.report_title : null;
    const language = typeof payloadRecord.language === "string" ? payloadRecord.language : null;

    if (!language) {
      return NextResponse.json({ message: "language is required" }, { status: 400 });
    }

    const report = await createUseCase.execute(userId, { report_title, language });

    if (!isPaidUser) {
      await userMonthlyUsageRepository.incrementReportCount(userId);
    }
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("[createReportHandler] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
};

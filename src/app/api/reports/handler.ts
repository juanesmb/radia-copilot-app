import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "../clients/supabaseClient";
import { mapErrorToResponse } from "../lib/errorHandler";
import { createReportRepository } from "../repositories/reportRepository";
import { createCreateReportUseCase, createGetReportsUseCase } from "./usecase";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const reportRepository = createReportRepository({
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
    const is_custom_template = payloadRecord.is_custom_template === null || typeof payloadRecord.is_custom_template === "boolean" 
      ? payloadRecord.is_custom_template 
      : null;

    if (process.env.NODE_ENV !== "production") {
      // Log only minimal, non-PII metadata in non-production environments.
      console.log("[createReportHandler] Received payload:", {
        hasTitle: Boolean(report_title),
        language,
        is_custom_template,
      });
    }

    if (!language) {
      return NextResponse.json({ message: "language is required" }, { status: 400 });
    }

    const report = await createUseCase.execute(userId, { report_title, language, is_custom_template });
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("[createReportHandler] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
};


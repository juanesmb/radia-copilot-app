import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "../../clients/supabaseClient";
import { mapErrorToResponse } from "../../lib/errorHandler";
import { createReportRepository } from "../../repositories/reportRepository";
import { createUpdateReportUseCase } from "./usecase";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const reportRepository = createReportRepository({
  supabaseClient: supabaseClient.getClient(),
});

const useCase = createUpdateReportUseCase({
  reportRepository,
});

export const updateReportHandler = async (
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) => {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { reportId } = await params;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    if (typeof payload !== "object" || payload === null) {
      return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }

    const updates: { report_title?: string; updated_report?: string; updated_transcription?: string } = {};
    if ("report_title" in payload && typeof payload.report_title === "string") {
      updates.report_title = payload.report_title;
    }
    if ("updated_report" in payload && typeof payload.updated_report === "string") {
      updates.updated_report = payload.updated_report;
    }
    if ("updated_transcription" in payload && typeof payload.updated_transcription === "string") {
      updates.updated_transcription = payload.updated_transcription;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "No valid fields to update." }, { status: 400 });
    }

    const updatedReport = await useCase.execute(reportId, userId, updates);
    return NextResponse.json(updatedReport, { status: 200 });
  } catch (error) {
    console.error("[updateReportHandler] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
};


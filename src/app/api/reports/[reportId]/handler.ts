import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "../../clients/supabaseClient";
import { mapErrorToResponse } from "../../lib/errorHandler";
import { createReportRepository, type UpdateReportData } from "../../repositories/reportRepository";
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

    // Type payload as Record to allow safe property access
    const payloadRecord = payload as Record<string, unknown>;

    // Build updates object with type-safe field extraction
    const updates: Partial<UpdateReportData> = {};
    
    // String fields
    const stringFields: Array<keyof UpdateReportData> = [
      "report_title",
      "updated_report",
      "updated_transcription",
      "generated_report",
      "generated_transcription",
      "used_template",
      "model_used",
    ];
    
    for (const field of stringFields) {
      if (field in payloadRecord && typeof payloadRecord[field] === "string") {
        (updates as Record<string, unknown>)[field] = payloadRecord[field] as string;
      }
    }
    
    // Nullable string fields
    if ("template_content" in payloadRecord && (payloadRecord.template_content === null || typeof payloadRecord.template_content === "string")) {
      updates.template_content = payloadRecord.template_content as string | null;
    }
    if ("template_id" in payloadRecord && (payloadRecord.template_id === null || typeof payloadRecord.template_id === "string")) {
      updates.template_id = payloadRecord.template_id as string | null;
    }
    if ("study_type" in payloadRecord && (payloadRecord.study_type === null || typeof payloadRecord.study_type === "string")) {
      updates.study_type = payloadRecord.study_type as string | null;
    }
    
    // Nullable number field
    if ("detection_confidence" in payloadRecord && (payloadRecord.detection_confidence === null || typeof payloadRecord.detection_confidence === "number")) {
      updates.detection_confidence = payloadRecord.detection_confidence as number | null;
    }
    
    // Nullable boolean field
    if ("is_custom_template" in payloadRecord && (payloadRecord.is_custom_template === null || typeof payloadRecord.is_custom_template === "boolean")) {
      updates.is_custom_template = payloadRecord.is_custom_template as boolean | null;
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


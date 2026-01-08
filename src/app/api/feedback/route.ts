import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "../clients/supabaseClient";
import { mapErrorToResponse } from "../lib/errorHandler";
import { createFeedbackRepository } from "../repositories/feedbackRepository";
import { createReportRepository } from "../repositories/reportRepository";
import { validateFeedbackRequest } from "../types/feedback";
import { createFeedbackUseCase } from "./usecase";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const feedbackRepository = createFeedbackRepository({
  supabaseClient: supabaseClient.getClient(),
});

const reportRepository = createReportRepository({
  supabaseClient: supabaseClient.getClient(),
});

const useCase = createFeedbackUseCase({
  feedbackRepository,
  reportRepository,
});

export async function POST(request: NextRequest) {
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

    const validation = validateFeedbackRequest(payload);
    if (!validation.success) {
      return NextResponse.json({ message: validation.message }, { status: 400 });
    }

    const feedback = await useCase.execute(validation.data, userId);

    return NextResponse.json(
      {
        id: feedback.id,
        reportId: feedback.report_id,
        confidence: feedback.confidence,
        reason: feedback.reason,
        createdAt: feedback.created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[feedbackHandler] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}


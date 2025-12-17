import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { createOpenAIClient } from "../clients/openaiClient";
import { createSupabaseClient } from "../clients/supabaseClient";
import { mapErrorToResponse } from "../lib/errorHandler";
import { createReportRepository } from "../repositories/reportRepository";
import { validateGenerateReportRequest } from "../lib/validation";
import { createPromptBuilder } from "../services/promptBuilder";
import { createResponseFormatter } from "../services/responseFormatter";
import { createGenerateReportUseCase } from "./usecase";

const openAIClient = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL,
  temperature: 0.2,
});

const modelUsed = process.env.OPENAI_MODEL || "gpt-4o-mini";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const reportRepository = createReportRepository({
  supabaseClient: supabaseClient.getClient(),
});

const useCase = createGenerateReportUseCase({
  promptBuilder: createPromptBuilder(openAIClient),
  responseFormatter: createResponseFormatter(),
  openAIClient,
  modelUsed,
  reportRepository,
});

export const generateReportHandler = async (request: NextRequest) => {
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

    const validation = validateGenerateReportRequest(payload);
    if (!validation.success) {
      return NextResponse.json({ message: validation.message }, { status: 400 });
    }

    const report = await useCase.execute(validation.data, userId);

    return NextResponse.json(
      {
        report_id: report.report_id,
        title: report.title,
        report: report.report,
        studyType: report.studyType,
        detectionConfidence: report.detectionConfidence,
        modelUsed: report.modelUsed,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[generateReportHandler] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
};


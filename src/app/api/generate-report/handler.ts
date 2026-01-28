import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { createAIClient } from "../clients/aiClient";
import { createSupabaseClient } from "../clients/supabaseClient";
import { mapErrorToResponse } from "../lib/errorHandler";
import { getAIConfig } from "../lib/config";
import { getAppLimits } from "../lib/limits";
import { createReportRepository } from "../repositories/reportRepository";
import { createSubscriptionRepository } from "../repositories/subscriptionRepository";
import { createTemplateRepository } from "../repositories/templateRepository";
import { createUserMonthlyUsageRepository } from "../repositories/userMonthlyUsageRepository";
import { validateGenerateReportRequest } from "../lib/validation";
import { createPromptBuilder } from "../services/promptBuilder";
import { createPromptModeDetector } from "../services/promptModeDetector";
import { createTemplateLoader } from "../services/templateLoader";
import { createTranscriptionPromptStrategy } from "../services/transcriptionPromptStrategy";
import { createEnhancementPromptStrategy } from "../services/enhancementPromptStrategy";
import { createResponseFormatter } from "../services/responseFormatter";
import { createGenerateReportUseCase } from "./usecase";

const aiConfig = getAIConfig();
const aiClient = createAIClient({
  gatewayApiKey: aiConfig.gatewayApiKey,
  model: aiConfig.model,
  baseUrl: aiConfig.baseUrl,
  temperature: aiConfig.temperature,
});

const modelUsed = aiConfig.model;

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const subscriptionRepository = createSubscriptionRepository({
  supabaseClient: supabaseClient.getClient(),
});

const userMonthlyUsageRepository = createUserMonthlyUsageRepository({
  supabaseClient: supabaseClient.getClient(),
});

const reportRepository = createReportRepository({
  supabaseClient: supabaseClient.getClient(),
});

const templateRepository = createTemplateRepository({
  supabaseClient: supabaseClient.getClient(),
});

const templateLoader = createTemplateLoader({
  templateRepository,
});

const useCase = createGenerateReportUseCase({
  promptBuilder: createPromptBuilder({
    aiClient,
    modeDetector: createPromptModeDetector(),
    transcriptionStrategy: createTranscriptionPromptStrategy(),
    enhancementStrategy: createEnhancementPromptStrategy(),
    templateLoader,
  }),
  responseFormatter: createResponseFormatter(),
  aiClient,
  modelUsed,
  reportRepository,
});

export const generateReportHandler = async (request: NextRequest) => {
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

    const validation = validateGenerateReportRequest(payload);
    if (!validation.success) {
      return NextResponse.json({ message: validation.message }, { status: 400 });
    }

    const report = await useCase.execute(validation.data, userId);

    if (!isPaidUser) {
      await userMonthlyUsageRepository.incrementReportCount(userId);
    }

    return NextResponse.json(
      {
        report_id: report.report_id,
        title: report.title,
        report: report.report,
        studyType: report.studyType,
        detectionConfidence: report.detectionConfidence,
        modelUsed: report.modelUsed,
        selectedTemplate: report.selectedTemplate,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[generateReportHandler] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
};

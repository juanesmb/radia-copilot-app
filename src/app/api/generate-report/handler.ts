import { NextRequest, NextResponse } from "next/server";

import { createOpenAIClient } from "../clients/openaiClient";
import { mapErrorToResponse } from "../lib/errorHandler";
import { validateGenerateReportRequest } from "../lib/validation";
import { createPromptBuilder } from "../services/promptBuilder";
import { createResponseFormatter } from "../services/responseFormatter";
import { createGenerateReportUseCase } from "./usecase";

const openAIClient = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL,
  temperature: 0.2,
});

const useCase = createGenerateReportUseCase({
  promptBuilder: createPromptBuilder(openAIClient),
  responseFormatter: createResponseFormatter(),
  openAIClient,
});

export const generateReportHandler = async (request: NextRequest) => {
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

  try {
    const report = await useCase.execute(validation.data);
    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
};


import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

import { createOpenAIClient } from "../clients/openaiClient";
import { createSupabaseClient } from "../clients/supabaseClient";
import { mapErrorToResponse } from "../lib/errorHandler";
import { createReportRepository } from "../repositories/reportRepository";
import { validateGenerateReportRequest } from "../lib/validation";
import { createPromptBuilder } from "../services/promptBuilder";
import { createPromptModeDetector } from "../services/promptModeDetector";
import { createTranscriptionPromptStrategy } from "../services/transcriptionPromptStrategy";
import { createEnhancementPromptStrategy } from "../services/enhancementPromptStrategy";
import { createResponseFormatter } from "../services/responseFormatter";
import { createStreamFormatter } from "../services/streamFormatter";
import { createStreamingReportUseCase } from "./streamingUsecase";

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

const streamingUseCase = createStreamingReportUseCase({
  promptBuilder: createPromptBuilder({
    openAIClient,
    modeDetector: createPromptModeDetector(),
    transcriptionStrategy: createTranscriptionPromptStrategy(),
    enhancementStrategy: createEnhancementPromptStrategy(),
  }),
  responseFormatter: createResponseFormatter(),
  openAIClient,
  modelUsed,
  reportRepository,
  streamFormatter: createStreamFormatter(),
});

export const generateReportStreamHandler = async (request: NextRequest) => {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(
        JSON.stringify({ message: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ message: "Invalid JSON body." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const validation = validateGenerateReportRequest(payload);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ message: validation.message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const eventStream = streamingUseCase.executeStream(
            validation.data,
            userId,
            validation.data.reportId
          );
          const streamFormatter = createStreamFormatter();

          for await (const event of eventStream) {
            let formatted: string;

            switch (event.type) {
              case "chunk":
                formatted = streamFormatter.formatChunk(event.content);
                break;
              case "metadata":
                formatted = streamFormatter.formatMetadata(event.data);
                break;
              case "error":
                formatted = streamFormatter.formatError(event.message);
                break;
              default:
                continue;
            }

            controller.enqueue(encoder.encode(formatted));

            // If it's metadata, also send a done event
            if (event.type === "metadata") {
              controller.enqueue(
                encoder.encode(streamFormatter.formatDone({ reportId: event.data.reportId }))
              );
            }
          }

          controller.close();
        } catch (error) {
          console.error("[generateReportStreamHandler] Error:", error);
          const streamFormatter = createStreamFormatter();
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          controller.enqueue(encoder.encode(streamFormatter.formatError(errorMessage)));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[generateReportStreamHandler] Error:", error);
    const mapped = mapErrorToResponse(error);
    return new Response(
      JSON.stringify(mapped.body),
      { status: mapped.status, headers: { "Content-Type": "application/json" } }
    );
  }
};

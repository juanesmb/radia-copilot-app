import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createGateway, streamText } from "ai";
import { z } from "zod";

import { createAIClient } from "../clients/aiClient";
import { getAIConfig } from "../lib/config";
import { HttpError } from "../lib/errorHandler";
import { createSupabaseClient } from "../clients/supabaseClient";
import { createReportRepository } from "../repositories/reportRepository";
import type { Language } from "../types/language";
import {
  getChatReportContextPrompt,
  getChatSystemPrompt,
  getFollowUpChatSystemPrompt,
} from "../lib/prompts";

const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1),
    })
  ),
  model: z.string().optional(),
  reportId: z.string().optional(),
  language: z.enum(["en", "es"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const stream =
      url.searchParams.get("stream") === "true" ||
      request.headers.get("accept")?.includes("text/event-stream");
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const aiConfig = getAIConfig();
    const model = parsed.data.model ?? aiConfig.model;
    const aiClient = createAIClient({
      gatewayApiKey: aiConfig.gatewayApiKey,
      model,
      baseUrl: aiConfig.baseUrl,
    });

    const systemMessages: Array<{ role: "system"; content: string }> = [];
    let chatLanguage: Language = parsed.data.language ?? "en";
    let report: any = null;

    // Fetch report and determine language if reportId is provided
    if (parsed.data.reportId) {
      const supabaseClient = createSupabaseClient({
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      });
      const reportRepository = createReportRepository({
        supabaseClient: supabaseClient.getClient(),
      });
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }
      report = await reportRepository.getReportById(parsed.data.reportId, userId);
      chatLanguage = report.language === "es" ? "es" : "en";
    }

    // Only add system messages if this is the start of a new conversation
    // Check if there are any previous assistant messages (indicating this is not the first turn)
    const hasPreviousAssistantMessages = parsed.data.messages.some(msg => 
      msg.role === "assistant"
    );
    
    // Check if this is the second message and the first one had report context
    const isSecondMessageWithReportContext = hasPreviousAssistantMessages && 
      parsed.data.messages.length >= 2 &&
      parsed.data.messages[0].role === "user" &&
      parsed.data.messages[1].role === "assistant" &&
      parsed.data.reportId;

    // Only add system prompt if this is the start of a new conversation
    if (!hasPreviousAssistantMessages) {
      systemMessages.unshift({
        role: "system",
        content: getChatSystemPrompt(chatLanguage),
      });
    }
    
    // Add follow-up system prompt if this is the second message after report context
    if (isSecondMessageWithReportContext) {
      systemMessages.unshift({
        role: "system",
        content: getFollowUpChatSystemPrompt(chatLanguage),
      });
    }

    const normalizedMessages: Array<{
      role: "user" | "assistant" | "system";
      content: string;
    }> = parsed.data.messages.map((message) => {
      if (message.role === "system") {
        return { role: "system" as const, content: message.content };
      }
      if (message.role === "assistant") {
        return { role: "assistant" as const, content: message.content };
      }
      return { role: "user" as const, content: message.content };
    });

    // Add report context if this is a new conversation or first message about this report
    if (report && !hasPreviousAssistantMessages) {
      normalizedMessages.unshift({
        role: "user" as const,
        content: getChatReportContextPrompt(report, chatLanguage),
      });
    }

    if (stream) {
      const gateway = createGateway({
        baseURL: aiConfig.baseUrl,
        headers: {
          Authorization: `Bearer ${aiConfig.gatewayApiKey}`,
        },
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const result = await streamText({
              model: gateway(model),
              temperature: aiConfig.temperature,
              messages: [...systemMessages, ...normalizedMessages],
            });

            for await (const chunk of result.textStream) {
              if (!chunk) {
                continue;
              }
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
              );
            }

            if (result.usage) {
              const usage = await result.usage;
              const usageRecord = usage as unknown as {
                promptTokens?: number;
                completionTokens?: number;
                totalTokens?: number;
              };

              const totalTokens =
                usageRecord.totalTokens ??
                (usageRecord.promptTokens ?? 0) + (usageRecord.completionTokens ?? 0);

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    usage: {
                      promptTokens: usageRecord.promptTokens,
                      completionTokens: usageRecord.completionTokens,
                      totalTokens,
                    },
                  })}\n\n`
                )
              );
            }

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Chat streaming failed";
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const response = await aiClient.generateCompletion([
      ...systemMessages,
      ...normalizedMessages,
    ]);

    return NextResponse.json({ response });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate response";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

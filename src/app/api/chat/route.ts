import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createGateway, streamText } from "ai";
import { z } from "zod";

import { createAIClient } from "../clients/aiClient";
import { getAIConfig } from "../lib/config";
import { HttpError } from "../lib/errorHandler";
import { createSupabaseClient } from "../clients/supabaseClient";
import { getAppLimits } from "../lib/limits";
import { createReportRepository } from "../repositories/reportRepository";
import { createSubscriptionRepository } from "../repositories/subscriptionRepository";
import { createUserMonthlyUsageRepository } from "../repositories/userMonthlyUsageRepository";
import type { Language } from "../types/language";
import {
  getChatReportContextPrompt,
  getChatSystemPrompt,
} from "../lib/prompts";
import { estimateTokenCount } from "../lib/tokenEstimate";

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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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

    const limits = getAppLimits();
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

    const subscription = await subscriptionRepository.getLatestByUserId(userId);
    const isPaidUser = subscription?.status === "active";
    if (!isPaidUser) {
      const usage = await userMonthlyUsageRepository.getOrCreate(userId);
      if (usage.chat_token_count >= limits.free.monthly.chatTokens) {
        return NextResponse.json(
          {
            message: "Monthly chat token limit reached",
            details: "CHAT_TOKEN_LIMIT_REACHED",
          },
          { status: 402 }
        );
      }
    }

    const systemMessages: Array<{ role: "system"; content: string }> = [];
    let chatLanguage: Language = parsed.data.language ?? "en";

    if (parsed.data.reportId) {
      const reportRepository = createReportRepository({
        supabaseClient: supabaseClient.getClient(),
      });
      const report = await reportRepository.getReportById(parsed.data.reportId, userId);
      chatLanguage = report.language === "es" ? "es" : "en";
      systemMessages.push({
        role: "system" as const,
        content: getChatReportContextPrompt(report, chatLanguage),
      });
    }

    systemMessages.unshift({
      role: "system",
      content: getChatSystemPrompt(chatLanguage),
    });

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

    if (stream) {
      const gateway = createGateway({
        baseURL: aiConfig.baseUrl,
        headers: {
          Authorization: `Bearer ${aiConfig.gatewayApiKey}`,
        },
      });

      const encoder = new TextEncoder();
      let accumulatedText = "";
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
              accumulatedText += chunk;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
              );
            }

            if (!isPaidUser) {
              const promptText = [...systemMessages, ...normalizedMessages]
                .map((m) => m.content)
                .join("\n");
              const estimatedTokens =
                estimateTokenCount(promptText) + estimateTokenCount(accumulatedText);
              await userMonthlyUsageRepository.addChatTokens(userId, estimatedTokens);
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

    if (!isPaidUser) {
      const promptText = [...systemMessages, ...normalizedMessages]
        .map((m) => m.content)
        .join("\n");
      const estimatedTokens =
        estimateTokenCount(promptText) + estimateTokenCount(response);
      await userMonthlyUsageRepository.addChatTokens(userId, estimatedTokens);
    }

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

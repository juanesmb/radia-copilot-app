import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createGateway, streamText } from "ai";
import { z } from "zod";

import { createAIClient } from "../clients/aiClient";
import { getAIConfig } from "../lib/config";
import { HttpError } from "../lib/errorHandler";
import { createSupabaseClient } from "../clients/supabaseClient";
import { createReportRepository } from "../repositories/reportRepository";

const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1),
    })
  ),
  model: z.string().optional(),
  reportId: z.string().optional(),
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

    const systemMessage = {
      role: "system" as const,
      content:
        "Eres un asistente general y útil. Responde en el idioma del usuario con claridad y brevedad.",
    };

    const systemMessages = [systemMessage];

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
      const report = await reportRepository.getReportById(parsed.data.reportId, userId);
      systemMessages.push({
        role: "system" as const,
        content:
          "Contexto del informe seleccionado:\n" +
          `Título: ${report.report_title ?? "(sin título)"}\n` +
          `Transcripción: ${report.updated_transcription}\n` +
          `Informe: ${report.updated_report}`,
      });
    }

    const normalizedMessages: Array<{ role: "user" | "system"; content: string }> =
      parsed.data.messages.map((message) => {
        if (message.role === "system") {
          return { role: "system" as const, content: message.content };
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

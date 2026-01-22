import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAIClient } from "../../clients/aiClient";
import { createSupabaseClient } from "../../clients/supabaseClient";
import { getAIConfig } from "../../lib/config";
import { mapErrorToResponse } from "../../lib/errorHandler";
import { createChatRepository } from "../../repositories/chatRepository";
import { createReportRepository } from "../../repositories/reportRepository";

const requestSchema = z.object({
  reportId: z.string().min(1),
  title: z.string().min(1),
  model: z.string().min(1),
  initialPrompt: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json();
    const parsed = requestSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabaseClient = createSupabaseClient({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    });
    const chatRepository = createChatRepository({
      supabaseClient: supabaseClient.getClient(),
    });
    const reportRepository = createReportRepository({
      supabaseClient: supabaseClient.getClient(),
    });

    const report = await reportRepository.getReportById(parsed.data.reportId, userId);
    const session = await chatRepository.createSession({
      user_id: userId,
      title: parsed.data.title,
      model: parsed.data.model,
      report_id: parsed.data.reportId,
    });

    const aiConfig = getAIConfig();
    const aiClient = createAIClient({
      gatewayApiKey: aiConfig.gatewayApiKey,
      model: parsed.data.model,
      baseUrl: aiConfig.baseUrl,
      temperature: aiConfig.temperature,
    });

    const systemPrompt =
      "Eres un asistente clínico que revisa reportes y ofrece impresiones iniciales claras y breves.";
    const contextPrompt =
      "Contexto del informe seleccionado:\n" +
      `Título: ${report.report_title ?? "(sin título)"}\n` +
      `Transcripción: ${report.updated_transcription}\n` +
      `Informe: ${report.updated_report}`;
    const userPrompt = parsed.data.initialPrompt ?? "Da tus primeras impresiones sobre este informe.";

    const response = await aiClient.generateCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: `${contextPrompt}\n\n${userPrompt}` },
    ]);

    await chatRepository.createMessage(userId, {
      session_id: session.id,
      role: "assistant",
      content: response,
    });

    return NextResponse.json({ sessionId: session.id }, { status: 201 });
  } catch (error) {
    console.error("[chatReportSession] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

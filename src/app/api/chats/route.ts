import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseClient } from "../clients/supabaseClient";
import { mapErrorToResponse } from "../lib/errorHandler";
import { createChatRepository } from "../repositories/chatRepository";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const chatRepository = createChatRepository({
  supabaseClient: supabaseClient.getClient(),
});

const createSessionSchema = z.object({
  title: z.string().optional(),
  model: z.string().min(1),
  max_tokens: z.number().int().optional(),
});

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const sessions = await chatRepository.listSessions(userId);
    return NextResponse.json(sessions, { status: 200 });
  } catch (error) {
    console.error("[chatSessions] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

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

    const parsed = createSessionSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const session = await chatRepository.createSession({
      user_id: userId,
      title: parsed.data.title ?? null,
      model: parsed.data.model,
      max_tokens: parsed.data.max_tokens ?? null,
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("[chatSessions] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

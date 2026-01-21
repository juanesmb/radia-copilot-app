import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseClient } from "../../clients/supabaseClient";
import { mapErrorToResponse } from "../../lib/errorHandler";
import { createChatRepository } from "../../repositories/chatRepository";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const chatRepository = createChatRepository({
  supabaseClient: supabaseClient.getClient(),
});

const updateSessionSchema = z.object({
  title: z.string().optional(),
  model: z.string().optional(),
  max_tokens: z.number().int().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = updateSessionSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const session = await chatRepository.updateSession(sessionId, userId, parsed.data);
    return NextResponse.json(session, { status: 200 });
  } catch (error) {
    console.error("[chatSessionUpdate] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

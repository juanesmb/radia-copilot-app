import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";

import { createSupabaseClient } from "../../../clients/supabaseClient";
import { mapErrorToResponse } from "../../../lib/errorHandler";
import { createTemplateRepository } from "../../../repositories/templateRepository";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const templateRepository = createTemplateRepository({
  supabaseClient: supabaseClient.getClient(),
});

const requestSchema = z.object({
  content: z.string().min(1),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { templateId } = await params;
    if (!templateId?.trim()) {
      return NextResponse.json({ message: "templateId is required" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await templateRepository.updateCustomTemplateContent(
      userId,
      templateId,
      parsed.data.content
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[UpdateCustomTemplate] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

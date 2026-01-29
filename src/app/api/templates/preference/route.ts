import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";

import { createSupabaseClient } from "../../clients/supabaseClient";
import { mapErrorToResponse } from "../../lib/errorHandler";
import { createTemplateRepository } from "../../repositories/templateRepository";
import type { Language } from "../../types/language";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const templateRepository = createTemplateRepository({
  supabaseClient: supabaseClient.getClient(),
});

const requestSchema = z.object({
  studyType: z.string().min(1),
  language: z.enum(["en", "es"]),
  useDefault: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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

    await templateRepository.setTemplatePreference(
      userId,
      parsed.data.studyType,
      parsed.data.language as Language,
      {
        preferred_template_id: null,
        use_default: parsed.data.useDefault,
      }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[SetTemplatePreference] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

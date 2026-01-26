import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseClient } from "../../clients/supabaseClient";
import { mapErrorToResponse } from "../../lib/errorHandler";
import { createTemplateRepository } from "../../repositories/templateRepository";
import { createTemplateLoader } from "../../services/templateLoader";
import type { Language } from "../../types/language";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const templateRepository = createTemplateRepository({
  supabaseClient: supabaseClient.getClient(),
});

const templateLoader = createTemplateLoader({
  templateRepository,
});

const requestSchema = z.object({
  language: z.enum(["en", "es"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studyType: string }> }
) {
  try {
    const { studyType } = await params;

    if (!studyType?.trim()) {
      return NextResponse.json(
        { error: "Invalid request", message: "Study type is required" },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { language } = parsed.data;
    // loadTemplate will throw 404 if template doesn't exist, no need to check separately
    const content = await templateLoader.loadTemplate(
      studyType,
      language as Language
    );

    return NextResponse.json({
      content,
      studyType,
      language,
    });
  } catch (error) {
    console.error("[GetTemplateContent] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";

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
  useDefault: z.boolean().optional(),
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

    const { userId } = await auth();
    const useDefault = Boolean(parsed.data.useDefault);

    if (userId) {
      const preferred = await templateRepository.getPreferredTemplate(
        userId,
        studyType,
        language as Language,
        { useDefault }
      );

      if (!preferred) {
        // fall back to system loader (keeps existing error behavior)
        const content = await templateLoader.loadTemplate(studyType, language as Language);
        return NextResponse.json({
          content,
          studyType,
          language,
        });
      }

      return NextResponse.json({
        content: preferred.content.trim(),
        studyType,
        language,
        templateId: preferred.template_id,
        isSystem: Boolean(preferred.is_system),
      });
    }

    // Unauthenticated: return system template only
    const system = await templateRepository.getSystemTemplate(studyType, language as Language);
    if (!system) {
      const content = await templateLoader.loadTemplate(studyType, language as Language);
      return NextResponse.json({
        content,
        studyType,
        language,
      });
    }

    return NextResponse.json({
      content: system.content.trim(),
      studyType,
      language,
      templateId: system.template_id,
      isSystem: true,
    });
  } catch (error) {
    console.error("[GetTemplateContent] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

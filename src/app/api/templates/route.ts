import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "../clients/supabaseClient";
import { mapErrorToResponse } from "../lib/errorHandler";
import { createTemplateRepository } from "../repositories/templateRepository";
import { createTemplateLoader } from "../services/templateLoader";
import type { Language } from "../types/language";

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { language } = parsed.data;
    const availableTemplates = await templateLoader.listAvailableTemplates(
      language as Language
    );

    return NextResponse.json({
      templates: availableTemplates,
    });
  } catch (error) {
    console.error("[GetTemplates] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

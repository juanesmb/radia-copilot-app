import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { mapErrorToResponse } from "../../lib/errorHandler";
import { loadTemplate, templateExists } from "../../services/templateLoader";
import type { Language } from "../../types/language";

const requestSchema = z.object({
  language: z.enum(["en", "es"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studyType: string }> }
) {
  try {
    const { studyType } = await params;

    if (!studyType || studyType.trim().length === 0) {
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

    if (!templateExists(studyType, language as Language)) {
      return NextResponse.json(
        { error: "Template not found", message: `Template "${studyType}" not found for language "${language}"` },
        { status: 404 }
      );
    }

    const content = loadTemplate(studyType, language as Language);

    return NextResponse.json({
      content,
      studyType,
      language,
    });
  } catch (error) {
    console.error("[getTemplateContent] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

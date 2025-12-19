import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createOpenAIClient } from '../clients/openaiClient';
import { detectStudyType } from '../services/studyTypeDetector';
import { listAvailableTemplates } from '../services/templateLoader';
import type { Language } from '../types/language';

const requestSchema = z.object({
  transcription: z.string().min(1),
  language: z.enum(['en', 'es']),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { transcription, language } = parsed.data;
    const openAIClient = createOpenAIClient({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });

    const detection = await detectStudyType(
      transcription,
      language as Language,
      openAIClient
    );

    const availableTemplates = listAvailableTemplates(language as Language);

    return NextResponse.json({
      studyType: detection.studyType,
      confidence: detection.confidence,
      reasoning: detection.reasoning,
      keywords: detection.keywords,
      availableTemplates,
    });
  } catch (error) {
    console.error('Study type detection error:', error);
    return NextResponse.json(
      { error: 'Failed to detect study type' },
      { status: 500 }
    );
  }
}


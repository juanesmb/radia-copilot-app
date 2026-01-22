import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAIClient } from '../clients/aiClient';
import { getAIConfig, getDetectionModel } from '../lib/config';
import { HttpError } from '../lib/errorHandler';
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
    const aiConfig = getAIConfig();
    const detectionModel = getDetectionModel();
    const aiClient = createAIClient({
      gatewayApiKey: aiConfig.gatewayApiKey,
      model: detectionModel,
      baseUrl: aiConfig.baseUrl,
    });

    const detection = await detectStudyType(
      transcription,
      language as Language,
      aiClient
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
    
    // Preserve status code from HttpError if available
    if (error instanceof HttpError) {
      return NextResponse.json(
        { 
          error: error.message,
          details: error.details 
        },
        { status: error.status }
      );
    }
    
    // Fallback for unknown errors
    const errorMessage = error instanceof Error ? error.message : 'Failed to detect study type';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


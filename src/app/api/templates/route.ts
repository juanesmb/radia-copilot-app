import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listAvailableTemplates } from '../services/templateLoader';
import type { Language } from '../types/language';

const requestSchema = z.object({
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

    const { language } = parsed.data;
    const availableTemplates = listAvailableTemplates(language as Language);

    return NextResponse.json({
      templates: availableTemplates,
    });
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      { error: 'Failed to get templates' },
      { status: 500 }
    );
  }
}



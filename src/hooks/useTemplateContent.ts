'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getTemplateContent } from '@/lib/api';

interface UseTemplateContentReturn {
  content: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useTemplateContent(
  studyType: string | null,
  language: "en" | "es",
  customTemplateContent?: string | null
): UseTemplateContentReturn {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTemplate = useCallback(async () => {
    // If custom template content is provided, use it directly (no API call)
    if (customTemplateContent !== undefined && customTemplateContent !== null && customTemplateContent.trim().length > 0) {
      setContent(customTemplateContent);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!studyType || studyType.trim().length === 0) {
      setContent(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getTemplateContent({
        studyType: studyType.trim(),
        language,
      });

      if (abortController.signal.aborted) {
        return;
      }

      setContent(result.content);
      setError(null);
    } catch (err) {
      if (abortController.signal.aborted) {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to load template';
      setError(errorMessage);
      setContent(null);
      console.error('[useTemplateContent] Error:', err);
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [studyType, language, customTemplateContent]);

  useEffect(() => {
    fetchTemplate();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTemplate]);

  return {
    content,
    isLoading,
    error,
  };
}

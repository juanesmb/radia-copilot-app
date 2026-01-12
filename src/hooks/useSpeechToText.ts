'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  SpeechToTextProvider,
  STTConfig,
  STTState,
  STTError,
} from '@/domain/speech-to-text';

interface UseSpeechToTextReturn {
  transcript: string;
  state: STTState;
  error: STTError | null;
  start: (config: STTConfig, baseText?: string) => Promise<void>;
  stop: () => Promise<void>;
  reset: () => Promise<void>;
}

export function useSpeechToText(
  provider: SpeechToTextProvider
): UseSpeechToTextReturn {
  const [transcript, setTranscript] = useState('');
  const [state, setState] = useState<STTState>('idle');
  const [error, setError] = useState<STTError | null>(null);
  const providerRef = useRef(provider);
  const baseTranscriptRef = useRef('');
  const transcriptRef = useRef('');

  // Keep transcriptRef in sync with transcript state
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    providerRef.current = provider;

    provider.onTranscript((result) => {
      const sessionText = result.text.trim();
      
      // Skip placeholder text
      if (sessionText === '...') {
        return;
      }
      
      // Build combined transcript: base + current session transcript
      // Provider's sessionText is the full accumulated transcript for THIS session only
      // (accumulatedTranscript is cleared on each connect)
      const combined = baseTranscriptRef.current
        ? `${baseTranscriptRef.current} ${sessionText}`.trim()
        : sessionText;
      
      // Only update if changed to avoid unnecessary re-renders
      if (combined !== transcriptRef.current) {
        transcriptRef.current = combined;
        setTranscript(combined);
      }
    });

    provider.onStateChange((newState) => {
      setState(newState);
      // Update base transcript when recording stops
      if (newState === 'idle' && transcriptRef.current) {
        baseTranscriptRef.current = transcriptRef.current;
      }
    });

    provider.onError((err) => {
      setError(err);
    });

    return () => {
      provider.disconnect();
    };
  }, [provider]);

  const start = useCallback(async (config: STTConfig, baseText?: string) => {
    setError(null);
    // Use provided baseText if explicitly provided (even if empty), otherwise fall back to current transcript state
    // This allows preserving manually entered text when starting recording, and clearing when user deletes text
    const currentTranscript = baseText !== undefined ? baseText.trim() : (transcriptRef.current || transcript);
    baseTranscriptRef.current = currentTranscript;
    // Always update transcriptRef and state to keep them in sync (even if empty)
    if (currentTranscript !== transcriptRef.current) {
      transcriptRef.current = currentTranscript;
      setTranscript(currentTranscript);
    }
    await providerRef.current.connect(config);
    await providerRef.current.startRecording();
  }, [transcript]);

  const stop = useCallback(async () => {
    await providerRef.current.stopRecording();
  }, []);

  const reset = useCallback(async () => {
    setTranscript('');
    setError(null);
    baseTranscriptRef.current = '';
    transcriptRef.current = '';
    await providerRef.current.disconnect();
  }, []);

  return {
    transcript,
    state,
    error,
    start,
    stop,
    reset,
  };
}


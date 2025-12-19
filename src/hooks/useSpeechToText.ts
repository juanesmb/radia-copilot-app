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
  start: (config: STTConfig) => Promise<void>;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

export function useSpeechToText(
  provider: SpeechToTextProvider
): UseSpeechToTextReturn {
  const [transcript, setTranscript] = useState('');
  const [state, setState] = useState<STTState>('idle');
  const [error, setError] = useState<STTError | null>(null);
  const providerRef = useRef(provider);

  useEffect(() => {
    providerRef.current = provider;

    provider.onTranscript((result) => {
      setTranscript(result.text);
    });

    provider.onStateChange((newState) => {
      setState(newState);
    });

    provider.onError((err) => {
      setError(err);
    });

    return () => {
      provider.disconnect();
    };
  }, [provider]);

  const start = useCallback(async (config: STTConfig) => {
    setError(null);
    setTranscript('');
    try {
      await providerRef.current.connect(config);
      await providerRef.current.startRecording();
    } catch (err) {
      throw err;
    }
  }, []);

  const stop = useCallback(async () => {
    await providerRef.current.stopRecording();
  }, []);

  const pause = useCallback(() => {
    providerRef.current.pauseRecording();
  }, []);

  const resume = useCallback(() => {
    providerRef.current.resumeRecording();
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
    providerRef.current.disconnect();
  }, []);

  return {
    transcript,
    state,
    error,
    start,
    stop,
    pause,
    resume,
    reset,
  };
}


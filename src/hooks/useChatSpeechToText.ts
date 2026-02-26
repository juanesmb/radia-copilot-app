'use client';

import { useCallback, useRef, useState, useMemo } from 'react';
import { useSpeechToText } from './useSpeechToText';
import { createSpeechToTextProvider } from '@/infrastructure/speech-to-text';
import { useLanguage } from '@/contexts/LanguageContext';

export function useChatSpeechToText() {
  const { language } = useLanguage();
  const [isChatRecording, setIsChatRecording] = useState(false);

  // Always create a separate provider instance specifically for chat
  // This ensures the chat has its own independent recording functionality
  // Create the provider instance only once
  const sttProvider = useMemo(() => createSpeechToTextProvider('speechmatics'), []);

  const {
    transcript,
    state: sttState,
    error: sttError,
    start: startSTT,
    stop: stopSTT,
    reset: resetSTT,
  } = useSpeechToText(sttProvider);

  const handleStartChatRecording = useCallback(async (baseText?: string) => {
    try {

      // Start recording for chat - this will create its own connection
      await startSTT({
        language,
      }, baseText);

      setIsChatRecording(true);
    } catch (error) {
      console.error('[ChatSpeechToText] Failed to start recording:', error);
      setIsChatRecording(false);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('Permission denied')) {
          console.warn('[ChatSpeechToText] Microphone permission denied for chat');
        } else if (error.message.includes('Cannot start recording')) {
          console.warn('[ChatSpeechToText] Unable to start chat recording - microphone might be in use');
        }
      }
    }
  }, [startSTT, language]);

  const handleStopChatRecording = useCallback(async () => {
    try {
      await stopSTT();
      setIsChatRecording(false);
    } catch (error) {
      console.error('[ChatSpeechToText] Failed to stop recording:', error);
      setIsChatRecording(false);
    }
  }, [stopSTT, transcript]);

  const handleResetChatTranscript = useCallback(() => {
    resetSTT();
    setIsChatRecording(false);
  }, [resetSTT]);

  return {
    chatTranscript: transcript,
    isChatRecording,
    sttState,
    sttError,
    handleStartChatRecording,
    handleStopChatRecording,
    handleResetChatTranscript,
  };
}

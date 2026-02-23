'use client';

import { useCallback, useRef, useState } from 'react';
import { useSpeechToText } from './useSpeechToText';
import { createSpeechToTextProvider } from '@/infrastructure/speech-to-text';
import { useLanguage } from '@/contexts/LanguageContext';

export function useChatSpeechToText() {
  const { language } = useLanguage();
  const [chatTranscript, setChatTranscript] = useState('');
  const [isChatRecording, setIsChatRecording] = useState(false);
  
  const sttProvider = createSpeechToTextProvider('speechmatics');

  const {
    transcript,
    state: sttState,
    error: sttError,
    start: startSTT,
    stop: stopSTT,
    reset: resetSTT,
  } = useSpeechToText(sttProvider);

  // Update chat transcript when STT transcript changes
  const prevTranscriptRef = useRef(transcript);
  
  const handleStartChatRecording = useCallback(async () => {
    try {
      setChatTranscript(''); // Clear previous transcript
      await startSTT({
        language,
      });
      setIsChatRecording(true);
    } catch (error) {
      console.error('[ChatSpeechToText] Failed to start recording:', error);
      setIsChatRecording(false);
    }
  }, [startSTT, language]);

  const handleStopChatRecording = useCallback(async () => {
    try {
      await stopSTT();
      setIsChatRecording(false);
      // Keep the final transcript for the chat input
      setChatTranscript(transcript); // Use the final transcript
    } catch (error) {
      console.error('[ChatSpeechToText] Failed to stop recording:', error);
      setIsChatRecording(false);
    }
  }, [stopSTT, transcript]);

  const handleResetChatTranscript = useCallback(() => {
    setChatTranscript('');
    resetSTT();
    setIsChatRecording(false);
  }, [resetSTT]);
  
  return {
    chatTranscript,
    isChatRecording,
    sttState,
    sttError,
    handleStartChatRecording,
    handleStopChatRecording,
    handleResetChatTranscript,
  };
}

'use client';

import { useCallback, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SimpleSpeechState {
  transcript: string;
  isRecording: boolean;
  error: string | null;
}

export function useSimpleChatSpeech() {
  const { language } = useLanguage();
  const [state, setState] = useState<SimpleSpeechState>({
    transcript: '',
    isRecording: false,
    error: null,
  });

  const recognitionRef = useRef<any>(null);

  const handleStartRecording = useCallback(() => {
    try {
      // Check if browser supports Speech Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setState(prev => ({
          ...prev,
          error: 'Speech recognition not supported in this browser'
        }));
        return;
      }

      // Check microphone permissions first
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          console.log('[SimpleChatSpeech] Microphone access granted');
          
          // Create new recognition instance
          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;

          // Configure recognition
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = language === 'es' ? 'es-ES' : 'en-US';
          recognition.maxAlternatives = 1;

          // Set up event handlers
          recognition.onresult = (event: any) => {
            console.log('[SimpleChatSpeech] Recognition result:', {
              resultIndex: event.resultIndex,
              results: event.results,
              resultsLength: event.results?.length
            });
            
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i];
              console.log(`[SimpleChatSpeech] Processing result ${i}:`, {
                isFinal: result.isFinal,
                transcript: result[0]?.transcript,
                confidence: result[0]?.confidence
              });
              
              if (result.isFinal) {
                finalTranscript += result[0].transcript;
              } else {
                interimTranscript += result[0]?.transcript || '';
              }
            }

            console.log('[SimpleChatSpeech] Before state update:', {
              finalTranscript,
              interimTranscript,
              currentTranscript: state.transcript
            });

            // Update state with new transcript
            setState(prev => {
              const newTranscript = prev.transcript + finalTranscript;
              console.log('[SimpleChatSpeech] Transcript updated:', {
                prev: prev.transcript,
                finalTranscript,
                newTranscript
              });
              return {
                ...prev,
                transcript: newTranscript
              };
            });
          };

          recognition.onerror = (event: any) => {
            console.error('[SimpleChatSpeech] Speech recognition error:', event.error);
            setState(prev => ({
              ...prev,
              error: `Speech recognition error: ${event.error}`
            }));
          };

          recognition.onend = () => {
            console.log('[SimpleChatSpeech] Recognition ended');
          };

          recognition.onspeechstart = () => {
            console.log('[SimpleChatSpeech] Speech started');
          };

          recognition.onspeechend = () => {
            console.log('[SimpleChatSpeech] Speech ended');
          };

          // Start recognition
          recognition.start();
          
          setState(prev => ({
            ...prev,
            isRecording: true,
            error: null,
            transcript: '' // Clear previous transcript
          }));
        })
        .catch((error) => {
          console.error('[SimpleChatSpeech] Microphone access denied:', error);
          setState(prev => ({
            ...prev,
            error: `Microphone access denied: ${error}`
          }));
        });
    } catch (error) {
      console.error('[SimpleChatSpeech] Failed to start recording:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start recording'
      }));
    }
  }, [language]);

  const handleStopRecording = useCallback(() => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setState(prev => ({
        ...prev,
        isRecording: false
      }));
    } catch (error) {
      console.error('[SimpleChatSpeech] Failed to stop recording:', error);
    }
  }, []);

  const handleResetTranscript = useCallback(() => {
    setState({
      transcript: '',
      isRecording: false,
      error: null
    });
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  return {
    transcript: state.transcript,
    isRecording: state.isRecording,
    error: state.error,
    handleStartRecording,
    handleStopRecording,
    handleResetTranscript,
    cleanup,
  };
}

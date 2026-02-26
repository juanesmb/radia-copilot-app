'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
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
  const transcriptRef = useRef<string>('');
  const isStartingRef = useRef(false);

  // Sync transcriptRef with state
  useEffect(() => {
    transcriptRef.current = state.transcript;
  }, [state.transcript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const handleStartRecording = useCallback(() => {
    // Guard against re-entrant calls
    if (isStartingRef.current || recognitionRef.current || state.isRecording) {
      return;
    }
    isStartingRef.current = true;

    try {
      // Check if browser supports Speech Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setState(prev => ({
          ...prev,
          error: 'Speech recognition not supported in this browser'
        }));
        isStartingRef.current = false;
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
            // Avoid logging raw transcript content in production
            if (process.env.NODE_ENV !== 'production') {
              console.debug('[SimpleChatSpeech] Recognition result received', {
                resultIndex: event.resultIndex,
                resultsLength: event.results?.length
              });
            }
            
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i];
              // Avoid logging raw transcript content
              if (process.env.NODE_ENV !== 'production') {
                console.debug(`[SimpleChatSpeech] Processing result ${i}`, {
                  isFinal: result.isFinal,
                  confidence: result[0]?.confidence
                });
              }
              
              if (result.isFinal) {
                finalTranscript += result[0].transcript;
              } else {
                interimTranscript += result[0]?.transcript || '';
              }
            }

            // Keep logs redacted in production
            if (process.env.NODE_ENV !== 'production') {
              console.debug('[SimpleChatSpeech] Before state update:', {
                finalTranscriptLength: finalTranscript.length,
                interimTranscriptLength: interimTranscript.length,
                currentTranscriptLength: transcriptRef.current.length
              });
            }

            // Update state with new transcript
            setState(prev => {
              const newTranscript = prev.transcript + finalTranscript;
              // Intentionally avoid logging transcript text
              if (process.env.NODE_ENV !== 'production') {
                console.debug('[SimpleChatSpeech] Transcript updated', {
                  prevLength: prev.transcript.length,
                  finalTranscriptLength: finalTranscript.length,
                  newLength: newTranscript.length
                });
              }
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
              error: `Speech recognition error: ${event.error}`,
              isRecording: false // Update recording state on error
            }));
          };

          recognition.onend = () => {
            console.log('[SimpleChatSpeech] Recognition ended');
            setState(prev => ({
              ...prev,
              isRecording: false // Update recording state when recognition ends
            }));
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
            error: `Microphone access denied: ${error}`,
            isRecording: false // Update recording state on permission error
          }));
        })
        .finally(() => {
          isStartingRef.current = false;
        });
    } catch (error) {
      console.error('[SimpleChatSpeech] Failed to start recording:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start recording',
        isRecording: false // Update recording state on start error
      }));
      isStartingRef.current = false;
    }
  }, [language, state.isRecording]);

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

  // Cleanup function for manual use
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

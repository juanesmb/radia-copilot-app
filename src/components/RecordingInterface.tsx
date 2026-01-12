'use client';

import { useRef, useEffect, useCallback } from "react";
import { Sparkles, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { STTState } from "@/domain/speech-to-text";

type HistoryEntry = {
  text: string;
  timestamp: number;
};

interface StudyTypeOption {
  value: string;
  label: string;
}

interface RecordingInterfaceProps {
  transcription: string;
  placeholder: string;
  label: string;
  uploadLabel: string;
  onChange: (value: string) => void;
  onUpload: () => void;
  disabled?: boolean;
  // Speech-to-text props
  sttState: STTState;
  onStartRecording: () => void;
  onStopRecording: () => void;
  sttError?: string | null;
  // Study type detection
  detectedStudyType?: string | null;
  availableStudyTypes?: StudyTypeOption[];
  selectedStudyType?: string;
  onStudyTypeChange?: (studyType: string) => void;
  isDetectingStudyType?: boolean;
  // Labels
  labels: {
    stop: string;
    studyType: string;
    detecting: string;
  };
}

export function RecordingInterface({
  transcription,
  placeholder,
  label,
  uploadLabel,
  onChange,
  onUpload,
  disabled,
  sttState,
  onStartRecording,
  onStopRecording,
  sttError,
  detectedStudyType,
  availableStudyTypes,
  selectedStudyType,
  onStudyTypeChange,
  isDetectingStudyType,
  labels,
}: RecordingInterfaceProps) {
  const isRecording = sttState === 'recording';
  const isConnecting = sttState === 'connecting';
  const isStopping = sttState === 'stopping';
  const isActive = isRecording || isConnecting || isStopping;
  
  const isProcessingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedTextRef = useRef<string>(transcription);
  
  const MAX_HISTORY_SIZE = 50;
  const DEBOUNCE_MS = 10;

  const handleMicClick = async () => {
    if (isProcessingRef.current) {
      return;
    }
    
    isProcessingRef.current = true;
    
    try {
      if (isRecording) {
        await onStopRecording();
      } else if (!isActive) {
        await onStartRecording();
      }
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 500);
    }
  };

  useEffect(() => {
    if (historyRef.current.length === 0) {
      historyRef.current = [{ text: transcription, timestamp: Date.now() }];
      historyIndexRef.current = 0;
      lastSavedTextRef.current = transcription;
    }
  }, []);

  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    if (transcription === lastSavedTextRef.current) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const currentIndex = historyIndexRef.current;
      const history = historyRef.current;

      if (currentIndex < history.length - 1) {
        historyRef.current = history.slice(0, currentIndex + 1);
        historyIndexRef.current = historyRef.current.length - 1;
      }

      const newEntry: HistoryEntry = {
        text: transcription,
        timestamp: Date.now(),
      };

      historyRef.current.push(newEntry);
      historyIndexRef.current = historyRef.current.length - 1;
      lastSavedTextRef.current = transcription;

      if (historyRef.current.length > MAX_HISTORY_SIZE) {
        historyRef.current = historyRef.current.slice(-MAX_HISTORY_SIZE);
        historyIndexRef.current = historyRef.current.length - 1;
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [transcription]);

  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [transcription, isActive]);

  const handleUndo = useCallback(() => {
    const history = historyRef.current;
    const currentIndex = historyIndexRef.current;

    if (currentIndex > 0) {
      const previousIndex = currentIndex - 1;
      const previousEntry = history[previousIndex];
      
      isUndoRedoRef.current = true;
      historyIndexRef.current = previousIndex;
      lastSavedTextRef.current = previousEntry.text;
      onChange(previousEntry.text);
    }
  }, [onChange]);

  const handleRedo = useCallback(() => {
    const history = historyRef.current;
    const currentIndex = historyIndexRef.current;

    if (currentIndex < history.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextEntry = history[nextIndex];
      
      isUndoRedoRef.current = true;
      historyIndexRef.current = nextIndex;
      lastSavedTextRef.current = nextEntry.text;
      onChange(nextEntry.text);
    }
  }, [onChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifierKey = isMac ? event.metaKey : event.ctrlKey;

    if (modifierKey && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      if (!isActive && !disabled) {
        handleUndo();
      }
      return;
    }

    if (
      (modifierKey && event.shiftKey && event.key === 'z') ||
      (modifierKey && event.key === 'y')
    ) {
      event.preventDefault();
      if (!isActive && !disabled) {
        handleRedo();
      }
      return;
    }

    if (modifierKey && event.key === 'a') {
      if (isActive || (disabled && !isActive)) {
        event.preventDefault();
      }
      return;
    }
  }, [isActive, disabled, handleUndo, handleRedo]);

  const hasAvailableStudyTypes = availableStudyTypes && availableStudyTypes.length > 0;

  return (
    <div className="space-y-6 flex flex-col flex-1 min-h-0 overflow-hidden">
        {sttError && (
          <div className="text-center text-sm text-red-500 bg-red-500/10 rounded-lg p-3">
            {sttError}
          </div>
        )}

        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          {hasAvailableStudyTypes && (
            <div className="flex flex-row items-center gap-3 flex-wrap justify-center">
              <button
                type="button"
                onClick={handleMicClick}
                disabled={disabled || isConnecting || isStopping}
                className={`relative rounded-full flex items-center justify-center gap-2 px-4 py-3 sm:px-4 sm:py-2 transition-all shrink-0 ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : isConnecting
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white animate-pulse'
                    : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label={isRecording ? labels.stop : label}
              >
                {isRecording ? (
                  <Square className="w-6 h-6 sm:w-5 sm:h-5" />
                ) : (
                  <Mic className="w-6 h-6 sm:w-5 sm:h-5" />
                )}
                <span className="hidden sm:inline">{label}</span>
                {isRecording && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-red-500/30" />
                )}
                {isConnecting && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-yellow-500/30" />
                )}
              </button>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <label htmlFor="study-type" className="text-sm font-medium text-foreground whitespace-nowrap shrink-0">
                  {labels.studyType}
                </label>
                {isDetectingStudyType ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    {labels.detecting}
                  </div>
                ) : (
                  <select
                    id="study-type"
                    value={selectedStudyType || detectedStudyType || ''}
                    onChange={(e) => onStudyTypeChange?.(e.target.value)}
                    disabled={isActive}
                    className="flex-1 min-w-0 max-w-[200px] h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {availableStudyTypes?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {/* Desktop: Generate button aligned to the right */}
              <div className="hidden lg:flex ml-auto">
                <Button
                  type="button"
                  className="gap-2 text-base h-10 px-6"
                  onClick={onUpload}
                  disabled={disabled || !transcription.trim() || isActive || isDetectingStudyType}
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  {uploadLabel}
                </Button>
              </div>
            </div>
          )}

          <Textarea
            ref={textareaRef}
            value={transcription}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 text-base leading-relaxed resize-none"
            readOnly={isRecording || isConnecting}
            disabled={disabled && !isActive}
          />
        </div>

        {/* Mobile: Generate button at the bottom */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center mt-auto pb-4 lg:hidden">
          <Button
            type="button"
            className="gap-2 text-base h-12 px-6"
            onClick={onUpload}
            disabled={disabled || !transcription.trim() || isActive || isDetectingStudyType}
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {uploadLabel}
          </Button>
        </div>
    </div>
  );
}

'use client';

import { useMemo, useRef, useEffect } from "react";
import { X, Upload, Mic, Square } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { STTState } from "@/domain/speech-to-text";

interface StudyTypeOption {
  value: string;
  label: string;
}

interface RecordingInterfaceProps {
  title: string;
  description: string;
  transcription: string;
  placeholder: string;
  label: string;
  uploadLabel: string;
  onChange: (value: string) => void;
  onUpload: () => void;
  onCancel: () => void;
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
    recording: string;
    connecting: string;
    stop: string;
    studyType: string;
    detecting: string;
  };
}

export function RecordingInterface({
  title,
  description,
  transcription,
  placeholder,
  label,
  uploadLabel,
  onChange,
  onUpload,
  onCancel,
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

  const statusLabel = useMemo(() => {
    if (isConnecting) return labels.connecting;
    if (isRecording) return labels.recording;
    return label;
  }, [isConnecting, isRecording, labels, label]);

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
    if (isActive && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [transcription, isActive]);

  const hasAvailableStudyTypes = availableStudyTypes && availableStudyTypes.length > 0;

  return (
    <Card className="rounded-lg border-2 shadow-2xl bg-card relative p-4 sm:p-6 lg:p-8 flex flex-col h-full">
      <button
        type="button"
        onClick={onCancel}
        className="absolute top-3 right-3 p-2 rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Close"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>

      <div className="space-y-6 flex flex-col flex-1 min-h-0">
        <div className="text-center space-y-3">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-medium ${
            isRecording ? 'bg-red-500/10 text-red-500' :
            isConnecting ? 'bg-blue-500/10 text-blue-500' :
            'bg-primary/10 text-primary'
          }`}>
            <Mic className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} aria-hidden="true" />
            <span>{statusLabel}</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">{description}</p>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={handleMicClick}
            disabled={disabled || isConnecting || isStopping}
            className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label={isRecording ? labels.stop : label}
          >
            {isRecording ? (
              <Square className="w-8 h-8 sm:w-10 sm:h-10" />
            ) : (
              <Mic className="w-8 h-8 sm:w-10 sm:h-10" />
            )}
            {isRecording && (
              <span className="absolute inset-0 rounded-full animate-ping bg-red-500/30" />
            )}
          </button>
        </div>

        {sttError && (
          <div className="text-center text-sm text-red-500 bg-red-500/10 rounded-lg p-3">
            {sttError}
          </div>
        )}

        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          {hasAvailableStudyTypes && (
            <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
              <label htmlFor="study-type" className="text-sm font-medium text-foreground whitespace-nowrap">
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
                  className="flex-1 min-w-[200px] h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {availableStudyTypes?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <Textarea
            ref={textareaRef}
            value={transcription}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="flex-1 text-base leading-relaxed resize-none"
            readOnly={isRecording || isConnecting}
            disabled={disabled && !isActive}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Button
            type="button"
            className="gap-2 text-base h-12 px-6"
            onClick={onUpload}
            disabled={disabled || !transcription.trim() || isActive || isDetectingStudyType}
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            {uploadLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}

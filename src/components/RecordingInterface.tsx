'use client';

import { useRef, useEffect, useCallback, useState } from "react";
import { Sparkles, Mic, Square, Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TemplatePreview } from "@/components/TemplatePreview";
import { useTemplateContent } from "@/hooks/useTemplateContent";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDebouncedTextEditor } from "@/hooks/useDebouncedTextEditor";
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
  // Language (for template fetching)
  language: "en" | "es";
  // Labels
  labels: {
    stop: string;
    studyType: string;
    detecting: string;
  };
  // Generated report props
  generatedReport?: string | null;
  onReportChange?: (value: string) => void;
  isGenerating?: boolean;
  // Report management props
  currentReportId?: string | null;
  reportTitle?: string | null;
  onCopyReport?: () => void;
  onUpdateTranscription?: (value: string) => void;
  onUpdateReport?: (value: string) => void;
  onTemplateChange?: (value: string) => void;
  initialTemplateContent?: string | null;
  onTemplateEditStatusChange?: (isCustom: boolean) => void;
  isTemplateCustom?: boolean;
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
  language,
  labels,
  generatedReport,
  onReportChange,
  isGenerating = false,
  currentReportId,
  reportTitle,
  onCopyReport,
  onUpdateTranscription,
  onUpdateReport,
  onTemplateChange,
  initialTemplateContent,
  onTemplateEditStatusChange,
  isTemplateCustom = false,
}: RecordingInterfaceProps) {
  const { t } = useLanguage();
  const [isCopied, setIsCopied] = useState(false);
  const reportTextareaRef = useRef<HTMLTextAreaElement>(null);

  const effectiveStudyType = selectedStudyType || detectedStudyType || null;
  const { content, isLoading: isTemplateLoading, error: templateError } = useTemplateContent(
    effectiveStudyType,
    language,
    initialTemplateContent
  );
  
  const [editedTemplateContent, setEditedTemplateContent] = useState<string | null>(null);
  const [originalTemplateContent, setOriginalTemplateContent] = useState<string | null>(null);
  const [hasTemplateBeenEdited, setHasTemplateBeenEdited] = useState(false);

  useEffect(() => {
    setEditedTemplateContent(content);
    setOriginalTemplateContent(content);
    setHasTemplateBeenEdited(false); // Reset when new template loads
    onTemplateEditStatusChange?.(false); // Notify parent that template is no longer custom
  }, [content, onTemplateEditStatusChange]);

  const handleTemplateChange = useCallback((value: string) => {
    setEditedTemplateContent(value);
    
    // Check if content differs from original (immediately mark as custom if edited)
    // If originalTemplateContent is null, any non-empty value means it's custom
    // If originalTemplateContent exists, compare trimmed values
    const isDifferent = originalTemplateContent === null
      ? value.trim().length > 0
      : value.trim() !== originalTemplateContent.trim();
    
    setHasTemplateBeenEdited(isDifferent);
    onTemplateEditStatusChange?.(isDifferent);
    
    onTemplateChange?.(value);
  }, [onTemplateChange, originalTemplateContent, onTemplateEditStatusChange]);

  const handleCustomStateReset = useCallback(() => {
    // Reset custom state when a new template is selected
    setHasTemplateBeenEdited(false);
    onTemplateEditStatusChange?.(false);
    // The original template content will be updated when the new template loads
  }, [onTemplateEditStatusChange]);

  const handleCopyReport = useCallback(async () => {
    if (!reportTextareaRef.current || !generatedReport) return;
    
    try {
      const content = reportTextareaRef.current.value || generatedReport || "";
      const contentStartsWithTitle = reportTitle && content.trim().toLowerCase().startsWith(reportTitle.trim().toLowerCase());
      const textToCopy = contentStartsWithTitle 
        ? content 
        : reportTitle 
        ? `${reportTitle}\n\n${content}`
        : content;
      
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      onCopyReport?.();
    } catch (error) {
      // Error handling is done in parent via onCopyReport
    }
  }, [generatedReport, reportTitle, onCopyReport]);

  // Auto-scroll to bottom when new content arrives during generation
  useEffect(() => {
    if (isGenerating && generatedReport && reportTextareaRef.current) {
      const textarea = reportTextareaRef.current;
      // Scroll to bottom
      textarea.scrollTop = textarea.scrollHeight;
    }
  }, [generatedReport, isGenerating]);

  // Debounced transcription editor - always call hook, but only use if onUpdateTranscription is provided
  const transcriptionEditor = useDebouncedTextEditor({
    initialValue: transcription,
    onUpdate: onUpdateTranscription || (() => {}),
    debounceMs: 1500,
  });

  // Debounced report editor - always call hook, but only use if onUpdateReport is provided
  const reportEditor = useDebouncedTextEditor({
    initialValue: generatedReport || '',
    onUpdate: onUpdateReport || (() => {}),
    debounceMs: 1500,
  });

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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {sttError && (
        <div className="text-center text-sm text-red-500 bg-red-500/10 rounded-lg p-3 mb-6 shrink-0">
          {sttError}
        </div>
      )}


      {/* Three-column layout: Left (stacked Transcription + Template), Right (Report) */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">
        {/* Left column: Stacked Transcription and Template */}
        <div className="flex-1 lg:max-w-[50%] flex flex-col gap-4 min-h-0">
          {/* Transcription panel */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            <div className="rounded-xl border-0 shadow-none bg-muted/30 min-h-0 h-full flex flex-col">
              <div className="p-4 border-b border-border shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-foreground">{t("input.title")}</h3>
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
                </div>
              </div>
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <Textarea
                  ref={textareaRef}
                  value={onUpdateTranscription ? transcriptionEditor.value : transcription}
                  onChange={onUpdateTranscription ? (e) => {
                    transcriptionEditor.onChange(e);
                    onChange(e.target.value); // Also update immediately for UI
                  } : (event) => onChange(event.target.value)}
                  onBlur={onUpdateTranscription ? transcriptionEditor.onBlur : undefined}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className="flex-1 text-base leading-relaxed resize-none"
                  readOnly={isRecording || isConnecting}
                  disabled={disabled && !isActive}
                />
              </div>
            </div>
          </div>

          {/* Template Preview panel */}
          <div className="flex-1 min-h-0 flex flex-col">
            <TemplatePreview
              content={editedTemplateContent}
              isLoading={isTemplateLoading}
              error={templateError}
              studyType={effectiveStudyType}
              isDetectingStudyType={isDetectingStudyType}
              onContentChange={handleTemplateChange}
              availableStudyTypes={availableStudyTypes}
              selectedStudyType={selectedStudyType || detectedStudyType || ''}
              onStudyTypeChange={onStudyTypeChange}
              isActive={isActive}
              disabled={disabled}
              isCustom={hasTemplateBeenEdited}
              onCustomStateReset={handleCustomStateReset}
            />
          </div>
        </div>

        {/* Right column: Generated Report */}
        <div className="flex-1 lg:max-w-[50%] min-h-0 flex flex-col">
          <div className="rounded-xl border-0 shadow-none bg-muted/30 min-h-0 h-full flex flex-col">
            <div className="p-4 border-b border-border shrink-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">{t("report.title")}</h3>
                {hasAvailableStudyTypes && (
                  <Button
                    type="button"
                    className="gap-2 text-base h-10 px-6 shrink-0"
                    onClick={onUpload}
                    disabled={disabled || isActive || isDetectingStudyType || (!effectiveStudyType && !isTemplateCustom)}
                  >
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                    {uploadLabel}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
              {generatedReport && currentReportId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 z-10 h-8 w-8 shrink-0"
                  onClick={handleCopyReport}
                  aria-label={t("report.copy")}
                >
                  {isCopied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Textarea
                ref={reportTextareaRef}
                value={onUpdateReport ? reportEditor.value : (generatedReport || '')}
                onChange={onUpdateReport ? (e) => {
                  reportEditor.onChange(e);
                  onReportChange?.(e.target.value); // Also update immediately for UI
                } : (event) => onReportChange?.(event.target.value)}
                onBlur={onUpdateReport ? reportEditor.onBlur : undefined}
                placeholder={isGenerating ? t("app.generateBusy") : t("report.empty")}
                className={`flex-1 text-base leading-relaxed resize-none transition-all duration-300 ${
                  isGenerating 
                    ? 'opacity-70 pointer-events-none' 
                    : 'opacity-100'
                }`}
                readOnly={(!onReportChange && !onUpdateReport) || isGenerating}
              />
              {isGenerating && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-md">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Generate button at the bottom */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center pt-6 pb-4 lg:hidden shrink-0">
        <Button
          type="button"
          className="gap-2 text-base h-12 px-6"
          onClick={onUpload}
          disabled={disabled || isActive || isDetectingStudyType || (!effectiveStudyType && !isTemplateCustom)}
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          {uploadLabel}
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useRef, useEffect, useCallback, useState } from "react";
import { Sparkles, Mic, Square, Copy, Check, Maximize2, Minimize2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TemplatePreview } from "@/components/TemplatePreview";
import { cn } from "@/lib/utils";
import { InputPanelCollapseToggle } from "@/components/InputPanelCollapseToggle";
import { useTemplateContent } from "@/hooks/useTemplateContent";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAutoSave } from "@/hooks/useAutoSave";
import { SaveStatusIndicator } from "@/components/SaveStatusIndicator";
import { useAutoHideScrollbar } from "@/hooks/useAutoHideScrollbar";
import type { STTState } from "@/domain/speech-to-text";

const INPUT_PANEL_ANIMATION_CLASSES = "transition-[max-width,width,flex-basis,opacity] duration-300 ease-in-out";
const REPORT_PANEL_ANIMATION_CLASSES = "transition-[max-width,width,flex-basis] duration-300 ease-in-out";

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
  onRunAutoDetect?: () => void;
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
  reportChatSessionId?: string | null;
  onCopyReport?: () => void;
  onOpenReportChat?: (reportId: string, sessionId: string) => void;
  onUpdateTranscription?: (value: string) => void;
  onUpdateReport?: (value: string) => void;
  onTemplateChange?: (value: string) => void;
  onTemplateSave?: (value: string, isCustom: boolean) => Promise<void>;
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
  onRunAutoDetect,
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
  reportChatSessionId,
  onCopyReport,
  onOpenReportChat,
  onUpdateTranscription,
  onUpdateReport,
  onTemplateChange,
  onTemplateSave,
  initialTemplateContent,
  onTemplateEditStatusChange,
  isTemplateCustom = false,
}: RecordingInterfaceProps) {
  const { t } = useLanguage();
  const [isCopied, setIsCopied] = useState(false);
  const [isInputPanelCollapsed, setIsInputPanelCollapsed] = useState(false);
  const [mobileFullscreen, setMobileFullscreen] = useState<'transcription' | 'template' | 'report' | null>(null);
  const reportTextareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptionScrollbarRef = useAutoHideScrollbar();
  const reportScrollbarRef = useAutoHideScrollbar();
  const mobileContainerRef = useAutoHideScrollbar();
  const prevHasGeneratedReportRef = useRef(false);
  const userToggledInputPanelRef = useRef(false);

  const hasGeneratedReport = Boolean(generatedReport && generatedReport.trim().length > 0);

  // Sync scrollbar refs with textarea refs
  useEffect(() => {
    if (textareaRef.current) {
      (transcriptionScrollbarRef as React.MutableRefObject<HTMLElement | null>).current = textareaRef.current;
    }
  }, [transcriptionScrollbarRef]);

  useEffect(() => {
    if (reportTextareaRef.current) {
      (reportScrollbarRef as React.MutableRefObject<HTMLElement | null>).current = reportTextareaRef.current;
    }
  }, [reportScrollbarRef]);

  const effectiveStudyType = selectedStudyType || detectedStudyType || null;
  const { content, isLoading: isTemplateLoading, error: templateError } = useTemplateContent(
    effectiveStudyType,
    language,
    initialTemplateContent
  );
  
  const [editedTemplateContent, setEditedTemplateContent] = useState<string | null>(null);
  const [originalTemplateContent, setOriginalTemplateContent] = useState<string | null>(null);
  const [hasTemplateBeenEdited, setHasTemplateBeenEdited] = useState(false);
  const templateSaveDisabled = !currentReportId || !onTemplateSave;

  useEffect(() => {
    setEditedTemplateContent(content);
    setOriginalTemplateContent(content);
    setHasTemplateBeenEdited(false); // Reset when new template loads
    onTemplateEditStatusChange?.(false); // Notify parent that template is no longer custom
  }, [content, onTemplateEditStatusChange]);

  useEffect(() => {
    const wasHasReport = prevHasGeneratedReportRef.current;

    // First time we see a generated report after not having one: auto-collapse unless user already toggled
    if (!wasHasReport && hasGeneratedReport && !userToggledInputPanelRef.current) {
      setIsInputPanelCollapsed(true);
    }

    // When there is no generated report, keep 2-column and reset user toggle flag
    if (!hasGeneratedReport) {
      setIsInputPanelCollapsed(false);
      userToggledInputPanelRef.current = false;
    }

    prevHasGeneratedReportRef.current = hasGeneratedReport;
  }, [hasGeneratedReport]);

  const {
    value: templateValue,
    onChange: onTemplateAutoSaveChange,
    onBlur: onTemplateAutoSaveBlur,
  } = useAutoSave({
    initialValue: editedTemplateContent ?? "",
    onSave: onTemplateSave
      ? async (value: string) => {
          await onTemplateSave(value, hasTemplateBeenEdited);
        }
      : async () => {},
    debounceMs: 1500,
    isDisabled: templateSaveDisabled,
    reportId: currentReportId,
  });

  const handleTemplateChange = useCallback((value: string) => {
    setEditedTemplateContent(value);
    
    const isDifferent = originalTemplateContent === null
      ? value.trim().length > 0
      : value.trim() !== originalTemplateContent.trim();
    
    setHasTemplateBeenEdited(isDifferent);
    onTemplateEditStatusChange?.(isDifferent);
    
    onTemplateChange?.(value);

    if (!templateSaveDisabled) {
      onTemplateAutoSaveChange({
        target: { value },
      } as React.ChangeEvent<HTMLTextAreaElement>);
    }
  }, [onTemplateChange, originalTemplateContent, onTemplateEditStatusChange, onTemplateAutoSaveChange, templateSaveDisabled, effectiveStudyType]);

  const handleTemplateBlur = useCallback(
    (value: string) => {
      if (templateSaveDisabled) {
        return;
      }

      onTemplateAutoSaveBlur({
        target: { value },
      } as React.FocusEvent<HTMLTextAreaElement>);
    },
    [onTemplateAutoSaveBlur, templateSaveDisabled],
  );

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

  // Auto-save transcription editor
  // Only enable auto-save if there's a report ID (report has been generated)
  const transcriptionAutoSave = useAutoSave({
    initialValue: transcription,
    onSave: onUpdateTranscription
      ? async (value: string) => {
          await onUpdateTranscription(value);
        }
      : async () => {
          // No-op when handler not provided
        },
    debounceMs: 1500,
    // Allow creating a draft from positive findings even before a report exists
    isDisabled: false,
    reportId: currentReportId,
  });

  // Auto-save report editor
  // Only enable auto-save if there's a report ID (report has been generated)
  const reportAutoSave = useAutoSave({
    initialValue: generatedReport || '',
    onSave: onUpdateReport
      ? async (value: string) => {
          await onUpdateReport(value);
        }
      : async () => {
          // No-op when handler not provided
        },
    debounceMs: 1500,
    isDisabled: isGenerating || !currentReportId, // Prevent saves during report generation or if no report exists
    reportId: currentReportId,
  });

  const isRecording = sttState === 'recording';
  const isConnecting = sttState === 'connecting';
  const isStopping = sttState === 'stopping';
  const currentTranscription = onUpdateTranscription
    ? transcriptionAutoSave.value
    : transcription;
  const hasTranscriptionText = Boolean(currentTranscription?.trim());
  const isActive = isRecording || isConnecting || isStopping;

  const isProcessingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedTextRef = useRef<string>(transcription);
  
  // Constants for undo/redo history
  const MAX_HISTORY_SIZE = 50;
  const HISTORY_DEBOUNCE_MS = 10;

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
    }, HISTORY_DEBOUNCE_MS);

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

  const inputPanelExpandedClasses = "lg:flex-1 lg:basis-1/2 lg:max-w-[50%] lg:opacity-100 lg:overflow-hidden";
  const inputPanelCollapsedClasses = "lg:basis-0 lg:w-0 lg:min-w-0 lg:max-w-0 lg:overflow-hidden lg:opacity-0 lg:flex-[0_0_0]";
  const reportPanelExpandedClasses = "lg:flex-1 lg:basis-1/2 lg:max-w-[50%]";
  const reportPanelFullWidthClasses = "lg:flex-1 lg:basis-full lg:max-w-none";

  const handleToggleInputPanel = useCallback(() => {
    userToggledInputPanelRef.current = true;
    setIsInputPanelCollapsed((prev) => !prev);
  }, []);

  const handleGenerateReport = useCallback(async () => {
    const result = onUpload();
    if (result instanceof Promise) {
      await result;
    }
    setIsInputPanelCollapsed(true);
  }, [onUpload]);

  return (
    <div 
      ref={(node) => {
        if (node) {
          (mobileContainerRef as React.MutableRefObject<HTMLElement | null>).current = node;
        }
      }}
      className="flex flex-col flex-1 min-h-0 overflow-hidden lg:overflow-hidden overflow-y-auto lg:overflow-y-hidden scrollbar-transparent"
    >
      {sttError && (
        <div className="text-center text-sm text-red-500 bg-red-500/10 rounded-lg p-3 mb-6 shrink-0">
          {sttError}
        </div>
      )}


      {/* Three-column layout: Left (stacked Transcription + Template), Right (Report) */}
      {/* Mobile: Stack vertically and allow scrolling. Desktop: Side-by-side with overflow hidden */}
      {/* Mobile fullscreen: When a component is fullscreen, it takes full height */}
      <div className={cn(
        "flex flex-col lg:flex-row gap-2 lg:gap-1.5 flex-1 h-full min-h-0 lg:min-h-0 lg:overflow-hidden",
        mobileFullscreen && "flex-1 h-full"
      )}>
        <InputPanelCollapseToggle
          collapsed={isInputPanelCollapsed}
          onToggle={handleToggleInputPanel}
          ariaLabelExpand={t("recording.expandInputPanel") ?? "Expand input panel"}
          ariaLabelCollapse={t("recording.collapseInputPanel") ?? "Collapse input panel"}
          disabled={!hasGeneratedReport}
        />
        {/* Left column: Stacked Transcription and Template */}
        {/* Mobile: Use auto height to stack naturally. Desktop: Use flex-1 for equal sizing */}
        <div className={cn(
          "flex flex-col gap-4 lg:min-h-0 lg:overflow-hidden",
          mobileFullscreen === 'transcription' && "flex-1 h-full",
          mobileFullscreen === 'template' && "flex-1 h-full",
          isInputPanelCollapsed ? inputPanelCollapsedClasses : inputPanelExpandedClasses,
          INPUT_PANEL_ANIMATION_CLASSES
        )}>
          {/* Transcription panel */}
          {/* Mobile: Use min-height. Desktop: Use flex-1 */}
          <div className={cn(
            "flex flex-col min-h-[200px] lg:flex-1 lg:min-h-0 min-w-0",
            mobileFullscreen && mobileFullscreen !== 'transcription' && "hidden lg:flex",
            mobileFullscreen === 'transcription' && "lg:flex flex-1 h-full"
          )}>
            <div className={cn(
              "rounded-xl border-0 shadow-none bg-muted/30 flex flex-col flex-1",
              mobileFullscreen === 'transcription' ? "h-full" : "min-h-[200px] lg:min-h-0 lg:h-full"
            )}>
              <div className="px-3 py-4 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  {/* Mobile fullscreen button */}
                  <button
                    type="button"
                    onClick={() => setMobileFullscreen(mobileFullscreen === 'transcription' ? null : 'transcription')}
                    className="lg:hidden p-2 rounded-md hover:bg-muted transition-colors"
                    aria-label={mobileFullscreen === 'transcription' ? 'Exit fullscreen' : 'Enter fullscreen'}
                  >
                    {mobileFullscreen === 'transcription' ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">{t("input.title")}</h3>
                    {onUpdateTranscription && currentReportId && (
                      <SaveStatusIndicator
                        status={transcriptionAutoSave.status}
                        error={transcriptionAutoSave.error}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
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
            </div>
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <Textarea
                  ref={textareaRef}
                  value={onUpdateTranscription ? transcriptionAutoSave.value : transcription}
                  onChange={onUpdateTranscription ? (e) => {
                    transcriptionAutoSave.onChange(e);
                    onChange(e.target.value); // Also update immediately for UI
                  } : (event) => onChange(event.target.value)}
                  onBlur={onUpdateTranscription ? transcriptionAutoSave.onBlur : undefined}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className="flex-1 text-base leading-relaxed resize-none scrollbar-transparent"
                  readOnly={isRecording || isConnecting}
                  disabled={disabled && !isActive}
                />
              </div>
            </div>
          </div>

          {/* Template Preview panel */}
          {/* Mobile: Use min-height. Desktop: Use flex-1 */}
          <div className={cn(
            "flex flex-col min-h-[200px] lg:flex-1 lg:min-h-0 shrink-0",
            mobileFullscreen && mobileFullscreen !== 'template' && "hidden lg:flex",
            mobileFullscreen === 'template' && "lg:flex flex-1 h-full"
          )}>
            <TemplatePreview
              content={onTemplateSave ? templateValue : editedTemplateContent}
              isLoading={isTemplateLoading}
              error={templateError}
              studyType={effectiveStudyType}
              isDetectingStudyType={isDetectingStudyType}
              onContentChange={handleTemplateChange}
              onContentBlur={handleTemplateBlur}
              availableStudyTypes={availableStudyTypes}
              selectedStudyType={selectedStudyType || detectedStudyType || ''}
              onStudyTypeChange={onStudyTypeChange}
              onRunAutoDetect={onRunAutoDetect}
              hasTranscriptionText={hasTranscriptionText}
              isActive={isActive}
              disabled={disabled}
              isCustom={hasTemplateBeenEdited}
              onCustomStateReset={handleCustomStateReset}
              isMobileFullscreen={mobileFullscreen === 'template'}
              onMobileFullscreenToggle={() => setMobileFullscreen(mobileFullscreen === 'template' ? null : 'template')}
            />
          </div>
        </div>

        {/* Right column: Generated Report */}
        {/* Mobile: Use min-height. Desktop: Use flex-1 for equal sizing */}
        <div className={cn(
          "flex flex-col min-h-[200px] lg:min-h-0 shrink-0",
          mobileFullscreen && mobileFullscreen !== 'report' && "hidden lg:flex",
          mobileFullscreen === 'report' && "lg:flex flex-1 h-full",
          isInputPanelCollapsed ? reportPanelFullWidthClasses : reportPanelExpandedClasses,
          REPORT_PANEL_ANIMATION_CLASSES
        )}>
          <div className={cn(
            "rounded-xl border-0 shadow-none bg-muted/30 flex flex-col flex-1",
            mobileFullscreen === 'report' ? "h-full" : "min-h-[200px] lg:min-h-0 lg:h-full"
          )}>
            <div className="px-3 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                {/* Mobile fullscreen button */}
                <button
                  type="button"
                  onClick={() => setMobileFullscreen(mobileFullscreen === 'report' ? null : 'report')}
                  className="lg:hidden p-2 rounded-md hover:bg-muted transition-colors"
                  aria-label={mobileFullscreen === 'report' ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {mobileFullscreen === 'report' ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">{t("report.title")}</h3>
                  {onUpdateReport && currentReportId && (
                    <SaveStatusIndicator
                      status={reportAutoSave.status}
                      error={reportAutoSave.error}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {currentReportId && reportChatSessionId && onOpenReportChat && (
                    <Button
                      type="button"
                      className="h-10 w-10 shrink-0"
                      onClick={() => onOpenReportChat(currentReportId, reportChatSessionId)}
                      aria-label="Open report chat"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  )}
                  {hasAvailableStudyTypes && (
                    <Button
                      type="button"
                      className="gap-2 text-base h-10 px-3 sm:px-6 shrink-0"
                      onClick={handleGenerateReport}
                      disabled={disabled || isActive || isDetectingStudyType || (!effectiveStudyType && !isTemplateCustom)}
                    >
                      <Sparkles className="w-6 h-6 sm:w-5 sm:h-5" aria-hidden="true" />
                      <span className="hidden sm:inline">{uploadLabel}</span>
                      <span className="sm:hidden">
                        {uploadLabel === t("recording.regenerate")
                          ? t("recording.regenerateMobile")
                          : language === "es" ? "Generar" : "Generate"}
                      </span>
                    </Button>
                  )}
                </div>
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
                value={onUpdateReport ? reportAutoSave.value : (generatedReport || '')}
                onChange={onUpdateReport ? (e) => {
                  reportAutoSave.onChange(e);
                  onReportChange?.(e.target.value); // Also update immediately for UI
                } : (event) => onReportChange?.(event.target.value)}
                onBlur={onUpdateReport ? reportAutoSave.onBlur : undefined}
                placeholder={isGenerating ? t("app.generateBusy") : t("report.empty")}
                className={`flex-1 text-base leading-relaxed resize-none transition-all duration-300 scrollbar-transparent ${
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
    </div>
  );
}

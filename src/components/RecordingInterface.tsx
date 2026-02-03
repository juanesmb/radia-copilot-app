'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { toast } from "@/components/ui/use-toast";
import { setTemplatePreference } from "@/lib/api";
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
  onUpload: () => void | Promise<void>;
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
  onStudyTypeChange?: (studyType: string, isCustomTemplate?: boolean) => void;
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
  onTemplateMetaChange?: (meta: { templateId: string | null; isSystem: boolean }) => void;
  initialTemplateContent?: string | null;
  onTemplateEditStatusChange?: (isCustom: boolean) => void;
  onTemplateModeChange?: (isCustom: boolean) => void;
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
  onTemplateMetaChange,
  initialTemplateContent,
  onTemplateEditStatusChange,
  onTemplateModeChange,
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
  
  // Track if user has explicitly toggled the switch for this study type
  const userToggledSwitchRef = useRef(false);
  
  // Initialize useDefaultTemplate based on isTemplateCustom prop from parent
  const [useDefaultTemplate, setUseDefaultTemplate] = useState<boolean | undefined>(() => {
    console.log("[RecordingInterface] Initializing useDefaultTemplate:", {
      isTemplateCustom,
      initialTemplateContent: initialTemplateContent?.substring(0, 50) + "...",
      initialTemplateContentLength: initialTemplateContent?.length || 0
    });
    
    if (isTemplateCustom === true) {
      console.log("[RecordingInterface] Starting in custom mode (useDefaultTemplate = false)");
      return false; // Start in custom mode (custom template)
    }
    if (isTemplateCustom === false) {
      console.log("[RecordingInterface] Starting in default mode (useDefaultTemplate = true)");
      return true; // Start in default mode (system template)
    }
    console.log("[RecordingInterface] Letting backend decide (useDefaultTemplate = undefined)");
    return undefined; // Let backend decide only when isTemplateCustom is null/undefined
  });
  
  // Only pass initialTemplateContent when in custom mode (useDefaultTemplate === false)
  // When user explicitly switches to default mode (useDefaultTemplate === true), fetch from API instead
  const effectiveInitialContent = useDefaultTemplate === true ? null : initialTemplateContent;
  
  console.log("[RecordingInterface] useTemplateContent params:", {
  effectiveStudyType,
  language,
  effectiveInitialContent: effectiveInitialContent?.substring(0, 50) + "...",
  useDefault: useDefaultTemplate
});

const { content, templateId, isSystem, hasCustomTemplate, isLoading: isTemplateLoading, error: templateError } = useTemplateContent(
    effectiveStudyType,
    language,
    effectiveInitialContent,
    { useDefault: useDefaultTemplate }
  );
  
  // Sync switch state when:
  // 1. Backend finishes loading and user hasn't toggled manually
  // 2. Parent indicates si el reporte guardado es custom o default
  useEffect(() => {
    if (userToggledSwitchRef.current) {
      return; // User manually toggled, don't override
    }
    
    // Si el padre indica que el reporte es custom/default, respetamos SIEMPRE eso
    if (isTemplateCustom === true) {
      setUseDefaultTemplate(false); // custom
      return;
    }
    if (isTemplateCustom === false) {
      setUseDefaultTemplate(true); // default
      return;
    }

    // Sólo cuando no sabemos (nuevo reporte sin persistir) dejamos que el backend decida
    if (!isTemplateLoading && effectiveStudyType) {
      setUseDefaultTemplate(isSystem);
    }
  }, [isTemplateLoading, isSystem, effectiveStudyType, isTemplateCustom, initialTemplateContent]);
  
  const [editedTemplateContent, setEditedTemplateContent] = useState<string | null>(null);
  const [originalTemplateContent, setOriginalTemplateContent] = useState<string | null>(null);
  const [hasTemplateBeenEdited, setHasTemplateBeenEdited] = useState(false);
  const [isManualTemplateSaving, setIsManualTemplateSaving] = useState(false);
  const lastTemplateMetaRef = useRef<{ templateId: string | null; isSystem: boolean } | null>(null);
  
  // Cache the default template content to avoid unnecessary API calls
  const cachedDefaultTemplateRef = useRef<string | null>(null);
  
  // Track if user just switched to custom mode with no custom template
  const justSwitchedToCustomEmptyRef = useRef(false);

  useEffect(() => {
    console.log("[RecordingInterface] Template content updated:", {
      contentLength: content?.length || 0,
      contentPreview: content?.substring(0, 50) + "...",
      useDefaultTemplate,
      isSystem,
      hasCustomTemplate
    });
    
    if (content && isSystem && !hasCustomTemplate) {
      console.log("[RecordingInterface] Caching default template");
      cachedDefaultTemplateRef.current = content;
    }
    
    // Don't overwrite edited content if user just switched to custom mode and there's no custom template
    // This preserves the empty state we set in handleUseDefaultToggle
    if (justSwitchedToCustomEmptyRef.current) {
      console.log("[RecordingInterface] Preserving empty custom template content");
      justSwitchedToCustomEmptyRef.current = false; // Reset flag
      return;
    }
    
    setEditedTemplateContent(content);
    setOriginalTemplateContent(content);
    setHasTemplateBeenEdited(false); 
  }, [content, isSystem, hasCustomTemplate, useDefaultTemplate]);

  // Track previous values to detect changes
  const prevEffectiveStudyTypeRef = useRef<string | null>(null);
  const prevReportIdRef = useRef<string | null>(null);

  // Reset and set correct switch state when study type or report changes
  useEffect(() => {
    const prevStudyType = prevEffectiveStudyTypeRef.current;
    const prevReportId = prevReportIdRef.current;
    
    // Reset when study type changes OR when report changes
    if (prevStudyType !== effectiveStudyType || prevReportId !== currentReportId) {
      userToggledSwitchRef.current = false;
      justSwitchedToCustomEmptyRef.current = false; // Reset flag
      
      // Clear cached default template when study type changes
      if (prevStudyType !== effectiveStudyType) {
        console.log("[RecordingInterface] Clearing cached default template due to study type change");
        cachedDefaultTemplateRef.current = null;
      }
      
      // Set the switch directly based on parent's indication
      if (isTemplateCustom && initialTemplateContent) {
        setUseDefaultTemplate(false); // Custom mode
      } else {
        setUseDefaultTemplate(undefined); // Let backend decide
      }
    }
    
    prevEffectiveStudyTypeRef.current = effectiveStudyType;
    prevReportIdRef.current = currentReportId ?? null;
  }, [effectiveStudyType, currentReportId, isTemplateCustom, initialTemplateContent]);

  useEffect(() => {
    if (!onTemplateMetaChange) return;

    const next = { templateId, isSystem };
    const prev = lastTemplateMetaRef.current;
    if (prev && prev.templateId === next.templateId && prev.isSystem === next.isSystem) {
      return;
    }

    lastTemplateMetaRef.current = next;
    onTemplateMetaChange(next);
  }, [isSystem, onTemplateMetaChange, templateId]);

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

  // Template autosave has been removed - only manual save via button is supported

  const handleTemplateChange = useCallback((value: string) => {
    setEditedTemplateContent(value);
    
    const isDifferent = originalTemplateContent === null
      ? value.trim().length > 0
      : value.trim() !== originalTemplateContent.trim();
    
    setHasTemplateBeenEdited(isDifferent);
    
    // Informamos al padre únicamente del modo (custom vs default),
    // no de si el contenido es distinto.
    onTemplateEditStatusChange?.(useDefaultTemplate === false);
    
    onTemplateChange?.(value);
  }, [onTemplateChange, originalTemplateContent, onTemplateEditStatusChange, useDefaultTemplate]);

  // Template blur handler removed - no autosave on blur

  const handleCustomStateReset = useCallback(() => {
    // Reset custom state when a new template is selected
    setHasTemplateBeenEdited(false);
    onTemplateEditStatusChange?.(useDefaultTemplate === false);
    userToggledSwitchRef.current = false;
    setUseDefaultTemplate(undefined); // Let backend decide
    // The original template content will be updated when the new template loads
  }, [onTemplateEditStatusChange]);

  const handleUseDefaultToggle = useCallback(
    async (next: boolean) => {
      console.log("[RecordingInterface] handleUseDefaultToggle called:", {
        next,
        effectiveStudyType,
        currentUseDefaultTemplate: useDefaultTemplate,
        hasCustomTemplate
      });
      
      if (!effectiveStudyType) return;
      
      // Mark that user explicitly toggled the switch
      userToggledSwitchRef.current = true;
      
      try {
        await setTemplatePreference({
          studyType: effectiveStudyType,
          language,
          useDefault: next,
        });
        console.log("[RecordingInterface] Setting useDefaultTemplate to:", next);
        setUseDefaultTemplate(next);
        // Notificar al padre que el modo cambió (custom = !next)
        onTemplateModeChange?.(!next);

        // If user switches into custom mode but doesn't have a custom template yet,
        // clear the template text so they start from empty.
        if (!next && !hasCustomTemplate) {
          console.log("[RecordingInterface] Switching to custom mode with no custom template, clearing content");
          justSwitchedToCustomEmptyRef.current = true; // Set flag to prevent overwriting
          setEditedTemplateContent("");
          setOriginalTemplateContent("");
          setHasTemplateBeenEdited(false);
          onTemplateEditStatusChange?.(true); // Switching to custom mode
          onTemplateChange?.("");
        } else if (next) {
          // When switching TO default mode
          setHasTemplateBeenEdited(false);
          onTemplateEditStatusChange?.(false); // Switching to default mode
          
          // If we have a cached default template and no custom template exists, use it
          if (!hasCustomTemplate && cachedDefaultTemplateRef.current) {
            console.log("[RecordingInterface] Using cached default template");
            setEditedTemplateContent(cachedDefaultTemplateRef.current);
            setOriginalTemplateContent(cachedDefaultTemplateRef.current);
          } else {
            // Force template reload by clearing content temporarily
            setEditedTemplateContent(null);
          }
        } else {
          // When switching modes in other cases, reset edit state
          // The useTemplateContent hook will fetch the appropriate template
          setHasTemplateBeenEdited(false);
          // Update parent with the current mode: custom if next is false, default if next is true
          onTemplateEditStatusChange?.(!next);
        }
      } catch (error) {
        console.error("[TemplatePreference] Failed to set preference", error);
      }
    },
    [effectiveStudyType, hasCustomTemplate, language, onTemplateChange, onTemplateEditStatusChange]
  );

  // Mantener sincronizado el padre con el modo actual del switch (custom vs default)
  useEffect(() => {
    onTemplateEditStatusChange?.(useDefaultTemplate === false);
  }, [useDefaultTemplate, onTemplateEditStatusChange]);

  const handleManualTemplateSave = useCallback(async () => {
    if (!onTemplateSave) return;

    try {
      setIsManualTemplateSaving(true);
      
      // If saving from default mode, first switch to custom mode
      const wasInDefaultMode = useDefaultTemplate !== false;
      if (wasInDefaultMode && effectiveStudyType) {
        try {
          await setTemplatePreference({
            studyType: effectiveStudyType,
            language,
            useDefault: false,
          });
          setUseDefaultTemplate(false);
          userToggledSwitchRef.current = true;
        } catch (prefError) {
          console.error("[TemplatePreference] Failed to set preference before save", prefError);
        }
      }
      
      // Now save as custom (isCustom = true since we're now in custom mode)
      const contentToSave = editedTemplateContent?.trim() ?? "";
      if (!contentToSave) {
        toast({
          variant: "destructive",
          title: "No se puede guardar",
          description: "La plantilla no puede estar vacía.",
        });
        return;
      }
      console.log("[RecordingInterface] Calling onTemplateSave:", {
        contentLength: contentToSave?.length || 0,
        isCustom: true,
        useDefaultTemplate,
        hasTemplateBeenEdited,
        effectiveStudyType
      });
      
      await onTemplateSave(contentToSave, true);
      
      toast({
        title: "Cambios guardados",
        description: "Se guardaron tus cambios en la plantilla.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: error instanceof Error ? error.message : "Ocurrió un error al guardar la plantilla.",
      });
    } finally {
      setIsManualTemplateSaving(false);
    }
  }, [effectiveStudyType, language, onTemplateSave, editedTemplateContent, useDefaultTemplate]);

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

  const handleMicClick = useCallback(async () => {
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
  }, [isRecording, isActive, onStopRecording, onStartRecording]);

  useEffect(() => {
    const toggleDictation = () => {
      void handleMicClick();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (e.repeat) {
          return;
        }

        const active = document.activeElement as HTMLElement | null;
        const tag = active?.tagName?.toLowerCase();
        const isEditable =
          tag === 'input' ||
          tag === 'textarea' ||
          Boolean(active?.isContentEditable);

        if (!isEditable) {
          e.preventDefault();
          toggleDictation();
        }
      }

      if (e.code === 'MediaPlayPause') {
        e.preventDefault();
        toggleDictation();
      }
      if (e.code === 'MediaStop') {
        if (sttState === 'recording') {
          e.preventDefault();
          void onStopRecording();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);

    const mediaSession = navigator.mediaSession;
    if (mediaSession?.setActionHandler) {
      try {
        mediaSession.setActionHandler('play', toggleDictation);
        mediaSession.setActionHandler('pause', toggleDictation);
        mediaSession.setActionHandler('stop', () => {
          if (sttState === 'recording') {
            void onStopRecording();
          }
        });
      } catch {
        // Some browsers throw if an action isn't supported.
      }
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (mediaSession?.setActionHandler) {
        try {
          mediaSession.setActionHandler('play', null);
          mediaSession.setActionHandler('pause', null);
          mediaSession.setActionHandler('stop', null);
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [handleMicClick, onStopRecording, sttState]);

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
    await onUpload();
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
              content={editedTemplateContent}
              isLoading={isTemplateLoading}
              error={templateError}
              studyType={effectiveStudyType}
              useDefault={useDefaultTemplate ?? true}
              isCustom={useDefaultTemplate === false}
              onUseDefaultChange={(next) => {
                handleUseDefaultToggle(next);
              }}
              isDetectingStudyType={isDetectingStudyType}
              onContentChange={handleTemplateChange}
              onContentBlur={undefined}
              showSaveButton={Boolean(onTemplateSave && hasTemplateBeenEdited && effectiveStudyType)}
              onSaveClick={onTemplateSave ? handleManualTemplateSave : undefined}
              onCustomStateReset={handleCustomStateReset}
              onRunAutoDetect={onRunAutoDetect}
              hasTranscriptionText={hasTranscriptionText}
              availableStudyTypes={availableStudyTypes}
              selectedStudyType={selectedStudyType || detectedStudyType || ''}
              onStudyTypeChange={(studyType) => {
                onStudyTypeChange?.(studyType, useDefaultTemplate === false);
              }}
              isMobileFullscreen={mobileFullscreen === 'template'}
              onMobileFullscreenToggle={() => setMobileFullscreen(mobileFullscreen === 'template' ? null : 'template')}
              isActive={isActive}
              disabled={disabled || isManualTemplateSaving}
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

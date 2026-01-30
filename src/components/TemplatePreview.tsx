'use client';

import { useEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import { Maximize2, Minimize2, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAutoHideScrollbar } from "@/hooks/useAutoHideScrollbar";
import { cn } from "@/lib/utils";

interface StudyTypeOption {
  value: string;
  label: string;
}

interface TemplatePreviewProps {
  content: string | null;
  isLoading: boolean;
  error: string | null;
  studyType: string | null;
  useDefault?: boolean;
  onUseDefaultChange?: (next: boolean) => void;
  isDetectingStudyType?: boolean;
  onContentChange?: (value: string) => void;
  onContentBlur?: (value: string) => void;
  showSaveButton?: boolean;
  onSaveClick?: () => void;
  onRunAutoDetect?: () => void;
  hasTranscriptionText?: boolean;
  availableStudyTypes?: StudyTypeOption[];
  selectedStudyType?: string;
  onStudyTypeChange?: (studyType: string) => void;
  isActive?: boolean;
  disabled?: boolean;
  isCustom?: boolean;
  onCustomStateReset?: () => void;
  // Mobile fullscreen props
  isMobileFullscreen?: boolean;
  onMobileFullscreenToggle?: () => void;
}

export function TemplatePreview({
  content,
  isLoading,
  error,
  studyType,
  useDefault = false,
  onUseDefaultChange,
  isDetectingStudyType = false,
  onContentChange,
  onContentBlur,
  showSaveButton = false,
  onSaveClick,
  onRunAutoDetect,
  hasTranscriptionText = false,
  availableStudyTypes,
  selectedStudyType,
  onStudyTypeChange,
  isActive = false,
  disabled = false,
  isCustom = false,
  onCustomStateReset,
  isMobileFullscreen = false,
  onMobileFullscreenToggle,
}: TemplatePreviewProps) {
  const { t } = useLanguage();
  const templateScrollbarRef = useAutoHideScrollbar();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync scrollbar ref with textarea ref
  useEffect(() => {
    if (textareaRef.current) {
      (templateScrollbarRef as React.MutableRefObject<HTMLElement | null>).current = textareaRef.current;
    }
  }, [templateScrollbarRef]);

  const renderHeader = () => (
    <div className="px-3 py-4 border-b border-border shrink-0 flex flex-col gap-2 lg:gap-3 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        {onMobileFullscreenToggle && (
          <button
            type="button"
            onClick={onMobileFullscreenToggle}
            className="lg:hidden p-2 rounded-md hover:bg-muted transition-colors shrink-0"
            aria-label={isMobileFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isMobileFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        )}

        <h3 className="text-base font-semibold text-foreground shrink-0 whitespace-nowrap">
          {t("template.title")}
        </h3>
      </div>

      {availableStudyTypes && availableStudyTypes.length > 0 && (
        <div className="flex items-center gap-2 min-w-0">
          <select
            id="study-type"
            value={selectedStudyType || ''}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              const value = e.target.value;
              if (value) {
                onStudyTypeChange?.(value);
                // Reset custom state when a new template is selected
                onCustomStateReset?.();
              } else {
                onStudyTypeChange?.('');
                onCustomStateReset?.();
              }
            }}
            disabled={isActive || disabled || isDetectingStudyType}
            className="min-w-0 flex-1 sm:flex-none sm:w-[240px] md:w-[280px] h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{t("recording.studyTypePlaceholder")}</option>
            {availableStudyTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 shrink-0">
            {typeof onUseDefaultChange === "function" && studyType && (
              <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={useDefault}
                onCheckedChange={(checked) => onUseDefaultChange(checked)}
                disabled={isActive || disabled || isDetectingStudyType}
              />
              <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">
                Usar plantilla por defecto
              </span>
              </div>
            )}
            {showSaveButton && (
              <Button
                type="button"
                className="gap-2 text-sm h-10 w-10 p-0 sm:w-auto sm:px-3 shrink-0 whitespace-nowrap"
                onClick={onSaveClick}
                disabled={!onSaveClick || isActive || disabled || isDetectingStudyType}
              >
                <Save className="w-5 h-5" />
              </Button>
            )}
            <Button
              type="button"
              className="gap-2 text-sm h-10 w-10 p-0 sm:w-auto sm:px-3 shrink-0 whitespace-nowrap"
              onClick={onRunAutoDetect}
              disabled={!hasTranscriptionText || isActive || disabled || isDetectingStudyType}
            >
              <Sparkles className="w-6 h-6 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">{t("template.autoDetect")}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <Card className="h-full lg:h-full flex flex-col border-0 shadow-none bg-muted/30 min-h-[200px] lg:min-h-0">
        {renderHeader()}
        <div className="flex-1 p-4">
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
            <div className="h-4 bg-muted rounded w-4/5" />
            <div className="h-4 bg-muted rounded w-full" />
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full lg:h-full flex flex-col border-0 shadow-none bg-muted/30 min-h-[200px] lg:min-h-0">
        {renderHeader()}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-destructive font-medium">{t("template.error")}</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (isDetectingStudyType) {
    return (
      <Card className="h-full lg:h-full flex flex-col border-0 shadow-none bg-muted/30 min-h-[200px] lg:min-h-0">
        {renderHeader()}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">{t("template.detecting")}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "h-full lg:h-full flex flex-col border-0 shadow-none bg-muted/30",
      isMobileFullscreen ? "h-full" : "min-h-[200px] lg:min-h-0"
    )}>
      {renderHeader()}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Textarea
          ref={textareaRef}
          value={content || ''}
          onChange={(e) => onContentChange?.(e.target.value)}
          onBlur={(e) => onContentBlur?.(e.target.value)}
          className="flex-1 text-base leading-relaxed resize-none scrollbar-transparent"
          readOnly={!onContentChange}
          placeholder={!content ? t("template.empty") : undefined}
        />
      </div>
    </Card>
  );
}

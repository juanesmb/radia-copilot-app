'use client';

import { useEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Card } from "@/components/ui/card";
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
  isDetectingStudyType?: boolean;
  onContentChange?: (value: string) => void;
  // Template detection toggle
  isAutoDetectTemplate?: boolean;
  onAutoDetectTemplateChange?: (isEnabled: boolean) => void;
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
  isDetectingStudyType = false,
  onContentChange,
  isAutoDetectTemplate = true,
  onAutoDetectTemplateChange,
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
    <div className="p-4 border-b border-border shrink-0">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">
          {t("template.title")}
        </h3>
        <div className="flex items-center gap-2">
          {/* Mobile fullscreen button */}
          {onMobileFullscreenToggle && (
            <button
              type="button"
              onClick={onMobileFullscreenToggle}
              className="lg:hidden p-2 rounded-md hover:bg-muted transition-colors"
              aria-label={isMobileFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isMobileFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {availableStudyTypes && availableStudyTypes.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-foreground select-none">
            <input
              type="checkbox"
              checked={isAutoDetectTemplate}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onAutoDetectTemplateChange?.(e.target.checked)
              }
              disabled={isActive || disabled}
              className="h-4 w-4 rounded border border-input bg-background"
            />
            {t("template.autoDetect")}
          </label>

          <div className="flex items-center gap-2 min-w-0">
            <select
              id="study-type"
              value={isCustom ? 'custom' : (selectedStudyType || '')}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                const value = e.target.value;
                if (value === 'custom') {
                  // Don't allow selecting custom - it's just a display value
                  return;
                }
                if (value) {
                  onStudyTypeChange?.(value);
                  // Reset custom state when a new template is selected
                  onCustomStateReset?.();
                } else {
                  onStudyTypeChange?.('');
                  onCustomStateReset?.();
                }
              }}
              disabled={isActive || disabled || isAutoDetectTemplate || isDetectingStudyType}
              className="flex-1 min-w-0 h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{t("recording.studyTypePlaceholder")}</option>
              <option value="custom" disabled={!isCustom}>
                {t("recording.customTemplate")}
              </option>
              {availableStudyTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
          className="flex-1 text-base leading-relaxed resize-none scrollbar-transparent"
          readOnly={!onContentChange}
          placeholder={!content ? t("template.empty") : undefined}
        />
      </div>
    </Card>
  );
}

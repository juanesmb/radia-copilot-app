'use client';

import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";

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
  availableStudyTypes?: StudyTypeOption[];
  selectedStudyType?: string;
  onStudyTypeChange?: (studyType: string) => void;
  isActive?: boolean;
  disabled?: boolean;
  isCustom?: boolean;
  onCustomStateReset?: () => void;
}

export function TemplatePreview({
  content,
  isLoading,
  error,
  studyType,
  isDetectingStudyType = false,
  onContentChange,
  availableStudyTypes,
  selectedStudyType,
  onStudyTypeChange,
  isActive = false,
  disabled = false,
  isCustom = false,
  onCustomStateReset,
}: TemplatePreviewProps) {
  const { t } = useLanguage();
  
  // Debug: log when isCustom changes
  useEffect(() => {
    if (isCustom) {
      console.log('[TemplatePreview] Template is now custom');
    }
  }, [isCustom]);

  const renderHeader = () => (
    <div className="p-4 border-b border-border shrink-0">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">
          {t("template.title")}
        </h3>
        {availableStudyTypes && availableStudyTypes.length > 0 && (
          <>
            {isDetectingStudyType ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                {t("recording.detecting")}
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0 max-w-[280px]">
                <select
                  id="study-type"
                  value={isCustom ? 'custom' : (selectedStudyType || '')}
                  onChange={(e) => {
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
                  disabled={isActive || disabled}
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
            )}
          </>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col border-0 shadow-none bg-muted/30">
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
      <Card className="h-full flex flex-col border-0 shadow-none bg-muted/30">
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
      <Card className="h-full flex flex-col border-0 shadow-none bg-muted/30">
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
    <Card className="h-full flex flex-col border-0 shadow-none bg-muted/30 min-h-0">
      {renderHeader()}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Textarea
          value={content || ''}
          onChange={(e) => onContentChange?.(e.target.value)}
          className="flex-1 text-base leading-relaxed resize-none"
          readOnly={!onContentChange}
          placeholder={!content ? t("template.empty") : undefined}
        />
      </div>
    </Card>
  );
}

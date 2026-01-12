'use client';

import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";

interface TemplatePreviewProps {
  content: string | null;
  isLoading: boolean;
  error: string | null;
  studyType: string | null;
  isDetectingStudyType?: boolean;
  onContentChange?: (value: string) => void;
}

export function TemplatePreview({
  content,
  isLoading,
  error,
  studyType,
  isDetectingStudyType = false,
  onContentChange,
}: TemplatePreviewProps) {
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col border-0 shadow-none bg-muted/30">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{t("template.title")}</h3>
        </div>
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
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{t("template.title")}</h3>
        </div>
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
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{t("template.title")}</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">{t("template.detecting")}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!studyType || !content) {
    return (
      <Card className="h-full flex flex-col border-0 shadow-none bg-muted/30">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{t("template.title")}</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            {t("template.empty")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col border-0 shadow-none bg-muted/30 min-h-0">
      <div className="p-4 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-foreground">{t("template.title")}</h3>
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Textarea
          value={content || ''}
          onChange={(e) => onContentChange?.(e.target.value)}
          className="flex-1 text-base leading-relaxed resize-none"
          readOnly={!onContentChange}
        />
      </div>
    </Card>
  );
}

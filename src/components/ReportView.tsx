'use client';

import { useRef, useState } from "react";
import { Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EditableTextarea } from "@/components/EditableTextarea";
import type { ReportHistoryItem } from "@/utils/reportHistory";

const COPY_FEEDBACK_DURATION_MS = 2000;

interface ReportViewLabels {
  empty: string;
  loading: string;
  date: string;
  template: string;
  transcription: string;
  copy: string;
  copied: string;
  disclaimer: string;
}

interface ReportViewProps {
  report: ReportHistoryItem | null;
  isLoading: boolean;
  labels: ReportViewLabels;
  onUpdateReport: (value: string) => void;
  onUpdateTranscription: (value: string) => void;
}

export function ReportView({
  report,
  isLoading,
  labels,
  onUpdateReport,
  onUpdateTranscription,
}: ReportViewProps) {
  const reportTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!report || !reportTextareaRef.current) return;
    
    try {
      const content = reportTextareaRef.current.value || report.report || "";
      const contentStartsWithTitle = content.trim().toLowerCase().startsWith(report.title.trim().toLowerCase());
      const textToCopy = contentStartsWithTitle 
        ? content 
        : `${report.title}\n\n${content}`;
      
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPY_FEEDBACK_DURATION_MS);
    } catch (error) {
      console.error("[ReportView] Failed to copy report", error);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse rounded-lg border border-dashed border-muted p-6 text-sm text-muted-foreground">
          {labels.loading}
        </div>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        {labels.empty}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 border-0 shadow-none">
        <h3 className="text-lg font-semibold">{report.title}</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Report ID</p>
            <p className="text-sm font-medium">{report.id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">{labels.date}</p>
            <p className="text-sm font-medium">
              {report.createdAt.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
          {report.usedTemplate && (
            <div>
              <p className="text-xs text-muted-foreground uppercase">{labels.template}</p>
              <p className="text-sm font-medium">{report.usedTemplate}</p>
            </div>
          )}
        </div>
      </Card>

      <Card className="space-y-3 border-0 shadow-none">
        <h3 className="text-lg font-semibold">{labels.transcription}</h3>
        <EditableTextarea
          value={report.transcription || ""}
          onUpdate={onUpdateTranscription}
          className="text-sm text-muted-foreground min-h-[100px] p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          style={{ wordBreak: "break-word" }}
        />
      </Card>

      <Card className="border-0 shadow-none">
        <div className="bg-muted/50 rounded-lg p-1.5 sm:p-2 xl:p-3 2xl:p-4 3xl:p-5 mb-6">
          <div className="flex items-center justify-between gap-2 sm:gap-3 mb-1.5 sm:mb-2 xl:mb-3 2xl:mb-4 3xl:mb-5">
            <div className="flex-1 bg-yellow-500/10 border border-yellow-500/20 rounded-md p-1.5 sm:p-2 xl:p-2.5 text-[10px] sm:text-xs text-yellow-600 dark:text-yellow-500">
              <p className="font-medium">{labels.disclaimer}</p>
            </div>
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="aspect-square h-10 w-10 sm:h-9 sm:w-9 flex-shrink-0 p-0"
              aria-label={isCopied ? labels.copied : labels.copy}
            >
              {isCopied ? (
                <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              ) : (
                <Copy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              )}
            </Button>
          </div>
          <EditableTextarea
            ref={reportTextareaRef}
            value={report.report || ""}
            onUpdate={onUpdateReport}
            className="text-sm sm:text-base xl:text-base 2xl:text-base 3xl:text-base text-foreground leading-relaxed min-h-[200px] sm:min-h-[300px] xl:min-h-[400px] 2xl:min-h-[500px] 3xl:min-h-[600px] p-2 sm:p-3 xl:p-4 2xl:p-6 3xl:p-8 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            style={{
              wordBreak: "break-word",
            }}
          />
        </div>
      </Card>
    </div>
  );
}


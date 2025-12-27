'use client';

import { useMemo, useRef, useEffect, useCallback, useState } from "react";
import { Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import type { ReportHistoryItem } from "@/utils/reportHistory";

interface ReportViewLabels {
  empty: string;
  loading: string;
  date: string;
  template: string;
  transcription: string;
  copy: string;
  copied: string;
  transcriptionEmpty: string;
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
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const transcriptionRef = useRef<HTMLDivElement>(null);
  const [isCopied, setIsCopied] = useState(false);

  const combinedContent = useMemo(() => {
    if (!report) return "";
    // Only show the report field, not the title
    return report.report || "";
  }, [report]);

  useEffect(() => {
    if (editorRef.current && report) {
      const currentText = editorRef.current.textContent || "";
      if (currentText !== combinedContent && document.activeElement !== editorRef.current) {
        editorRef.current.textContent = combinedContent;
      }
    }
  }, [combinedContent, report]);

  const handleCopy = async () => {
    if (!report || !editorRef.current) return;
    try {
      const content = editorRef.current.innerText || editorRef.current.textContent || "";
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      toast({ title: labels.copied });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast({
        title: labels.copy,
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync transcription content when report changes (only if not focused)
  useEffect(() => {
    if (transcriptionRef.current && report) {
      const transcriptionContent = report.transcription || "";
      // Only update DOM if element is not focused (prevents cursor reset)
      if (document.activeElement !== transcriptionRef.current) {
        transcriptionRef.current.textContent = transcriptionContent;
      }
    }
  }, [report?.id, report?.transcription]);

  const handleTranscriptionBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!report) return;
    const newTranscription = (e.currentTarget.textContent || "").trim();
    if (newTranscription !== report.transcription) {
      if (transcriptionDebounceRef.current) {
        clearTimeout(transcriptionDebounceRef.current);
      }
      onUpdateTranscription(newTranscription);
    }
  }, [report, onUpdateTranscription]);

  const handleTranscriptionInput = useCallback(() => {
    if (!report || !transcriptionRef.current) return;
    
    if (transcriptionDebounceRef.current) {
      clearTimeout(transcriptionDebounceRef.current);
    }
    
    transcriptionDebounceRef.current = setTimeout(() => {
      if (!transcriptionRef.current) return;
      const newTranscription = (transcriptionRef.current.textContent || "").trim();
      if (newTranscription !== report.transcription) {
        onUpdateTranscription(newTranscription);
      }
    }, 1000);
  }, [report, onUpdateTranscription]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!report) return;
    const fullContent = e.currentTarget.textContent || e.currentTarget.innerText || "";
    
    // Only update the report field, not the title
    const newReport = fullContent.trim();
    if (newReport !== report.report) {
      // Clear any pending debounce
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      // Update immediately on blur
      onUpdateReport(newReport);
    }
  }, [report, onUpdateReport]);

  const handleInput = useCallback(() => {
    if (!report || !editorRef.current) return;
    
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Debounce the update
    debounceTimeoutRef.current = setTimeout(() => {
      if (!editorRef.current) return;
      const fullContent = editorRef.current.textContent || editorRef.current.innerText || "";
      const newReport = fullContent.trim();
      if (newReport !== report.report) {
        onUpdateReport(newReport);
      }
    }, 1000); // 1 second debounce
  }, [report, onUpdateReport]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (transcriptionDebounceRef.current) {
        clearTimeout(transcriptionDebounceRef.current);
      }
    };
  }, []);

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
        <div
          ref={transcriptionRef}
          contentEditable
          suppressContentEditableWarning
          className="text-sm text-muted-foreground whitespace-pre-wrap min-h-[100px] p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          onBlur={handleTranscriptionBlur}
          onInput={handleTranscriptionInput}
          style={{ wordBreak: "break-word" }}
        />
      </Card>

      <Card className="border-0 shadow-none">
        <div className="bg-muted/50 rounded-lg p-1.5 sm:p-2 xl:p-3 2xl:p-4 3xl:p-5">
          <div className="flex items-center justify-between gap-2 sm:gap-3 mb-1.5 sm:mb-2 xl:mb-3 2xl:mb-4 3xl:mb-5">
            <div className="flex-1 bg-yellow-500/10 border border-yellow-500/20 rounded-md p-1.5 sm:p-2 xl:p-2.5 text-[10px] sm:text-xs text-yellow-600 dark:text-yellow-500">
              <p className="font-medium">{labels.disclaimer}</p>
            </div>
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="gap-1 sm:gap-2 p-1.5 sm:p-2 flex-shrink-0"
              aria-label={isCopied ? labels.copied : labels.copy}
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              ) : (
                <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </Button>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="text-sm sm:text-base xl:text-base 2xl:text-base 3xl:text-base text-foreground leading-relaxed whitespace-pre-wrap min-h-[200px] sm:min-h-[300px] xl:min-h-[400px] 2xl:min-h-[500px] 3xl:min-h-[600px] p-2 sm:p-3 xl:p-4 2xl:p-6 3xl:p-8 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            onBlur={handleBlur}
            onInput={handleInput}
            style={{
              wordBreak: "break-word",
            }}
          />
        </div>
      </Card>
    </div>
  );
}


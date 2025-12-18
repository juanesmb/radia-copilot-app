'use client';

import React, { useMemo, useRef, useEffect, useCallback } from "react";
import { Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextEditorToolbar } from "@/components/TextEditorToolbar";
import { useToast } from "@/components/ui/use-toast";
import type { ReportHistoryItem } from "@/utils/reportHistory";

interface ReportViewLabels {
  empty: string;
  loading: string;
  caseInfo: string;
  caseId: string;
  date: string;
  transcription: string;
  copy: string;
  copied: string;
  transcriptionEmpty: string;
  generatedTitle: string;
}

interface ReportViewProps {
  report: ReportHistoryItem | null;
  isLoading: boolean;
  labels: ReportViewLabels;
  onUpdateTitle: (value: string) => void;
  onUpdateReport: (value: string) => void;
  onUpdateTranscription: (value: string) => void;
}

export function ReportView({
  report,
  isLoading,
  labels,
  onUpdateTitle,
  onUpdateReport,
  onUpdateTranscription,
}: ReportViewProps) {
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const transcriptionRef = useRef<HTMLDivElement>(null);
  const [isCopied, setIsCopied] = React.useState(false);

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

  const handleCommand = (command: string) => {
    document.execCommand(command, false);
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
      <Card className="p-4 sm:p-6 space-y-4">
        <h3 className="text-lg font-semibold">{labels.caseInfo}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase">{labels.caseId}</p>
            <p className="text-sm font-medium">{report.metadata.caseId}</p>
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
        </div>
      </Card>

      <Card className="p-4 sm:p-6 space-y-3">
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

      <Card className="p-4 sm:p-6 xl:p-8 2xl:p-10 3xl:p-12 border-2">
        <div className="bg-muted/50 rounded-lg p-3 sm:p-4 xl:p-6 2xl:p-8 3xl:p-10">
          <div className="flex items-center justify-between mb-3 sm:mb-4 xl:mb-6 2xl:mb-8 3xl:mb-10">
            <h3 className="text-lg sm:text-xl xl:text-xl 2xl:text-xl 3xl:text-xl font-semibold text-foreground">
              {labels.generatedTitle}
            </h3>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                className="gap-1 sm:gap-2 p-1.5 sm:p-2"
                aria-label={isCopied ? labels.copied : labels.copy}
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                ) : (
                  <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
              </Button>
              <TextEditorToolbar onCommand={handleCommand} editorRef={editorRef} />
            </div>
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


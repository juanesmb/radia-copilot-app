'use client';

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReportCard } from "@/components/ReportCard";
import type { ReportHistoryItem } from "@/utils/reportHistory";

interface ReportsSubmenuProps {
  reports: ReportHistoryItem[];
  selectedReportId: string | null;
  copiedReportId: string | null;
  onSelectReport: (reportId: string) => void;
  onCopyReport: (report: ReportHistoryItem) => void;
  onGenerateReport: () => void;
  isRecording?: boolean;
  generateLabel: string;
  subtitleLabel: string;
  emptyLabel: string;
  copyLabel: string;
  copiedLabel: string;
}

export function ReportsSubmenu({
  reports,
  selectedReportId,
  copiedReportId,
  onSelectReport,
  onCopyReport,
  onGenerateReport,
  isRecording = false,
  generateLabel,
  subtitleLabel,
  emptyLabel,
  copyLabel,
  copiedLabel,
}: ReportsSubmenuProps) {
  return (
    <div className="w-full lg:w-64 flex flex-col h-full bg-background lg:border-r border-border">
      <div className="hidden lg:flex flex-shrink-0 px-2 pt-4 pb-2 border-b border-border bg-background/80 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          {subtitleLabel}
        </h2>
      </div>

      {reports.length === 0 ? (
        <div className="flex-1 flex flex-col p-2">
          <div className="pb-2">
            <Button
              type="button"
              className="w-full justify-center gap-2 h-10"
              onClick={onGenerateReport}
              disabled={isRecording}
              aria-pressed={isRecording}
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              {generateLabel}
            </Button>
          </div>
          <Card className="flex-1 flex items-center justify-center p-6 border-2 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </Card>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="px-2 pt-2 pb-2">
            <Button
              type="button"
              className="w-full justify-center gap-2 h-10"
              onClick={onGenerateReport}
              disabled={isRecording}
              aria-pressed={isRecording}
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              {generateLabel}
            </Button>
          </div>
          <div className="flex-1 p-2 space-y-3">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                isSelected={selectedReportId === report.id}
                isCopied={copiedReportId === report.id}
                onSelect={onSelectReport}
                onCopy={onCopyReport}
                copyLabel={copyLabel}
                copiedLabel={copiedLabel}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

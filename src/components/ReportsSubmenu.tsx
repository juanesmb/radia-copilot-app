'use client';

import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { ReportCard } from "@/components/ReportCard";
import { useAutoHideScrollbar } from "@/hooks/useAutoHideScrollbar";
import type { ReportHistoryItem } from "@/utils/reportHistory";

interface ReportsSubmenuProps {
  reports: ReportHistoryItem[];
  selectedReportId: string | null;
  copiedReportId: string | null;
  onSelectReport: (reportId: string) => void;
  onCopyReport: (report: ReportHistoryItem) => void;
  subtitleLabel: string;
  emptyLabel: string;
  copyLabel: string;
  copiedLabel: string;
  untitledLabel: string;
}

export function ReportsSubmenu({
  reports,
  selectedReportId,
  copiedReportId,
  onSelectReport,
  onCopyReport,
  subtitleLabel,
  emptyLabel,
  copyLabel,
  copiedLabel,
  untitledLabel,
}: ReportsSubmenuProps) {
  const reportsScrollbarRef = useAutoHideScrollbar();
  const reportsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reportsContainerRef.current) {
      (reportsScrollbarRef as React.MutableRefObject<HTMLElement | null>).current = reportsContainerRef.current;
    }
  }, [reportsScrollbarRef]);

  return (
    <div className="w-full lg:w-64 flex flex-col h-full bg-background overflow-hidden border-r border-border">
      <div className="hidden lg:flex flex-shrink-0 px-2 pt-4 pb-2 border-b border-border bg-background/80 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          {subtitleLabel}
        </h2>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {reports.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <Card className="w-full border-2 text-center text-sm text-muted-foreground">{emptyLabel}</Card>
          </div>
        ) : (
          <div
            ref={reportsContainerRef}
            className="flex-1 p-2 space-y-3 overflow-y-auto min-h-0 scrollbar-transparent"
          >
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
                untitledLabel={untitledLabel}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

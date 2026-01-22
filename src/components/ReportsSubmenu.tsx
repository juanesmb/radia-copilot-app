'use client';

import { useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReportCard } from "@/components/ReportCard";
import { useAutoHideScrollbar } from "@/hooks/useAutoHideScrollbar";
import type { ReportHistoryItem } from "@/utils/reportHistory";

interface ReportsSubmenuProps {
  reports: ReportHistoryItem[];
  selectedReportId: string | null;
  copiedReportId: string | null;
  reportChatSessions: Record<string, string>;
  onSelectReport: (reportId: string) => void;
  onCopyReport: (report: ReportHistoryItem) => void;
  onOpenReportChat: (reportId: string, sessionId: string) => void;
  onGenerateReport: () => void;
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
  reportChatSessions,
  onSelectReport,
  onCopyReport,
  onOpenReportChat,
  onGenerateReport,
  generateLabel,
  subtitleLabel,
  emptyLabel,
  copyLabel,
  copiedLabel,
}: ReportsSubmenuProps) {
  const reportsScrollbarRef = useAutoHideScrollbar();
  const reportsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reportsContainerRef.current) {
      (reportsScrollbarRef as React.MutableRefObject<HTMLElement | null>).current = reportsContainerRef.current;
    }
  }, [reportsScrollbarRef]);

  return (
    <div className="w-full lg:w-64 flex flex-col h-full bg-background lg:border-r border-border overflow-hidden">
      <div className="hidden lg:flex flex-shrink-0 px-2 pt-4 pb-2 border-b border-border bg-background/80 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          {subtitleLabel}
        </h2>
      </div>

      {reports.length === 0 ? (
        <div className="flex-1 flex flex-col p-2">
          <div className="pb-2">
            <div className="flex items-center gap-2">
              {selectedReportId && reportChatSessions[selectedReportId] && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() =>
                    onOpenReportChat(
                      selectedReportId,
                      reportChatSessions[selectedReportId]
                    )
                  }
                  aria-label="Open report chat"
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                className="w-full justify-center gap-2 h-10"
                onClick={onGenerateReport}
              >
                {generateLabel}
              </Button>
            </div>
          </div>
          <Card className="flex-1 flex items-center justify-center p-6 border-2 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </Card>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-2 pt-2 pb-2 shrink-0">
            <div className="flex items-center gap-2">
              {selectedReportId && reportChatSessions[selectedReportId] && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() =>
                    onOpenReportChat(
                      selectedReportId,
                      reportChatSessions[selectedReportId]
                    )
                  }
                  aria-label="Open report chat"
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                className="w-full justify-center gap-2 h-10"
                onClick={onGenerateReport}
              >
                {generateLabel}
              </Button>
            </div>
          </div>
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
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

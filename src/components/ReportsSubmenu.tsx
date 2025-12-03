'use client';

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReportCard } from "@/components/ReportCard";
import type { ReportHistoryItem } from "@/utils/reportHistory";

interface ReportsSubmenuProps {
  isOpen: boolean;
  reports: ReportHistoryItem[];
  selectedReportId: string | null;
  copiedReportId: string | null;
  onSelectReport: (reportId: string) => void;
  onCopyReport: (report: ReportHistoryItem) => void;
  onGenerateReport: () => void;
  title: string;
  generateLabel: string;
  emptyLabel: string;
  copyLabel: string;
  copiedLabel: string;
  className?: string;
}

export function ReportsSubmenu({
  isOpen,
  reports,
  selectedReportId,
  copiedReportId,
  onSelectReport,
  onCopyReport,
  onGenerateReport,
  title,
  generateLabel,
  emptyLabel,
  copyLabel,
  copiedLabel,
  className = "",
}: ReportsSubmenuProps) {
  const isMobile = className.includes("flex");
  
  return (
    <div
      data-column="left"
      className={cn(
        "lg:flex-shrink-0 flex flex-col overflow-hidden border-r border-border bg-background transition-[width,max-width,opacity,transform,border-right] duration-700 ease-in-out will-change-[width,max-width,opacity,transform]",
        isMobile
          ? "w-full opacity-100 translate-x-0"
          : isOpen
            ? "lg:max-w-xs xl:max-w-sm 2xl:max-w-md 3xl:max-w-lg lg:w-[280px] xl:w-[320px] 2xl:w-[360px] 3xl:w-[420px] lg:opacity-100 lg:translate-x-0"
            : "lg:max-w-0 lg:w-0 lg:opacity-0 lg:-translate-x-6 lg:pointer-events-none",
        isMobile ? "flex" : "hidden lg:flex",
        className
      )}
      style={{ height: isMobile ? "100%" : "calc(100vh - 4rem)" }}
    >
      <div className="flex-shrink-0 p-4 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <Button
            type="button"
            size="lg"
            className="w-full justify-center gap-2"
            onClick={onGenerateReport}
          >
            {generateLabel}
          </Button>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="p-4 flex-1 overflow-y-auto">
          <Card className="p-6 border-2 h-full flex items-center justify-center text-center text-sm text-muted-foreground">
            {emptyLabel}
          </Card>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
      )}
    </div>
  );
}



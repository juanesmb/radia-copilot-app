'use client';

import { Check, Copy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ReportHistoryItem } from "@/utils/reportHistory";

interface ReportCardProps {
  report: ReportHistoryItem;
  isSelected: boolean;
  isCopied: boolean;
  onSelect: (reportId: string) => void;
  onCopy: (report: ReportHistoryItem) => void;
  copyLabel: string;
  copiedLabel: string;
}

export function ReportCard({
  report,
  isSelected,
  isCopied,
  onSelect,
  onCopy,
  copyLabel,
  copiedLabel,
}: ReportCardProps) {
  const handleCopy = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  onCopy(report);
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(report.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(report.id);
        }
      }}
      className={`p-4 border-2 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
        isSelected ? "border-primary bg-primary/5 shadow-md" : "hover:border-primary/50"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className={`text-xs font-semibold truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
            {report.title || "Untitled report"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {report.createdAt.toLocaleString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleCopy}
          aria-label={isCopied ? copiedLabel : copyLabel}
        >
          {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </Card>
  );
}



'use client';

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReportsEmptyStateProps {
  message: string;
  onGenerateReport: () => void;
  generateLabel: string;
}

export function ReportsEmptyState({
  message,
  onGenerateReport,
  generateLabel,
}: ReportsEmptyStateProps) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center space-y-4 bg-muted/10 mx-4">
      <p className="text-base text-muted-foreground max-w-2xl mx-auto">
        {message}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          type="button"
          className="w-full justify-center gap-2 h-10"
          onClick={onGenerateReport}
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          {generateLabel}
        </Button>
      </div>
    </div>
  );
}
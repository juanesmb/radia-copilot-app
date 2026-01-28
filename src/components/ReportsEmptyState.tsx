'use client';

import { Card } from "@/components/ui/card";

interface ReportsEmptyStateProps {
  label: string;
}

export function ReportsEmptyState({ label }: ReportsEmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full border-2 text-center text-sm text-muted-foreground">{label}</Card>
    </div>
  );
}

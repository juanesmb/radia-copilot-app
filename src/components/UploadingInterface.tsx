'use client';

import { Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";

interface UploadingInterfaceProps {
  progress: number;
  steps: string[];
  title: string;
  subtitle: string;
  completeLabel: string;
}

export function UploadingInterface({
  progress,
  steps,
  title,
  subtitle,
  completeLabel,
}: UploadingInterfaceProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <Card className="rounded-lg border-2 shadow-2xl bg-card p-6 sm:p-8 lg:p-10 flex flex-col gap-8 items-center text-center">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>{title}</span>
        </div>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      <div className="w-full space-y-4">
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${clampedProgress}%` }}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={clampedProgress}
            role="progressbar"
          />
        </div>
        <p className="text-sm font-medium text-foreground">
          {clampedProgress >= 100 ? completeLabel : `${Math.floor(clampedProgress)}%`}
        </p>
      </div>

      <div className="grid gap-3 w-full max-w-md">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              clampedProgress >= ((index + 1) / steps.length) * 100 ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="w-6 h-6 rounded-full border border-primary flex items-center justify-center text-xs font-semibold text-primary">
              {index + 1}
            </div>
            <p className="text-sm text-left">{step}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}



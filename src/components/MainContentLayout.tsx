'use client';

import { cn } from "@/lib/utils";

interface MainContentLayoutProps {
  rightPanel: React.ReactNode;
  className?: string;
}

export function MainContentLayout({ rightPanel, className = "" }: MainContentLayoutProps) {
  return (
    <div className={cn("flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto p-3", className)}>
      {rightPanel}
    </div>
  );
}
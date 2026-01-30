'use client';

import { cn } from "@/lib/utils";

interface MainContentLayoutProps {
  header?: React.ReactNode;
  rightPanel: React.ReactNode;
  className?: string;
}

export function MainContentLayout({ header, rightPanel, className = "" }: MainContentLayoutProps) {
  return (
    <div className={cn("flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto", className)}>
      <div className="w-full flex-shrink-0">{header}</div>
      <div className="flex-1 min-h-0 pt-0 pr-1 pb-1 pl-0 flex flex-col">{rightPanel}</div>
    </div>
  );
}
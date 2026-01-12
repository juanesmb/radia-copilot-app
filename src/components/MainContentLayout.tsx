'use client';

import { cn } from "@/lib/utils";

interface MainContentLayoutProps {
  isReportsOpen: boolean;
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  showReportOnMobile?: boolean;
  className?: string;
}

const MOBILE_PANEL_CLASSES = "lg:hidden h-full pt-4 w-full";
const DESKTOP_SPLIT_CONTAINER_CLASSES = "hidden lg:flex gap-3 h-full";
const LEFT_PANEL_CLASSES = "flex-shrink-0 w-64";
const RIGHT_PANEL_CLASSES = "flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto pt-4 pr-3";

export function MainContentLayout({
  isReportsOpen,
  leftPanel,
  rightPanel,
  showReportOnMobile = false,
  className = "",
}: MainContentLayoutProps) {
  if (!isReportsOpen) {
    return (
      <div className={cn("h-full pt-4", className)}>
        {rightPanel}
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Show report view if selected, otherwise show ReportsSubmenu */}
      {showReportOnMobile ? (
        <div className={cn(MOBILE_PANEL_CLASSES, "px-3 flex flex-col", className)}>
          {rightPanel}
        </div>
      ) : (
        <div className={cn(MOBILE_PANEL_CLASSES, "px-2", className)}>
          {leftPanel}
        </div>
      )}
      {/* Desktop: Show split view */}
      <div className={cn(DESKTOP_SPLIT_CONTAINER_CLASSES, className)}>
        <div className={LEFT_PANEL_CLASSES}>
          {leftPanel}
        </div>
        <div className={RIGHT_PANEL_CLASSES}>
          {rightPanel}
        </div>
      </div>
    </>
  );
}
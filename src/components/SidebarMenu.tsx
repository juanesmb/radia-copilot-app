'use client';

import { Home, BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";

type SidebarView = "home" | "reports";

interface SidebarMenuProps {
  activeView: SidebarView;
  isReportsOpen: boolean;
  onSelectHome: () => void;
  onToggleReports: () => void;
  className?: string;
}

export function SidebarMenu({
  activeView,
  isReportsOpen,
  onSelectHome,
  onToggleReports,
  className = "",
}: SidebarMenuProps) {
  const baseButtonClasses =
    "w-12 h-12 hover:bg-muted transition-colors rounded-xl border border-transparent";

  const homeActive = activeView === "home";
  const reportsActive = activeView === "reports" && isReportsOpen;

  return (
    <aside
      className={`${className.includes("flex") ? "flex" : "hidden lg:flex"} flex-col gap-3 w-14 flex-shrink-0 border-r border-border pr-3 pt-4 transition-all duration-500 ${className}`}
      style={{ height: className.includes("flex") ? "100%" : "calc(100vh - 4rem)" }}
      aria-label="Primary navigation"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onSelectHome}
        className={`${baseButtonClasses} ${homeActive ? "bg-muted border-border" : ""}`}
        title="Home"
        aria-pressed={homeActive}
      >
        <Home className="w-5 h-5" aria-hidden="true" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleReports}
        className={`${baseButtonClasses} ${reportsActive ? "bg-muted border-border" : ""}`}
        title="Reports"
        aria-pressed={reportsActive}
      >
        <BookOpen className="w-5 h-5" aria-hidden="true" />
      </Button>
    </aside>
  );
}



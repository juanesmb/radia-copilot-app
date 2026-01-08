'use client';

import Image from "next/image";
import { Home, BookOpen } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

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
      className={`${className.includes("flex") ? "flex" : "hidden lg:flex"} flex-col gap-3 w-14 flex-shrink-0 border-r border-border pt-4 pb-4 transition-all duration-500 ${className.includes("flex") ? "h-full" : "h-[calc(100dvh-4rem)] lg:h-screen"} ${className}`}
      aria-label="Primary navigation"
    >
      <div className="flex flex-col items-center gap-3 flex-1">
        <button
          onClick={onSelectHome}
          className="hover:opacity-80 transition-opacity cursor-pointer w-12 h-12 flex items-center justify-center"
          aria-label="Home"
        >
          <Image
            src="/logo.svg"
            alt="RadiaCopilot"
            width={48}
            height={48}
            className="w-full h-full object-contain"
            priority
          />
        </button>
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
      </div>

      <div className="flex flex-col items-center gap-3">
        <LanguageSwitcher />
        <UserButton
          appearance={{
            elements: {
              userButtonPopoverCard: {
                pointerEvents: 'initial',
                zIndex: 9999,
              },
            },
          }}
        />
      </div>
    </aside>
  );
}

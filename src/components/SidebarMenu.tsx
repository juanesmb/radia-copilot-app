'use client';

import Image from "next/image";
import { BookOpen, ChevronLeft, ChevronRight, Home, Sparkles } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

type SidebarView = "home" | "reports";

interface SidebarMenuProps {
  activeView: SidebarView;
  isReportsOpen: boolean;
  reportsPanel: React.ReactNode;
  onSelectHome: () => void;
  onToggleReports: () => void;
  onGenerateReport: () => void;
  onCloseReports: () => void;
  className?: string;
}

export function SidebarMenu({
  activeView,
  isReportsOpen,
  reportsPanel,
  onSelectHome,
  onToggleReports,
  onGenerateReport,
  onCloseReports,
  className = "",
}: SidebarMenuProps) {
  const { t } = useLanguage();
  const { user } = useUser();
  const isMobile = className.includes("flex");
  const reportsActive = activeView === "reports" && isReportsOpen;
  const [isExpanded, setIsExpanded] = useState(isMobile);
  const [isMounted, setIsMounted] = useState(false);

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const userName = user?.fullName || user?.firstName || user?.username || "";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const asideClasses = [
    isMobile ? "flex" : "hidden lg:flex",
    `flex-col gap-3 flex-shrink-0 border-r border-border pt-2 pb-4 transition-all duration-500 ${
      isExpanded ? "w-56" : "w-14"
    }`,
    isMobile ? "h-[100dvh]" : "h-[calc(100dvh-4rem)] lg:h-screen",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="relative flex-shrink-0 overflow-visible">
      <aside className={`${asideClasses} relative z-40`} aria-label="Primary navigation">
        <div className={`flex flex-col gap-3 flex-1 ${isExpanded ? "px-3" : "items-center"}`}>
          <div className={`flex items-center ${isExpanded ? "justify-between" : "justify-center"}`}>
            <button
              onClick={onSelectHome}
              className={`hover:opacity-80 transition-opacity cursor-pointer flex items-center justify-center ${
                isExpanded ? "w-full h-14 px-2" : "w-14 h-14"
              }`}
              aria-label={t("sidebar.home")}
            >
              <Image
                src={isExpanded ? "/long_logo.svg" : "/logo.svg"}
                alt="RadiCopilot"
                width={isExpanded ? 240 : 56}
                height={56}
                className="w-full h-full object-contain"
                priority
              />
            </button>

            {isExpanded && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(false)}
                className={`h-10 w-10 rounded-xl ${isMobile ? "hidden" : "flex"}`}
                title={t("sidebar.collapse")}
                aria-label={t("sidebar.collapse")}
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </Button>
            )}
          </div>

          {!isExpanded && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(true)}
              className="h-10 w-10 rounded-xl"
              title={t("sidebar.expand")}
              aria-label={t("sidebar.expand")}
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </Button>
          )}

          <Button
            variant="default"
            size={isExpanded ? "default" : "icon"}
            onClick={onGenerateReport}
            className={`rounded-xl transition-colors ${
              isExpanded ? "w-full justify-start px-3 h-10 gap-2" : ""
            }`}
            title={t("reports.generate")}
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {isExpanded && <span className="ml-2 text-left">{t("reports.generate")}</span>}
          </Button>

          <Button
            variant="ghost"
            onClick={onSelectHome}
            className={`w-12 h-12 hover:bg-muted transition-colors rounded-xl border ${
              activeView === "home" ? "bg-muted border-border" : "border-transparent"
            } ${isExpanded ? "w-full justify-start px-3" : ""}`}
            title={t("sidebar.home")}
            aria-pressed={activeView === "home"}
          >
            <Home className="w-5 h-5 shrink-0" aria-hidden="true" />
            {isExpanded && (
              <span className="ml-3 text-left">
                <span className="block text-sm font-medium">{t("sidebar.home")}</span>
              </span>
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={onToggleReports}
            className={`w-12 h-12 hover:bg-muted transition-colors rounded-xl border ${
              reportsActive ? "bg-muted border-border" : "border-transparent"
            } ${isExpanded ? "w-full justify-start px-3" : ""}`}
            title={t("sidebar.reports")}
            aria-pressed={reportsActive}
          >
            <BookOpen className="w-5 h-5 shrink-0" aria-hidden="true" />
            {isExpanded && (
              <span className="ml-3 text-left">
                <span className="block text-sm font-medium">{t("sidebar.reports")}</span>
                <span className="block text-xs text-muted-foreground">{t("sidebar.reportsDescription")}</span>
              </span>
            )}
          </Button>
        </div>

        <div className={`flex flex-col gap-3 ${isExpanded ? "px-3" : "items-center"}`}>
          <LanguageSwitcher showFullLabel={isExpanded} />
          <div className={`flex items-center gap-3 ${isExpanded ? "justify-start" : "justify-center"}`}>
            {isMounted ? (
              <UserButton
                appearance={{
                  elements: {
                    userButtonPopoverCard: {
                      pointerEvents: "initial",
                      zIndex: 9999,
                    },
                  },
                }}
              />
            ) : (
              <div className="h-10 w-10" aria-hidden="true" />
            )}
            {isExpanded && isMounted && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{userName}</div>
                <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {isReportsOpen && reportsPanel && (
        <>
          <div
            className="hidden lg:block fixed inset-0 z-30 bg-black/40 transition-opacity opacity-100 pointer-events-auto"
            onClick={onCloseReports}
          />
          <div
            className="absolute top-0 left-full z-50 w-64 h-[calc(100dvh-4rem)] lg:h-screen transition-transform duration-300 hidden lg:block translate-x-0"
            onClick={(event) => event.stopPropagation()}
          >
            {reportsPanel}
          </div>
        </>
      )}
    </div>
  );
}

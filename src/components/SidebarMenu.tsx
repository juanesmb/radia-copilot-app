'use client';

import Image from "next/image";
import { BookOpen, ChevronLeft, ChevronRight, Home, MessageCircle } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

type SidebarView = "home" | "reports";

interface SidebarMenuProps {
  activeView: SidebarView;
  isReportsOpen: boolean;
  onSelectHome: () => void;
  onToggleReports: () => void;
  onToggleChat: () => void;
  className?: string;
}

export function SidebarMenu({
  activeView,
  isReportsOpen,
  onSelectHome,
  onToggleReports,
  onToggleChat,
  className = "",
}: SidebarMenuProps) {
  const { t } = useLanguage();
  const { user } = useUser();
  const isMobile = className.includes("flex");
  const reportsActive = activeView === "reports" && isReportsOpen;
  const [isExpanded, setIsExpanded] = useState(false);

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const userName = user?.fullName || user?.firstName || user?.username || "";

  const asideClasses = [
    isMobile ? "flex" : "hidden lg:flex",
    `flex-col gap-3 flex-shrink-0 border-r border-border pt-4 pb-4 transition-all duration-500 ${
      isExpanded ? "w-64" : "w-14"
    }`,
    isMobile ? "h-full" : "h-[calc(100dvh-4rem)] lg:h-screen",
    className,
  ].filter(Boolean).join(" ");

  return (
    <aside
      className={asideClasses}
      aria-label="Primary navigation"
    >
      <div className={`flex flex-col gap-3 flex-1 ${isExpanded ? "px-3" : "items-center"}`}>
        <div className={`flex items-center ${isExpanded ? "justify-between" : "justify-center"}`}>
          <button
            onClick={onSelectHome}
            className="hover:opacity-80 transition-opacity cursor-pointer w-12 h-12 flex items-center justify-center"
            aria-label={t("sidebar.home")}
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

          {isExpanded && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(false)}
              className="h-10 w-10 rounded-xl"
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
              <span className="block text-xs text-muted-foreground">{t("sidebar.homeDescription")}</span>
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

        <Button
          variant="ghost"
          onClick={onToggleChat}
          className={`w-12 h-12 hover:bg-muted transition-colors rounded-xl border border-transparent ${
            isExpanded ? "w-full justify-start px-3" : ""
          }`}
          title={t("sidebar.chat")}
          aria-label={t("sidebar.chat")}
        >
          <MessageCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          {isExpanded && (
            <span className="ml-3 text-left">
              <span className="block text-sm font-medium">{t("sidebar.chat")}</span>
              <span className="block text-xs text-muted-foreground">{t("sidebar.chatDescription")}</span>
            </span>
          )}
        </Button>
      </div>

      <div className={`flex flex-col gap-3 ${isExpanded ? "px-3" : "items-center"}`}>
        <LanguageSwitcher showFullLabel={isExpanded} />
        <div className={`flex items-center gap-3 ${isExpanded ? "justify-start" : "justify-center"}`}>
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
          {isExpanded && (
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {userName}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {userEmail}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

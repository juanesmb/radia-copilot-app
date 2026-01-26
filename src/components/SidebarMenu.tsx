'use client';

import Image from "next/image";
import { BookOpen, ChevronLeft, ChevronRight, CreditCard, Home, MessageCircle } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

export type SidebarView = "home" | "reports" | "subscriptions";

interface SidebarMenuProps {
  activeView: SidebarView;
  isReportsOpen: boolean;
  onSelectHome: () => void;
  onToggleReports: () => void;
  onSelectSubscriptions: () => void;
  onToggleChat: () => void;
  className?: string;
}

export function SidebarMenu({
  activeView,
  isReportsOpen,
  onSelectHome,
  onToggleReports,
  onSelectSubscriptions,
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
      isExpanded ? "w-56" : "w-14"
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
            className={`hover:opacity-80 transition-opacity cursor-pointer flex items-center justify-center ${
              isExpanded ? "w-full h-14 px-2" : "w-14 h-14"
            }`}
            aria-label={t("sidebar.home")}
          >
            <Image
              src={isExpanded ? "/long_logo.svg" : "/logo.svg"}
              alt="RadiaCopilot"
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
        {isExpanded ? (
          <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-primary/10 via-background to-background p-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  {t("sidebar.upgrade.title")}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t("sidebar.upgrade.subtitle")}
                </div>
              </div>
            </div>
            <Button
              className="mt-3 w-full justify-center"
              onClick={onSelectSubscriptions}
              size="sm"
            >
              {t("sidebar.upgrade.cta")}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSelectSubscriptions}
            className={`h-11 w-11 rounded-full border transition-colors bg-gradient-to-b from-primary/20 via-background to-background hover:bg-muted ${
              activeView === "subscriptions" ? "border-primary/50" : "border-border/60"
            }`}
            title={t("sidebar.upgrade.cta")}
            aria-label={t("sidebar.upgrade.cta")}
          >
            <CreditCard className="h-5 w-5 text-primary" aria-hidden="true" />
          </Button>
        )}
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

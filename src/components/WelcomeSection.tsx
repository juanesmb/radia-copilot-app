'use client';

import { useMemo } from "react";
import { MessageCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserGreeting } from "@/hooks/useUserGreeting";

interface WelcomeSectionProps {
  onGenerateReport: () => void;
  onToggleChat: () => void;
  showGreeting?: boolean;
}

export function WelcomeSection({
  onGenerateReport,
  onToggleChat,
  showGreeting = true,
}: WelcomeSectionProps) {
  const { t } = useLanguage();
  const { firstName, isLoading } = useUserGreeting();

  const greetingText = useMemo(() => {
    const greeting = t("welcome.greeting");
    if (isLoading || !firstName) {
      return greeting;
    }
    return `${greeting} ${firstName}`;
  }, [firstName, isLoading, t]);

  const welcomeLabels = useMemo(
    () => ({
      title: t("welcome.title"),
      subtitle: t("welcome.subtitle"),
      chatTitle: t("welcome.chat.title"),
      chatSubtitle: t("welcome.chat.subtitle"),
      chatButton: t("welcome.chat.button"),
    }),
    [t],
  );

  return (
    <div className="rounded-2xl border-2 border-dashed border-border p-8 bg-muted/10 mx-4 mt-4">
      {showGreeting && (
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-foreground">{greetingText}</h2>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* First Column: Report Generation */}
        <div className="flex flex-col items-center text-center space-y-4">
          <h3 className="text-2xl lg:text-3xl font-bold text-foreground">
            {welcomeLabels.title}
          </h3>
          <p className="text-base text-muted-foreground">
            {welcomeLabels.subtitle}
          </p>
          <Button
            type="button"
            className="gap-2 min-w-[162px]"
            onClick={onGenerateReport}
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {t("recording.upload")}
          </Button>
        </div>

        {/* Second Column: Chat Copilot */}
        <div className="flex flex-col items-center text-center space-y-4 border-l-0 lg:border-l border-border pl-0 lg:pl-6">
          <h3 className="text-2xl lg:text-3xl font-bold text-foreground">
            {welcomeLabels.chatTitle}
          </h3>
          <p className="text-base text-muted-foreground">
            {welcomeLabels.chatSubtitle}
          </p>
          <Button
            type="button"
            variant="outline"
            className="gap-2 min-w-[162px]"
            onClick={onToggleChat}
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            {welcomeLabels.chatButton}
          </Button>
        </div>
      </div>
    </div>
  );
}


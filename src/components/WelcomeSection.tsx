'use client';

import { useMemo } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserGreeting } from "@/hooks/useUserGreeting";

interface WelcomeSectionProps {
  onGenerateReport: () => void;
}

export function WelcomeSection({ onGenerateReport }: WelcomeSectionProps) {
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
      tagline: t("welcome.tagline"),
      title: t("welcome.title"),
      subtitle: t("welcome.subtitle"),
    }),
    [t],
  );

  return (
    <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center space-y-4 bg-muted/10 mx-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {welcomeLabels.tagline}
      </p>
      <h2 className="text-2xl font-semibold text-foreground">{greetingText}</h2>
      <h3 className="text-3xl font-bold text-foreground">{welcomeLabels.title}</h3>
      <p className="text-base text-muted-foreground max-w-2xl mx-auto">
        {welcomeLabels.subtitle}
      </p>
      <Button
        type="button"
        className="gap-2"
        onClick={onGenerateReport}
      >
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        {t("recording.upload")}
      </Button>
    </div>
  );
}


'use client';

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";

interface LanguageSwitcherProps {
  showFullLabel?: boolean;
}

export function LanguageSwitcher({ showFullLabel = false }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useLanguage();

  const currentLabel = showFullLabel
    ? language === "en"
      ? t("language.english")
      : t("language.spanish")
    : language;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <span className={showFullLabel ? "" : "uppercase"} suppressHydrationWarning>
            {currentLabel}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setLanguage('en')}
          className={language === 'en' ? 'bg-accent' : ''}
        >
          {t("language.english")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage('es')}
          className={language === 'es' ? 'bg-accent' : ''}
        >
          {t("language.spanish")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


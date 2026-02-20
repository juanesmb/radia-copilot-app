'use client';

import { useCallback, useState } from "react";
import { Check, Copy, FileText, MessageCircle, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

type HeaderMode = "home" | "recording";

interface ContentHeaderProps {
  mode: HeaderMode;
  greeting?: string;
  title?: string;
  placeholder?: string;
  copyDisabled?: boolean;
  onCopy?: () => void;
  onTitleChange?: (value: string) => void;
  onTitleCommit?: (value: string) => void;
  onTitleKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  isSaving?: boolean;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  showChatBadge?: boolean;
  onShowFeedback?: () => void;
  feedbackVisible?: boolean;
  feedbackLabel?: string;
}

export function ContentHeader({
  mode,
  greeting,
  title = "",
  placeholder = "Report title",
  copyDisabled = true,
  onCopy,
  onTitleChange,
  onTitleCommit,
  onTitleKeyDown,
  isSaving = false,
  onToggleChat,
  isChatOpen = false,
  showChatBadge = false,
  onShowFeedback,
  feedbackVisible = false,
  feedbackLabel,
}: ContentHeaderProps) {
  const { language, t } = useLanguage();
  const copyLabel = language === "es" ? "Copiar" : "Copy";
  const copiedLabel = language === "es" ? "Copiado" : "Copied";
  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      onTitleCommit?.(event.target.value);
    },
    [onTitleCommit],
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onTitleChange?.(event.target.value);
    },
    [onTitleChange],
  );

  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const handleCopyClick = () => {
    onCopy?.();
    setCopiedFeedback(true);
    window.setTimeout(() => setCopiedFeedback(false), 1200);
  };

  return (
    <div className="hidden lg:flex items-center h-[4.25rem] min-h-[4.25rem] px-3 border-b border-border bg-background/80 backdrop-blur-sm">
      {mode === "home" ? (
        <>
          <div className="flex-1" />
          <div className="flex-1 flex justify-center">
            <h2 className="text-lg font-semibold text-foreground text-center truncate">
              {greeting}
            </h2>
          </div>
          <div className="flex flex-1 justify-end">
            {onToggleChat && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "relative h-10 w-10 mr-3",
                  isChatOpen && "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                )}
                onClick={onToggleChat}
                aria-label={isChatOpen ? t("chat.close") : t("chat.open")}
              >
                <MessageCircle className="h-4 w-4" />
                {showChatBadge && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-semibold text-white ring-2 ring-background">
                    1
                  </span>
                )}
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 w-full">
          <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <Input
            value={title}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={onTitleKeyDown}
            placeholder={placeholder}
            className={cn(
              "h-10 text-lg md:text-lg lg:text-lg font-semibold leading-tight w-1/2 max-w-xl",
              "bg-background border-transparent hover:border-border focus:border-border transition-colors",
            )}
          />
          <div className="flex items-center justify-center">
            {isSaving ? (
              <ArrowUpDown className="h-4 w-4 text-muted-foreground animate-pulse" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-1 justify-end items-center gap-2">
            <Button
              type="button"
              className="gap-2 text-base h-10 px-4 sm:px-6 active:scale-[0.98] active:bg-primary/80 active:text-primary-foreground"
              disabled={copyDisabled}
              onClick={handleCopyClick}
              aria-label={copiedFeedback ? copiedLabel : copyLabel}
            >
              {copiedFeedback ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{copiedFeedback ? copiedLabel : copyLabel}</span>
            </Button>
            {onShowFeedback && (
              <Button
                type="button"
                variant={feedbackVisible ? "default" : "outline"}
                size="icon"
                className="h-10 w-10"
                onClick={onShowFeedback}
                aria-label={feedbackLabel || "Feedback"}
              >
              <span className="text-lg leading-none font-semibold text-amber-400">!</span>
              </Button>
            )}
            {onToggleChat && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "relative h-10 w-10",
                  isChatOpen && "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                )}
                onClick={onToggleChat}
                aria-label={isChatOpen ? t("chat.close") : t("chat.open")}
              >
                <MessageCircle className="h-4 w-4" />
                {showChatBadge && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-semibold text-white ring-2 ring-background">
                    1
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

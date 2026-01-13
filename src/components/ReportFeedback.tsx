'use client';

import { useState } from "react";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { submitFeedback } from "@/lib/api";
import type { ApiError } from "@/types/frontend/api";

const CONFIDENCE_SCALE = [1, 2, 3, 4, 5] as const;
const SUCCESS_MESSAGE_DELAY = 1500;

interface ReportFeedbackProps {
  reportId: string;
  onSubmitted: () => void;
  onMinimize: () => void;
  isMinimized: boolean;
}

export function ReportFeedback({
  reportId,
  onSubmitted,
  onMinimize,
  isMinimized,
}: ReportFeedbackProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [confidence, setConfidence] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const scaleLabels = [
    t("feedback.scale1"),
    t("feedback.scale2"),
    t("feedback.scale3"),
    t("feedback.scale4"),
    t("feedback.scale5"),
  ];

  const handleSubmit = async () => {
    if (confidence === null) {
      return;
    }

    setIsSubmitting(true);
    try {
      await submitFeedback({
        reportId,
        confidence,
        reason: reason.trim() || null,
      });
      setIsSubmitted(true);
      setTimeout(() => {
        onSubmitted();
      }, SUCCESS_MESSAGE_DELAY);
    } catch (error) {
      const errorMessage =
        (error as ApiError)?.message ?? t("feedback.error");
      toast({
        title: t("feedback.error"),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="fixed bottom-4 right-4 z-50 w-80 p-4 shadow-lg">
        <p className="text-sm font-medium text-foreground">
          {t("feedback.submitted")}
        </p>
      </Card>
    );
  }

  // Minimized state: show small floating button
  if (isMinimized) {
    return (
      <Button
        onClick={onMinimize}
        className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg"
        size="icon"
        aria-label={t("feedback.maximize")}
      >
        <MessageSquare className="h-5 w-5" />
      </Button>
    );
  }

  // Expanded state: show full feedback form
  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 p-4 shadow-lg transition-all">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t("feedback.title")}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -mt-1 -mr-1"
          onClick={onMinimize}
          aria-label={t("feedback.minimize")}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex gap-1">
          {CONFIDENCE_SCALE.map((value) => (
            <Button
              key={value}
              variant={confidence === value ? "default" : "outline"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setConfidence(value)}
              disabled={isSubmitting}
            >
              {value}
            </Button>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center">
          {confidence !== null && scaleLabels[confidence - 1]}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">
            {t("feedback.why")} <span className="text-muted-foreground font-normal">{t("feedback.optional")}</span>
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[80px] text-sm"
            disabled={isSubmitting}
          />
        </div>

        <Button
          size="sm"
          className="w-full"
          onClick={handleSubmit}
          disabled={confidence === null || isSubmitting}
        >
          {t("feedback.submit")}
        </Button>
      </div>
    </Card>
  );
}


'use client';

import { useState } from "react";
import Image from "next/image";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ReportView } from "@/components/ReportView";
import { TranscriptionInput } from "@/components/TranscriptionInput";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { generateReport } from "@/lib/api";
import type { ApiError, GenerateReportResponse } from "@/types/frontend/api";

export default function HomePage() {
  const { language, t } = useLanguage();
  const { toast } = useToast();

  const [transcription, setTranscription] = useState("");
  const [report, setReport] = useState<GenerateReportResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!transcription.trim()) {
      toast({
        title: t("errors.validation.transcriptionRequired"),
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await generateReport({
        transcription: transcription.trim(),
        language,
      });
      setReport(response);
      toast({ title: t("app.generatedToast") });
    } catch (error) {
      const message =
        (error as ApiError)?.message ?? t("errors.requestFailed");
      toast({
        title: t("errors.generic"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-2 sm:px-4">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-1 sm:gap-1.5 sm:gap-2">
              <Image 
                src="/logo.svg" 
                alt="RadiaCopilot" 
                width={200}
                height={96}
                className="h-12 sm:h-16 md:h-20 lg:h-24 w-auto"
                priority
              />
            </div>
            <div className="flex items-center gap-0.5 sm:gap-2 md:gap-4">
              <div className="scale-75 sm:scale-100">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="pt-14 sm:pt-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:px-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">
              {t("app.title")}
            </h1>
            <p className="text-base text-muted-foreground md:text-lg">
              {t("app.subtitle")}
            </p>
          </div>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <TranscriptionInput
              value={transcription}
              label={t("input.label")}
              placeholder={t("input.placeholder")}
              hint={t("input.hint")}
              disabled={isGenerating}
              onChange={setTranscription}
            />
            <Button
              type="button"
              className="h-12 gap-2 text-base font-semibold"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t("app.generateBusy")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {t("app.generate")}
                </>
              )}
            </Button>
          </div>

          <ReportView
            report={report}
            onReportChange={setReport}
            isLoading={isGenerating}
          />
        </section>
        </div>
      </main>
    </div>
  );
}

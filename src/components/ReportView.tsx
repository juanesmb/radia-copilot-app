'use client';

import { useMemo } from "react";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import type { GenerateReportResponse } from "@/types/frontend/api";

interface ReportViewProps {
  report: GenerateReportResponse | null;
  onReportChange: (report: GenerateReportResponse) => void;
  isLoading: boolean;
}

const parseReportText = (
  text: string,
  studyTitleLabel: string,
  findingsLabel: string,
  resultsLabel: string,
  impressionLabel: string,
): GenerateReportResponse => {
  const lines = text.split("\n");
  let studyTitle = "";
  let findings = "";
  let results = "";
  let impression = "";

  let currentSection: "studyTitle" | "findings" | "results" | "impression" | null = "studyTitle";
  const currentContent: string[] = [];

  const normalizeLabel = (label: string) => label.toUpperCase().trim();

  const saveCurrentSection = () => {
    if (currentSection === "studyTitle" && currentContent.length > 0) {
      studyTitle = currentContent.join("\n").trim();
    } else if (currentSection === "findings" && currentContent.length > 0) {
      findings = currentContent.join("\n").trim();
    } else if (currentSection === "results" && currentContent.length > 0) {
      results = currentContent.join("\n").trim();
    } else if (currentSection === "impression" && currentContent.length > 0) {
      impression = currentContent.join("\n").trim();
    }
  };

  for (const line of lines) {
    const normalizedLine = normalizeLabel(line);
    const normalizedFindings = normalizeLabel(findingsLabel);
    const normalizedResults = normalizeLabel(resultsLabel);
    const normalizedImpression = normalizeLabel(impressionLabel);

    // Check if this line is a section header (findings, results, or impression)
    if (normalizedLine === normalizedFindings || normalizedLine.includes("FINDINGS") || normalizedLine.includes("HALLAZGOS")) {
      saveCurrentSection();
      currentSection = "findings";
      currentContent.length = 0;
    } else if (normalizedLine === normalizedResults || normalizedLine.includes("RESULTS") || normalizedLine.includes("RESULTADOS")) {
      saveCurrentSection();
      currentSection = "results";
      currentContent.length = 0;
    } else if (normalizedLine === normalizedImpression || normalizedLine.includes("IMPRESSION") || normalizedLine.includes("IMPRESIÓN")) {
      saveCurrentSection();
      currentSection = "impression";
      currentContent.length = 0;
    } else {
      currentContent.push(line);
    }
  }

  // Save the last section
  saveCurrentSection();

  // Fallback: if no sections found, treat entire text as findings
  if (!studyTitle && !findings && !results && !impression && text.trim()) {
    findings = text.trim();
  }

  return {
    studyTitle: studyTitle || "",
    findings: findings || "",
    results: results || "",
    impression: impression || "",
  };
};

export function ReportView({ report, onReportChange, isLoading }: ReportViewProps) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const combinedText = useMemo(() => {
    if (!report) return "";
    const findingsLabel = t("report.findings");
    const resultsLabel = t("report.results");
    const impressionLabel = t("report.impression");

    const parts: string[] = [];
    if (report.studyTitle) {
      parts.push(String(report.studyTitle));
    }
    if (report.findings) {
      parts.push(`${findingsLabel}\n${String(report.findings)}`);
    }
    if (report.results) {
      parts.push(`${resultsLabel}\n${String(report.results)}`);
    }
    if (report.impression) {
      parts.push(`${impressionLabel}\n${String(report.impression)}`);
    }
    return parts.join("\n\n");
  }, [report, t]);

  const handleCopy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(combinedText);
      toast({ title: t("report.copied") });
    } catch (error) {
      toast({
        title: t("errors.generic"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  const handleTextChange = (value: string) => {
    if (!report) return;
    const studyTitleLabel = t("report.studyTitle");
    const findingsLabel = t("report.findings");
    const resultsLabel = t("report.results");
    const impressionLabel = t("report.impression");
    const parsed = parseReportText(value, studyTitleLabel, findingsLabel, resultsLabel, impressionLabel);
    onReportChange(parsed);
  };

  const lineCount = useMemo(() => {
    if (!combinedText) return 4;
    return Math.max(4, Math.min(20, combinedText.split("\n").length));
  }, [combinedText]);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{t("report.title")}</CardTitle>
          <CardDescription>{t("report.copy")}</CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleCopy}
          disabled={!report}
          className="gap-2"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          {t("report.copy")}
        </Button>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading && (
          <div className="animate-pulse rounded-lg border border-dashed border-muted p-6 text-sm text-muted-foreground">
            {t("app.generateBusy")}
          </div>
        )}

        {!report && !isLoading && (
          <p className="text-sm text-muted-foreground">{t("report.empty")}</p>
        )}

        {report && (
          <div className="bg-muted/50 rounded-lg p-4">
            <Textarea
              value={combinedText}
              onChange={(event) => handleTextChange(event.target.value)}
              rows={lineCount}
              className="min-h-[300px] resize-none bg-background font-mono text-sm leading-relaxed"
              placeholder={t("report.empty")}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}


'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Menu } from "lucide-react";

import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ReportsSubmenu } from "@/components/ReportsSubmenu";
import { SidebarMenu } from "@/components/SidebarMenu";
import { RecordingInterface } from "@/components/RecordingInterface";
import { UploadingInterface } from "@/components/UploadingInterface";
import { ReportView } from "@/components/ReportView";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { createSpeechToTextProvider } from "@/infrastructure/speech-to-text";
import { generateReport, getReports, updateReport, detectStudyType, getAvailableTemplates } from "@/lib/api";
import type { ApiError, GenerateReportResponse } from "@/types/frontend/api";
import type { ReportHistoryItem } from "@/utils/reportHistory";
import { createReportHistoryItem, mapReportToHistoryItem } from "@/utils/reportHistory";

type DemoState = "main" | "recording" | "uploading" | "report";
type SidebarView = "home" | "reports";

interface StudyTypeOption {
  value: string;
  label: string;
}

// Create provider instance outside component to avoid recreation
const sttProvider = createSpeechToTextProvider('speechmatics');

export default function HomePage() {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const {
    transcript,
    state: sttState,
    error: sttError,
    start: startSTT,
    stop: stopSTT,
    reset: resetSTT,
  } = useSpeechToText(sttProvider);

  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [copiedReportId, setCopiedReportId] = useState<string | null>(null);
  const [sidebarView, setSidebarView] = useState<SidebarView>("home");
  const [isReportsOpen, setIsReportsOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [demoState, setDemoState] = useState<DemoState>("main");
  const [transcription, setTranscription] = useState("");
  const [pendingTranscription, setPendingTranscription] = useState("");
  const [pendingReport, setPendingReport] = useState<GenerateReportResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoadingReports, setIsLoadingReports] = useState(true);

  // Study type detection state
  const [isDetectingStudyType, setIsDetectingStudyType] = useState(false);
  const [detectedStudyType, setDetectedStudyType] = useState<string | null>(null);
  const [selectedStudyType, setSelectedStudyType] = useState<string>("");
  const [availableStudyTypes, setAvailableStudyTypes] = useState<StudyTypeOption[]>([]);
  
  const prevSttStateRef = useRef<typeof sttState>(sttState);

  useEffect(() => {
    setTranscription(transcript);
  }, [transcript]);

  // Auto-detect study type when recording stops
  useEffect(() => {
    const prevState = prevSttStateRef.current;
    const currentState = sttState;
    prevSttStateRef.current = currentState;

    const justStopped = (prevState === 'recording' || prevState === 'stopping') && currentState === 'idle';
    
    if (!justStopped) {
      return;
    }

    const textToDetect = transcription.trim() || transcript.trim();
    
    if (textToDetect && !isDetectingStudyType && !detectedStudyType) {
      setIsDetectingStudyType(true);
      
      detectStudyType({
        transcription: textToDetect,
        language,
      })
        .then((result) => {
          setDetectedStudyType(result.studyType);
          setSelectedStudyType(result.studyType);
          setAvailableStudyTypes(
            result.availableTemplates.map((t: string) => ({ value: t, label: t }))
          );
        })
        .catch((error) => {
          console.error('[StudyType] Detection failed:', error);
        })
        .finally(() => {
          setIsDetectingStudyType(false);
        });
    }
  }, [sttState, transcript, transcription, language, detectedStudyType, isDetectingStudyType]);

  // Load available templates when entering recording state
  useEffect(() => {
    if (demoState === "recording" && availableStudyTypes.length === 0) {
      getAvailableTemplates({ language })
        .then((result) => {
          setAvailableStudyTypes(
            result.templates.map((t: string) => ({ value: t, label: t }))
          );
        })
        .catch((error) => {
          console.error('[Templates] Failed to load templates:', error);
        });
    }
  }, [demoState, language, availableStudyTypes.length]);

  const uploadSteps = useMemo(
    () => [
      t("upload.status1"),
      t("upload.status2"),
      t("upload.status3"),
    ],
    [t],
  );

  const selectedReport = useMemo(
    () => reportHistory.find((item) => item.id === selectedReportId) ?? null,
    [reportHistory, selectedReportId],
  );

  const reportLabels = useMemo(
    () => ({
      empty: t("report.empty"),
      loading: t("app.generateBusy"),
      date: t("report.date"),
      template: t("report.template"),
      transcription: t("report.transcription"),
      copy: t("report.copy"),
      copied: t("report.copied"),
      transcriptionEmpty: t("report.transcriptionEmpty"),
      generatedTitle: t("report.generatedTitle"),
    }),
    [t],
  );

  const recordingLabels = useMemo(
    () => ({
      recording: t("recording.recording"),
      connecting: t("recording.connecting"),
      stop: t("recording.stop"),
      studyType: t("recording.studyType"),
      detecting: t("recording.detecting"),
    }),
    [t],
  );

  const updateSelectedReport = async (
    updater: (report: ReportHistoryItem) => ReportHistoryItem,
    fieldsToUpdate: Partial<{ report_title: string; updated_report: string; updated_transcription: string }>
  ) => {
    if (!selectedReportId) return;

    const currentReport = reportHistory.find((item) => item.id === selectedReportId);
    if (!currentReport) return;

    const previousReport = { ...currentReport };
    const updatedReport = updater(currentReport);

    // Optimistically update UI
    setReportHistory((prev) =>
      prev.map((item) => (item.id === selectedReportId ? updatedReport : item)),
    );

    // Save to database
    try {
      await updateReport(selectedReportId, fieldsToUpdate);
    } catch (error) {
      // Revert on error
      setReportHistory((prev) =>
        prev.map((item) => (item.id === selectedReportId ? previousReport : item)),
      );
      const message = (error as ApiError)?.message ?? t("errors.requestFailed");
      toast({
        title: t("errors.generic"),
        description: message,
        variant: "destructive",
      });
    }
  };

  const showWelcome = sidebarView === "home" && demoState === "main" && !selectedReport;

  // Load reports on mount
  useEffect(() => {
    const loadReports = async () => {
      setIsLoadingReports(true);
      try {
        const reports = await getReports();
        const historyItems = reports.map(mapReportToHistoryItem);
        setReportHistory(historyItems);
      } catch (error) {
        const message = (error as ApiError)?.message ?? t("errors.requestFailed");
        toast({
          title: t("errors.generic"),
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsLoadingReports(false);
      }
    };

    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (demoState !== "uploading") return;

    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        const next = Math.min(prev + 4, 100);
        return next;
      });
    }, 1200);

    return () => {
      clearInterval(progressInterval);
    };
  }, [demoState]);

  useEffect(() => {
    if (demoState !== "uploading") return;
    if (uploadProgress < 100) return;
    if (!pendingReport) return;
    finalizeReport(pendingReport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoState, pendingReport, uploadProgress]);

  const handleGenerateReport = () => {
    setSidebarView("reports");
    setIsReportsOpen(true);
    setDemoState("recording");
    setDetectedStudyType(null);
    setSelectedStudyType("");
    setAvailableStudyTypes([]);
    resetSTT();
  };

  const handleStartRecording = useCallback(async () => {
    setDetectedStudyType(null);
    setSelectedStudyType("");
    
    try {
      await startSTT({
        language,
        enablePartials: true,
        sampleRate: 16000,
      });
    } catch (error) {
      toast({
        title: t("errors.generic"),
        description: error instanceof Error ? error.message : t("errors.microphoneAccess"),
        variant: "destructive",
      });
    }
  }, [startSTT, language, toast, t]);

  const handleStopRecording = useCallback(async () => {
    await stopSTT();
  }, [stopSTT]);


  const handleStartUpload = async () => {
    const trimmed = transcription.trim();
    if (!trimmed) {
      toast({
        title: t("errors.validation.transcriptionRequired"),
        variant: "destructive",
      });
      return;
    }

    setPendingTranscription(trimmed);
    setDemoState("uploading");
    setIsGenerating(true);
    try {
      const response = await generateReport({
        transcription: trimmed,
        language,
        studyType: selectedStudyType || undefined,
      });
      setPendingReport(response);
    } catch (error) {
      const message = (error as ApiError)?.message ?? t("errors.requestFailed");
      toast({
        title: t("errors.generic"),
        description: message,
        variant: "destructive",
      });
      setDemoState("recording");
      setPendingReport(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const finalizeReport = (response: GenerateReportResponse) => {
    const newReport = createReportHistoryItem({
      response,
      transcription: pendingTranscription,
      language,
    });
    setReportHistory((prev) => [newReport, ...prev]);
    setSelectedReportId(newReport.id);
    setSidebarView("reports");
    setIsReportsOpen(true);
    setDemoState("report");
    setTranscription("");
    setPendingTranscription("");
    setPendingReport(null);
    setDetectedStudyType(null);
    setSelectedStudyType("");
    setAvailableStudyTypes([]);
    toast({ title: t("app.generatedToast") });
  };

  const handleCopyReportCard = async (report: ReportHistoryItem) => {
    try {
      await navigator.clipboard.writeText(
        `${report.title}\n\n${report.report}`,
      );
      setCopiedReportId(report.id);
      setTimeout(() => setCopiedReportId(null), 2000);
    } catch (error) {
      toast({
        title: t("errors.generic"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  const handleSidebarHome = () => {
    setSidebarView("home");
    setDemoState("main");
    setSelectedReportId(null);
  };

  const handleSidebarReports = () => {
    setSidebarView("reports");
    setIsReportsOpen((prev) => !prev);
  };

  const renderMainContent = () => {
    if (demoState === "recording") {
      return (
        <RecordingInterface
          transcription={transcription}
          placeholder={t("recording.placeholder")}
          label={t("recording.label")}
          uploadLabel={t("recording.upload")}
          onChange={setTranscription}
          onUpload={handleStartUpload}
          disabled={isGenerating}
          sttState={sttState}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          sttError={sttError?.message}
          detectedStudyType={detectedStudyType}
          availableStudyTypes={availableStudyTypes}
          selectedStudyType={selectedStudyType}
          onStudyTypeChange={setSelectedStudyType}
          isDetectingStudyType={isDetectingStudyType}
          labels={recordingLabels}
        />
      );
    }

    if (demoState === "uploading") {
      return (
        <UploadingInterface
          progress={uploadProgress}
          steps={uploadSteps}
          title={t("upload.title")}
          subtitle={t("upload.subtitle")}
          completeLabel={t("upload.complete")}
        />
      );
    }

    if (selectedReport && demoState === "report") {
      return (
        <ReportView
          report={selectedReport}
          isLoading={false}
          labels={reportLabels}
          onUpdateTitle={(value) =>
            updateSelectedReport(
              (report) => ({ ...report, title: value }),
              { report_title: value }
            )
          }
          onUpdateReport={(value) =>
            updateSelectedReport(
              (report) => ({ ...report, report: value }),
              { updated_report: value }
            )
          }
          onUpdateTranscription={(value) =>
            updateSelectedReport(
              (report) => ({ ...report, transcription: value }),
              { updated_transcription: value }
            )
          }
        />
      );
    }

    if (showWelcome) {
      return (
        <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center space-y-4 bg-muted/10">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("welcome.tagline")}
          </p>
          <h2 className="text-3xl font-bold text-foreground">{t("welcome.title")}</h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            {t("welcome.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              type="button"
              className="gap-2"
              onClick={handleGenerateReport}
            >
              {t("welcome.generate")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDemoState(selectedReport ? "report" : "main")}
            >
              {t("welcome.viewReports")}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-border p-6 text-center text-muted-foreground">
        {t("report.empty")}
      </div>
    );
  };

  return (
    <div className="h-screen bg-background overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto pl-2 pr-4">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2">
              {/* Mobile hamburger button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden w-8 h-8 sm:w-10 sm:h-10"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              </Button>
              <button
                onClick={handleSidebarHome}
                className="hover:opacity-80 transition-opacity cursor-pointer"
                aria-label="Home"
              >
                <Image
                  src="/logo.svg"
                  alt="RadiaCopilot"
                  width={200}
                  height={96}
                  className="h-12 sm:h-16 w-auto"
                  priority
                />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <UserButton />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu Sheet */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-[90vw] max-w-[90vw] sm:w-[400px] sm:max-w-[400px] p-0">
          <div className="flex h-full">
            <SidebarMenu
              activeView={sidebarView}
              isReportsOpen={isReportsOpen}
              onSelectHome={() => {
                handleSidebarHome();
                setIsMobileMenuOpen(false);
              }}
              onToggleReports={() => {
                handleSidebarReports();
              }}
              className="flex border-r border-border pr-3"
            />
            <div className="flex-1 h-full flex flex-col overflow-hidden border-l border-border">
              <ReportsSubmenu
                isOpen={true}
                reports={reportHistory}
                selectedReportId={selectedReportId}
                copiedReportId={copiedReportId}
                onSelectReport={(id) => {
                  setSelectedReportId(id);
                  setDemoState("report");
                  setIsMobileMenuOpen(false);
                }}
                onCopyReport={handleCopyReportCard}
                onGenerateReport={() => {
                  handleGenerateReport();
                  setIsMobileMenuOpen(false);
                }}
                generateLabel={t("reports.generate")}
                emptyLabel={t("reports.empty")}
                copyLabel={t("report.copy")}
                copiedLabel={t("report.copied")}
                className="flex"
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <main className="pt-16 flex h-[calc(100vh-4rem)] overflow-hidden">
        <SidebarMenu
          activeView={sidebarView}
          isReportsOpen={isReportsOpen}
          onSelectHome={handleSidebarHome}
          onToggleReports={handleSidebarReports}
        />

        <ReportsSubmenu
          isOpen={isReportsOpen}
          reports={reportHistory}
          selectedReportId={selectedReportId}
          copiedReportId={copiedReportId}
          onSelectReport={(id) => {
            setSelectedReportId(id);
            setDemoState("report");
          }}
          onCopyReport={handleCopyReportCard}
          onGenerateReport={handleGenerateReport}
          generateLabel={t("reports.generate")}
          emptyLabel={t("reports.empty")}
          copyLabel={t("report.copy")}
          copiedLabel={t("report.copied")}
        />

        <section className="flex-1 min-w-0 overflow-hidden h-full">
          <div className="mx-auto max-w-6xl px-2 py-4 lg:px-3 h-full flex flex-col">
            <div className="space-y-6 flex-1 flex flex-col min-h-0 overflow-hidden">{renderMainContent()}</div>
          </div>
        </section>
      </main>
    </div>
  );
}

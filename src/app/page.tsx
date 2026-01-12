'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ReportsSubmenu } from "@/components/ReportsSubmenu";
import { SidebarMenu } from "@/components/SidebarMenu";
import { RecordingInterface } from "@/components/RecordingInterface";
import { UploadingInterface } from "@/components/UploadingInterface";
import { ReportFeedback } from "@/components/ReportFeedback";
import { ReportView } from "@/components/ReportView";
import { WelcomeSection } from "@/components/WelcomeSection";
import { ReportsEmptyState } from "@/components/ReportsEmptyState";
import { MainContentLayout } from "@/components/MainContentLayout";
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

const COPY_FEEDBACK_DURATION_MS = 2000;
const UPLOAD_PROGRESS_INTERVAL_MS = 1200;
const UPLOAD_PROGRESS_INCREMENT = 4;
const UPLOAD_PROGRESS_MAX = 100;

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
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [demoState, setDemoState] = useState<DemoState>("main");
  const [transcription, setTranscription] = useState("");
  const [pendingTranscription, setPendingTranscription] = useState("");
  const [pendingReport, setPendingReport] = useState<GenerateReportResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Study type detection state
  const [isDetectingStudyType, setIsDetectingStudyType] = useState(false);
  const [detectedStudyType, setDetectedStudyType] = useState<string | null>(null);
  const [selectedStudyType, setSelectedStudyType] = useState<string>("");
  const [availableStudyTypes, setAvailableStudyTypes] = useState<StudyTypeOption[]>([]);
  
  // Feedback state
  const [dismissedFeedbackReports, setDismissedFeedbackReports] = useState<Set<string>>(new Set());
  const [submittedFeedbackReports, setSubmittedFeedbackReports] = useState<Set<string>>(new Set());
  const [newlyGeneratedReportIds, setNewlyGeneratedReportIds] = useState<Set<string>>(new Set());
  
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
            result.availableTemplates.map((templateId: string) => ({ value: templateId, label: t(`studyType.${templateId}`) || templateId }))
          );
        })
        .catch((error) => {
          console.error('[StudyType] Detection failed:', error);
        })
        .finally(() => {
          setIsDetectingStudyType(false);
        });
    }
  }, [sttState, transcript, transcription, language, detectedStudyType, isDetectingStudyType, t]);

  // Load available templates when entering recording state
  useEffect(() => {
    if (demoState === "recording" && availableStudyTypes.length === 0) {
      getAvailableTemplates({ language })
        .then((result) => {
          setAvailableStudyTypes(
            result.templates.map((templateId: string) => ({ value: templateId, label: t(`studyType.${templateId}`) || templateId }))
          );
        })
        .catch((error) => {
          console.error('[Templates] Failed to load templates:', error);
        });
    }
  }, [demoState, language, availableStudyTypes.length, t]);

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
      disclaimer: t("report.disclaimer"),
    }),
    [t],
  );

  const recordingLabels = useMemo(
    () => ({
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

  const headerSubtitle = useMemo(() => {
    if (demoState === "recording") return t("header.generateReport");
    if (demoState === "report") return t("header.reportDetails");
    return null;
  }, [demoState, t]);

  const renderContentPanel = () => {
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
          language={language}
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
      return <WelcomeSection onGenerateReport={handleGenerateReport} />;
    }

    return (
      <ReportsEmptyState
        message={t("reports.emptyState")}
        onGenerateReport={handleGenerateReport}
        generateLabel={t("reports.generate")}
      />
    );
  };

  useEffect(() => {
    const loadReports = async () => {
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
        const next = Math.min(prev + UPLOAD_PROGRESS_INCREMENT, UPLOAD_PROGRESS_MAX);
        return next;
      });
    }, UPLOAD_PROGRESS_INTERVAL_MS);

    return () => {
      clearInterval(progressInterval);
    };
  }, [demoState]);

  useEffect(() => {
    if (demoState !== "uploading") return;
    if (uploadProgress < UPLOAD_PROGRESS_MAX) return;
    if (!pendingReport) return;
    finalizeReport(pendingReport);
  }, [demoState, pendingReport, uploadProgress]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerateReport = useCallback(() => {
    setSidebarView("reports");
    setIsReportsOpen(true);
    setDemoState("recording");
    setDetectedStudyType(null);
    setSelectedStudyType("");
    setAvailableStudyTypes([]);
    resetSTT();
  }, [resetSTT]);

  const handleStartRecording = useCallback(async () => {
    setDetectedStudyType(null);
    setSelectedStudyType("");
    
    try {
      await startSTT({
        language,
        enablePartials: true,
        sampleRate: 16000,
      }, transcription);
    } catch (error) {
      toast({
        title: t("errors.generic"),
        description: error instanceof Error ? error.message : t("errors.microphoneAccess"),
        variant: "destructive",
      });
    }
  }, [startSTT, language, toast, t, transcription]);

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
    // Mark this report as newly generated so feedback shows
    setNewlyGeneratedReportIds((prev) => new Set(prev).add(newReport.id));
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

  const removeFromNewlyGenerated = useCallback((reportId: string) => {
    setNewlyGeneratedReportIds((prev) => {
      const next = new Set(prev);
      next.delete(reportId);
      return next;
    });
  }, []);

  const handleFeedbackSubmitted = useCallback(
    (reportId: string) => {
      setSubmittedFeedbackReports((prev) => new Set(prev).add(reportId));
      removeFromNewlyGenerated(reportId);
    },
    [removeFromNewlyGenerated]
  );

  const handleFeedbackDismissed = useCallback(
    (reportId: string) => {
      setDismissedFeedbackReports((prev) => new Set(prev).add(reportId));
      removeFromNewlyGenerated(reportId);
    },
    [removeFromNewlyGenerated]
  );

  const shouldShowFeedback = useMemo(() => {
    if (demoState !== "report" || !selectedReportId) {
      return false;
    }
    // Only show feedback for newly generated reports
    if (!newlyGeneratedReportIds.has(selectedReportId)) {
      return false;
    }
    // Don't show if already dismissed or submitted
    return (
      !dismissedFeedbackReports.has(selectedReportId) &&
      !submittedFeedbackReports.has(selectedReportId)
    );
  }, [demoState, selectedReportId, newlyGeneratedReportIds, dismissedFeedbackReports, submittedFeedbackReports]);

  const handleCopyReportCard = useCallback(async (report: ReportHistoryItem) => {
    try {
      await navigator.clipboard.writeText(
        `${report.title}\n\n${report.report}`,
      );
      setCopiedReportId(report.id);
      setTimeout(() => setCopiedReportId(null), COPY_FEEDBACK_DURATION_MS);
    } catch (error) {
      toast({
        title: t("errors.generic"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  }, [toast, t]);

  const handleSidebarHome = useCallback(() => {
    setSidebarView("home");
    setDemoState("main");
    setSelectedReportId(null);
    setIsReportsOpen(false);
  }, []);

  const handleSidebarReports = useCallback(() => {
    setSidebarView("reports");
    setIsReportsOpen(true);
    setSelectedReportId(null);
    setDemoState("main");
  }, []);

  const shouldShowReportOnMobile = useMemo(() => {
    if (!isReportsOpen) return false;
    const hasSelectedReport = selectedReportId !== null && demoState === "report";
    const isRecordingOrUploading = demoState === "recording" || demoState === "uploading";
    return hasSelectedReport || isRecordingOrUploading;
  }, [isReportsOpen, selectedReportId, demoState]);

  const reportsSubmenuProps = useMemo(
    () => ({
      reports: reportHistory,
      selectedReportId,
      copiedReportId,
      onSelectReport: (id: string) => {
        setSelectedReportId(id);
        setDemoState("report");
      },
      onCopyReport: handleCopyReportCard,
      onGenerateReport: handleGenerateReport,
      isRecording: demoState === "recording",
      generateLabel: t("reports.generate"),
      subtitleLabel: t("reports.subtitle"),
      emptyLabel: t("reports.empty"),
      copyLabel: t("report.copy"),
      copiedLabel: t("report.copied"),
    }),
    [
      reportHistory,
      selectedReportId,
      copiedReportId,
      demoState,
      t,
      handleCopyReportCard,
      handleGenerateReport,
    ]
  );

  const renderMainContent = () => {
    return (
      <MainContentLayout
        isReportsOpen={isReportsOpen}
        leftPanel={<ReportsSubmenu {...reportsSubmenuProps} />}
        rightPanel={renderContentPanel()}
        showReportOnMobile={shouldShowReportOnMobile}
      />
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
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
            </div>
            {(headerSubtitle || (isReportsOpen && sidebarView === "reports")) && (
              <div className="flex-1 flex justify-center">
                <h2 className="text-base sm:text-lg font-medium text-foreground">
                  {headerSubtitle || t("reports.subtitle")}
                </h2>
              </div>
            )}
            <div className="w-8 sm:w-10" /> {/* Spacer to balance the hamburger button */}
          </div>
        </div>
      </header>

      {/* Mobile menu Sheet */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-auto max-w-none p-0 shadow-none border-none data-[state=open]:animate-in data-[state=closed]:animate-out [&>button]:hidden">
          <SidebarMenu
            activeView={sidebarView}
            isReportsOpen={isReportsOpen}
            onSelectHome={() => {
              handleSidebarHome();
              setIsMobileMenuOpen(false);
            }}
            onToggleReports={() => {
              handleSidebarReports();
              setIsMobileMenuOpen(false);
            }}
            className="flex"
          />
        </SheetContent>
      </Sheet>

      <main className="pt-16 lg:pt-0 flex min-h-[calc(100vh-4rem)] lg:min-h-screen">
        <SidebarMenu
          activeView={sidebarView}
          isReportsOpen={isReportsOpen}
          onSelectHome={handleSidebarHome}
          onToggleReports={handleSidebarReports}
        />

        <section className="flex-1 min-w-0 overflow-y-auto h-[calc(100dvh-4rem)] lg:h-screen">
          <div className="h-full flex flex-col min-h-0">
            <div className="flex-1 flex flex-col min-h-0">{renderMainContent()}</div>
          </div>
        </section>
      </main>
      {shouldShowFeedback && (
        <ReportFeedback
          reportId={selectedReportId!}
          onSubmitted={() => handleFeedbackSubmitted(selectedReportId!)}
          onDismiss={() => handleFeedbackDismissed(selectedReportId!)}
        />
      )}
    </div>
  );
}

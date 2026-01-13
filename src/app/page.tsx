'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ReportsSubmenu } from "@/components/ReportsSubmenu";
import { SidebarMenu } from "@/components/SidebarMenu";
import { RecordingInterface } from "@/components/RecordingInterface";
import { ReportFeedback } from "@/components/ReportFeedback";
import { WelcomeSection } from "@/components/WelcomeSection";
import { ReportsEmptyState } from "@/components/ReportsEmptyState";
import { MainContentLayout } from "@/components/MainContentLayout";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { useReportScroll } from "@/hooks/useReportScroll";
import { createSpeechToTextProvider } from "@/infrastructure/speech-to-text";
import { generateReport, getReports, updateReport, detectStudyType, getAvailableTemplates } from "@/lib/api";
import type { ApiError, GenerateReportResponse } from "@/types/frontend/api";
import type { ReportHistoryItem } from "@/utils/reportHistory";
import { createReportHistoryItem, mapReportToHistoryItem } from "@/utils/reportHistory";

type DemoState = "main" | "recording" | "uploading";
type SidebarView = "home" | "reports";

interface StudyTypeOption {
  value: string;
  label: string;
}

const COPY_FEEDBACK_DURATION_MS = 2000;

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [currentReportTitle, setCurrentReportTitle] = useState<string | null>(null);

  // Study type detection state
  const [isDetectingStudyType, setIsDetectingStudyType] = useState(false);
  const [detectedStudyType, setDetectedStudyType] = useState<string | null>(null);
  const [selectedStudyType, setSelectedStudyType] = useState<string>("");
  const [availableStudyTypes, setAvailableStudyTypes] = useState<StudyTypeOption[]>([]);
  
  // Feedback state
  const [minimizedFeedbackReports, setMinimizedFeedbackReports] = useState<Set<string>>(new Set());
  const [submittedFeedbackReports, setSubmittedFeedbackReports] = useState<Set<string>>(new Set());
  const [newlyGeneratedReportIds, setNewlyGeneratedReportIds] = useState<Set<string>>(new Set());
  const [feedbackDelayElapsed, setFeedbackDelayElapsed] = useState(false);
  
  // Scroll detection for feedback
  const shouldTrackScroll = demoState === "recording" && 
    currentReportId !== null && 
    newlyGeneratedReportIds.has(currentReportId) &&
    !submittedFeedbackReports.has(currentReportId);
  const hasScrolledPastThreshold = useReportScroll(shouldTrackScroll, 0.3);
  
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



  const recordingLabels = useMemo(
    () => ({
      stop: t("recording.stop"),
      studyType: t("recording.studyType"),
      detecting: t("recording.detecting"),
    }),
    [t],
  );

  const showWelcome = sidebarView === "home" && demoState === "main" && !currentReportId;

  const headerSubtitle = useMemo(() => {
    if (demoState === "recording") return t("header.generateReport");
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
          generatedReport={generatedReport}
          onReportChange={setGeneratedReport}
          isGenerating={isGenerating}
          currentReportId={currentReportId}
          reportTitle={currentReportTitle}
          onCopyReport={handleCopyReport}
          onUpdateTranscription={handleTranscriptionUpdate}
          onUpdateReport={handleReportUpdate}
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


  // Delay feedback appearance by 8 seconds
  useEffect(() => {
    if (demoState !== "recording" || !currentReportId) {
      setFeedbackDelayElapsed(false);
      return;
    }

    if (!newlyGeneratedReportIds.has(currentReportId)) {
      setFeedbackDelayElapsed(false);
      return;
    }

    if (submittedFeedbackReports.has(currentReportId)) {
      setFeedbackDelayElapsed(false);
      return;
    }

    const timer = setTimeout(() => {
      setFeedbackDelayElapsed(true);
    }, 8000); // 8 second delay

    return () => {
      clearTimeout(timer);
    };
  }, [demoState, currentReportId, newlyGeneratedReportIds, submittedFeedbackReports]);

  const handleGenerateReport = useCallback(() => {
    setSidebarView("reports");
    setIsReportsOpen(true);
    setDemoState("recording");
    setDetectedStudyType(null);
    setSelectedStudyType("");
    setAvailableStudyTypes([]);
    setGeneratedReport(null);
    setCurrentReportId(null);
    setCurrentReportTitle(null);
    setTranscription("");
    setSelectedReportId(null);
    setIsGenerating(false);
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

  const saveReportToDatabase = async (response: GenerateReportResponse, transcriptionText: string) => {
    const newReport = createReportHistoryItem({
      response,
      transcription: transcriptionText,
      language,
    });
    setReportHistory((prev) => [newReport, ...prev]);
    // Mark this report as newly generated so feedback shows
    setNewlyGeneratedReportIds((prev) => new Set(prev).add(newReport.id));
    // Set as current report
    setCurrentReportId(newReport.id);
    setCurrentReportTitle(newReport.title);
    return newReport;
  };

  const handleTranscriptionUpdate = useCallback(async (value: string) => {
    if (!currentReportId) return;
    
    try {
      await updateReport(currentReportId, { updated_transcription: value });
      // Update local state
      setReportHistory((prev) =>
        prev.map((report) =>
          report.id === currentReportId
            ? { ...report, transcription: value }
            : report
        )
      );
    } catch (error) {
      const message = (error as ApiError)?.message ?? t("errors.requestFailed");
      toast({
        title: t("errors.generic"),
        description: message,
        variant: "destructive",
      });
    }
  }, [currentReportId, t, toast]);

  const handleReportUpdate = useCallback(async (value: string) => {
    if (!currentReportId) return;
    
    try {
      await updateReport(currentReportId, { updated_report: value });
      // Update local state
      setReportHistory((prev) =>
        prev.map((report) =>
          report.id === currentReportId
            ? { ...report, report: value }
            : report
        )
      );
    } catch (error) {
      const message = (error as ApiError)?.message ?? t("errors.requestFailed");
      toast({
        title: t("errors.generic"),
        description: message,
        variant: "destructive",
      });
    }
  }, [currentReportId, t, toast]);

  const handleCopyReport = useCallback(async () => {
    if (!currentReportId || !generatedReport) return;
    
    try {
      const report = reportHistory.find((r) => r.id === currentReportId);
      if (!report) return;
      
      const content = generatedReport || report.report || "";
      const contentStartsWithTitle = currentReportTitle && content.trim().toLowerCase().startsWith(currentReportTitle.trim().toLowerCase());
      const textToCopy = contentStartsWithTitle 
        ? content 
        : currentReportTitle 
        ? `${currentReportTitle}\n\n${content}`
        : content;
      
      await navigator.clipboard.writeText(textToCopy);
      toast({ title: t("report.copied") });
    } catch (error) {
      toast({
        title: t("errors.generic"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  }, [currentReportId, currentReportTitle, generatedReport, reportHistory, t, toast]);

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
    setIsGenerating(true);
    try {
      const response = await generateReport({
        transcription: trimmed,
        language,
        studyType: selectedStudyType || undefined,
      });
      // Save report to database and update state, but stay in recording mode
      try {
        await saveReportToDatabase(response, trimmed);
        // Set the generated report content to display in the textarea
        setGeneratedReport(response.report || "");
        setPendingTranscription("");
        toast({ title: t("app.generatedToast") });
      } catch (error) {
        console.error("Failed to save report:", error);
        toast({
          title: t("errors.generic"),
          description: t("errors.requestFailed"),
          variant: "destructive",
        });
        setGeneratedReport(null);
      }
    } catch (error) {
      const message = (error as ApiError)?.message ?? t("errors.requestFailed");
      toast({
        title: t("errors.generic"),
        description: message,
        variant: "destructive",
      });
      setGeneratedReport(null);
    } finally {
      setIsGenerating(false);
    }
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

  const handleFeedbackMinimized = useCallback(
    (reportId: string) => {
      setMinimizedFeedbackReports((prev) => {
        const next = new Set(prev);
        if (next.has(reportId)) {
          next.delete(reportId);
        } else {
          next.add(reportId);
        }
        return next;
      });
    },
    []
  );

  const shouldShowFeedback = useMemo(() => {
    if (demoState !== "recording" || !currentReportId) {
      return false;
    }
    // Only show feedback for newly generated reports
    if (!newlyGeneratedReportIds.has(currentReportId)) {
      return false;
    }
    // Don't show if already submitted
    if (submittedFeedbackReports.has(currentReportId)) {
      return false;
    }
    // Require both delay elapsed AND scroll threshold reached
    if (!feedbackDelayElapsed || !hasScrolledPastThreshold) {
      return false;
    }
    // Show feedback (minimized state is handled separately in the component)
    return true;
  }, [demoState, currentReportId, newlyGeneratedReportIds, submittedFeedbackReports, feedbackDelayElapsed, hasScrolledPastThreshold]);

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
    setCurrentReportId(null);
    setCurrentReportTitle(null);
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
    const isRecordingOrUploading = demoState === "recording" || demoState === "uploading";
    return isRecordingOrUploading;
  }, [isReportsOpen, demoState]);

  const reportsSubmenuProps = useMemo(
    () => ({
      reports: reportHistory,
      selectedReportId: currentReportId,
      copiedReportId,
      onSelectReport: (id: string) => {
        const report = reportHistory.find((r) => r.id === id);
        if (report) {
          setCurrentReportId(report.id);
          setCurrentReportTitle(report.title);
          setTranscription(report.transcription);
          setGeneratedReport(report.report);
          // Set the study type from the used template so the template loads
          if (report.usedTemplate) {
            setSelectedStudyType(report.usedTemplate);
            setDetectedStudyType(report.usedTemplate);
          }
          setSelectedReportId(id);
          setDemoState("recording");
          setSidebarView("reports");
          setIsReportsOpen(true);
        }
      },
      onCopyReport: handleCopyReportCard,
      onGenerateReport: handleGenerateReport,
      generateLabel: t("reports.generate"),
      subtitleLabel: t("reports.subtitle"),
      emptyLabel: t("reports.empty"),
      copyLabel: t("report.copy"),
      copiedLabel: t("report.copied"),
    }),
    [
      reportHistory,
      currentReportId,
      copiedReportId,
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

        <section className="flex-1 min-w-0 overflow-y-auto h-[calc(100dvh-4rem)] lg:h-screen" data-report-container>
          <div className="h-full flex flex-col min-h-0">
            <div className="flex-1 flex flex-col min-h-0">{renderMainContent()}</div>
          </div>
        </section>
      </main>
      {shouldShowFeedback && (
        <ReportFeedback
          reportId={currentReportId!}
          onSubmitted={() => handleFeedbackSubmitted(currentReportId!)}
          onMinimize={() => handleFeedbackMinimized(currentReportId!)}
          isMinimized={minimizedFeedbackReports.has(currentReportId!)}
        />
      )}
    </div>
  );
}

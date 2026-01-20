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
import { generateReportStream, getReports, updateReport, detectStudyType, getAvailableTemplates } from "@/lib/api";
import type { ApiError } from "@/types/frontend/api";
import type { ReportHistoryItem } from "@/utils/reportHistory";
import { mapReportToHistoryItem, extractPatientName } from "@/utils/reportHistory";

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
  const [editedTemplate, setEditedTemplate] = useState<string>("");
  const [isTemplateCustom, setIsTemplateCustom] = useState(false);
  const [isAutoDetectTemplate, setIsAutoDetectTemplate] = useState(true);

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
  const lastStudyTypeDetectionTextRef = useRef<string>("");

  const runStudyTypeDetection = useCallback((textToDetect: string) => {
    const normalizedText = textToDetect.trim();

    if (!normalizedText || isDetectingStudyType) {
      return;
    }

    if (lastStudyTypeDetectionTextRef.current === normalizedText) {
      return;
    }

    lastStudyTypeDetectionTextRef.current = normalizedText;

    setIsDetectingStudyType(true);

    detectStudyType({
      transcription: normalizedText,
      language,
    })
      .then((result) => {
        setDetectedStudyType(result.studyType);
        setSelectedStudyType(result.studyType);
        setAvailableStudyTypes(
          result.availableTemplates.map((templateId: string) => ({
            value: templateId,
            label: t(`studyType.${templateId}`) || templateId,
          }))
        );
      })
      .catch((error) => {
        console.error('[StudyType] Detection failed:', error);
        lastStudyTypeDetectionTextRef.current = "";
      })
      .finally(() => {
        setIsDetectingStudyType(false);
      });
  }, [detectedStudyType, isDetectingStudyType, language, t]);

  useEffect(() => {
    setTranscription(transcript);
  }, [transcript]);

  // Auto-detect study type when recording stops
  useEffect(() => {
    if (!isAutoDetectTemplate) {
      return;
    }

    const prevState = prevSttStateRef.current;
    const currentState = sttState;
    prevSttStateRef.current = currentState;

    const justStopped = (prevState === 'recording' || prevState === 'stopping') && currentState === 'idle';
    
    if (!justStopped) {
      return;
    }

    const textToDetect = transcription.trim() || transcript.trim();
    
    runStudyTypeDetection(textToDetect);
  }, [isAutoDetectTemplate, sttState, transcript, transcription, runStudyTypeDetection]);

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
          uploadLabel={currentReportId ? t("recording.regenerate") : t("recording.upload")}
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
          onStudyTypeChange={(studyType) => {
            setSelectedStudyType(studyType);
            setEditedTemplate(""); // Clear edited template when new study type is selected
            setIsTemplateCustom(false); // Reset custom flag
          }}
          isAutoDetectTemplate={isAutoDetectTemplate}
          onAutoDetectTemplateChange={(isEnabled: boolean) => {
            setIsAutoDetectTemplate(isEnabled);

            if (isEnabled) {
              const normalizedText = (transcription.trim() || transcript.trim()).trim();

              if (normalizedText && lastStudyTypeDetectionTextRef.current === normalizedText) {
                return;
              }

              setDetectedStudyType(null);
              setSelectedStudyType("");
              runStudyTypeDetection(normalizedText);
              return;
            }

            setSelectedStudyType((prev) => prev || detectedStudyType || "");
          }}
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
          onTemplateChange={setEditedTemplate}
          initialTemplateContent={(() => {
            // Only use custom template content if:
            // 1. There's a current report
            // 2. The report has custom template content
            // 3. The selected study type matches the report's used template
            // Otherwise, let the hook fetch the template from the API
            const report = reportHistory.find((r) => r.id === currentReportId);
            if (report?.templateContent && report.usedTemplate === (selectedStudyType || detectedStudyType)) {
              return report.templateContent;
            }
            return null;
          })()}
          onTemplateEditStatusChange={setIsTemplateCustom}
          isTemplateCustom={isTemplateCustom}
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
    setEditedTemplate("");
    setIsTemplateCustom(false);
    setIsAutoDetectTemplate(true);
    lastStudyTypeDetectionTextRef.current = "";
    resetSTT();
  }, [resetSTT]);

  const handleStartRecording = useCallback(async () => {
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

  /**
   * Handles auto-save of transcription updates
   * Errors are handled by the useAutoSave hook and displayed in the status indicator
   * 
   * @param value - The updated transcription text
   * @throws {ApiError} Re-throws errors for the hook to handle
   */
  const handleTranscriptionUpdate = useCallback(async (value: string) => {
    if (!currentReportId) {
      // Silently skip if no report ID (no-op for auto-save)
      return;
    }
    
    await updateReport(currentReportId, { updated_transcription: value });
    
    // Update local state only after successful save
    setReportHistory((prev) =>
      prev.map((report) =>
        report.id === currentReportId
          ? { ...report, transcription: value }
          : report
      )
    );
  }, [currentReportId]);

  /**
   * Handles auto-save of report updates
   * Errors are handled by the useAutoSave hook and displayed in the status indicator
   * 
   * @param value - The updated report text
   * @throws {ApiError} Re-throws errors for the hook to handle
   */
  const handleReportUpdate = useCallback(async (value: string) => {
    if (!currentReportId) {
      // Silently skip if no report ID (no-op for auto-save)
      return;
    }
    
    await updateReport(currentReportId, { updated_report: value });
    
    // Update local state only after successful save
    setReportHistory((prev) =>
      prev.map((report) =>
        report.id === currentReportId
          ? { ...report, report: value }
          : report
      )
    );
  }, [currentReportId]);

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
    // Require study type (template) or custom template instead of transcription
    if (!isAutoDetectTemplate && !selectedStudyType) {
      toast({
        title: t("errors.validation.templateRequired"),
        variant: "destructive",
      });
      return;
    }

    if (!selectedStudyType && !detectedStudyType && !isTemplateCustom) {
      toast({
        title: t("errors.validation.templateRequired"),
        variant: "destructive",
      });
      return;
    }

    const trimmed = transcription.trim();

    setIsGenerating(true);
    setGeneratedReport(""); // Clear previous report
    // Don't clear currentReportId when regenerating - preserve it for update
    if (!currentReportId) {
      setCurrentReportId(null);
      setCurrentReportTitle(null);
    }

    let accumulatedReport = "";
    let reportTitle = "";
    let savedReportId: string | null = null;

    try {
      await generateReportStream(
        {
          transcription: trimmed,
          language,
          studyType: isAutoDetectTemplate
            ? selectedStudyType || detectedStudyType || undefined
            : selectedStudyType || undefined,
          template: editedTemplate || undefined,
          isCustomTemplate: isTemplateCustom,
          reportId: currentReportId || undefined,
        },
        {
          onChunk: (chunk: string) => {
            accumulatedReport += chunk;
            setGeneratedReport(accumulatedReport);

            // Extract title from first line when we have content
            if (!reportTitle && accumulatedReport.trim()) {
              const lines = accumulatedReport.trim().split('\n');
              if (lines.length > 0) {
                reportTitle = lines[0];
                setCurrentReportTitle(reportTitle);
              }
            }
          },
          onMetadata: (metadata) => {
            savedReportId = metadata.reportId;
            reportTitle = metadata.title;
            setCurrentReportId(metadata.reportId);
            setCurrentReportTitle(metadata.title);

            // Update report history - update existing report or add new one
            setReportHistory((prev) => {
              const existingIndex = prev.findIndex((r) => r.id === metadata.reportId);
              const existingReport = existingIndex >= 0 ? prev[existingIndex] : null;
              const updatedReport: ReportHistoryItem = {
                id: metadata.reportId,
                title: metadata.title,
                report: accumulatedReport,
                transcription: trimmed,
                usedTemplate: metadata.selectedTemplate,
                templateContent: isTemplateCustom ? editedTemplate || null : (existingReport?.templateContent ?? null),
                createdAt: existingReport?.createdAt ?? new Date(),
                metadata: {
                  patientName: extractPatientName(trimmed),
                },
              };
              
              if (existingIndex >= 0) {
                // Update existing report in place, maintaining its position
                const updated = [...prev];
                updated[existingIndex] = updatedReport;
                return updated;
              } else {
                // Add new report at the beginning
                return [updatedReport, ...prev];
              }
            });
            setNewlyGeneratedReportIds((prev) => new Set(prev).add(metadata.reportId));
          },
          onComplete: (reportId: string) => {
            savedReportId = reportId;
            setIsGenerating(false);
            toast({ title: t("app.generatedToast") });
          },
          onError: (error: Error) => {
            console.error("Stream error:", error);
            setIsGenerating(false);
            setGeneratedReport(null);
            toast({
              title: t("errors.generic"),
              description: error.message || t("errors.requestFailed"),
              variant: "destructive",
            });
          },
        }
      );
    } catch (error) {
      const message = (error as ApiError)?.message ?? t("errors.requestFailed");
      setIsGenerating(false);
      setGeneratedReport(null);
      toast({
        title: t("errors.generic"),
        description: message,
        variant: "destructive",
      });
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
          // Set the custom template content if available
          if (report.templateContent) {
            setEditedTemplate(report.templateContent);
            setIsTemplateCustom(true);
          } else {
            setEditedTemplate("");
            setIsTemplateCustom(false);
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

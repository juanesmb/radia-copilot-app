'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Check, CreditCard, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReportsSubmenu } from "@/components/ReportsSubmenu";
import { SidebarMenu, type SidebarView } from "@/components/SidebarMenu";
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
import {
  createReportChatSession,
  generateReportStream,
  getChatSessions,
  getReports,
  updateReport,
  detectStudyType,
  getAvailableTemplates,
  createSubscription,
  getCurrentSubscription,
  renewSubscription,
} from "@/lib/api";
import type { ApiError } from "@/types/frontend/api";
import type { ReportHistoryItem } from "@/utils/reportHistory";
import type { SubscriptionRecord } from "@/lib/api";
import { mapReportToHistoryItem, extractPatientName } from "@/utils/reportHistory";

type DemoState = "main" | "recording" | "uploading";

interface StudyTypeOption {
  value: string;
  label: string;
}

const COPY_FEEDBACK_DURATION_MS = 2000;

type BillingCountry = "CO" | "AR";
type BillingCurrency = "COP" | "ARS";

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
  const [reportChatSessions, setReportChatSessions] = useState<Record<string, string>>({});
  const [sidebarView, setSidebarView] = useState<SidebarView>("home");
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionRecord | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isSubscriptionManagementModalOpen, setIsSubscriptionManagementModalOpen] = useState(false);
  const [isCancelSubscriptionDialogOpen, setIsCancelSubscriptionDialogOpen] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);
  const [shouldShowSubscriptionSuccessToast, setShouldShowSubscriptionSuccessToast] = useState(false);
  const [billingCountry, setBillingCountry] = useState<BillingCountry>("CO");
  const [billingCurrency, setBillingCurrency] = useState<BillingCurrency>("COP");
  const [proPrice, setProPrice] = useState<number>(20000);
  const [demoState, setDemoState] = useState<DemoState>("main");
  const [transcription, setTranscription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [currentReportTitle, setCurrentReportTitle] = useState<string | null>(null);
  const [editedTemplate, setEditedTemplate] = useState<string>("");
  const [isTemplateCustom, setIsTemplateCustom] = useState(false);

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

  const getTemplateLabel = useCallback(
    (templateId: string) => {
      const translated = t(`studyType.${templateId}`);
      return translated === `studyType.${templateId}` ? templateId : translated;
    },
    [t]
  );

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
            label: getTemplateLabel(templateId),
          }))
        );
      })
      .catch((error) => {
        const message = (error as ApiError)?.message ?? t("errors.requestFailed");
        console.error('[StudyType] Detection failed:', error);
        toast({
          title: t("errors.generic"),
          description: message,
          variant: "destructive",
        });
        lastStudyTypeDetectionTextRef.current = "";
      })
      .finally(() => {
        setIsDetectingStudyType(false);
      });
  }, [detectedStudyType, isDetectingStudyType, language, t]);

  useEffect(() => {
    if (!isSubscriptionModalOpen && !isSubscriptionManagementModalOpen) {
      return;
    }

    const loadSubscription = async () => {
      try {
        setIsSubscriptionLoading(true);
        const subscription = await getCurrentSubscription();
        setCurrentSubscription(subscription);

        if (!subscription && isSubscriptionManagementModalOpen) {
          setIsSubscriptionManagementModalOpen(false);
          setIsSubscriptionModalOpen(true);
        }
      } catch (error) {
        toast({
          title: t("errors.generic"),
          description: (error as ApiError)?.message ?? t("errors.requestFailed"),
          variant: "destructive",
        });
      } finally {
        setIsSubscriptionLoading(false);
      }
    };

    loadSubscription();
  }, [isSubscriptionModalOpen, isSubscriptionManagementModalOpen, t, toast]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    let preapprovalId =
      url.searchParams.get("preapproval_id") ||
      url.searchParams.get("preapprovalId") ||
      url.searchParams.get("preapproval");

    if (!preapprovalId) {
      const subscriptionParam = url.searchParams.get("subscription");
      if (subscriptionParam && subscriptionParam.includes("preapproval_id=")) {
        const innerQuery = subscriptionParam.split("?")[1] ?? "";
        const innerParams = new URLSearchParams(innerQuery);
        preapprovalId = innerParams.get("preapproval_id");
      }
    }

    if (!preapprovalId) {
      const match = url.search.match(/(?:\?|&)(?:preapproval_id|preapprovalId|preapproval)=([^&]+)/i);
      if (match?.[1]) {
        preapprovalId = decodeURIComponent(match[1]);
      }
    }

    if (!preapprovalId) {
      return;
    }

    const syncSubscription = async () => {
      try {
        setIsSubscriptionLoading(true);
        const syncResponse = await fetch("/api/subscriptions/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ preapprovalId }),
        });

        if (syncResponse.ok) {
          try {
            await syncResponse.json();
          } catch {
            // ignore
          }
        }

        const subscription = await getCurrentSubscription();
        setCurrentSubscription(subscription);

        if (subscription?.status === "active") {
          setShouldShowSubscriptionSuccessToast(true);
        }

        if (subscription) {
          setIsSubscriptionModalOpen(false);
          setIsSubscriptionManagementModalOpen(true);
        } else {
          setIsSubscriptionManagementModalOpen(false);
          setIsSubscriptionModalOpen(true);
        }
      } catch (error) {
        console.error("[subscriptions] Sync failed:", error);
      } finally {
        setIsSubscriptionLoading(false);
        const cleanedUrl = `${url.pathname}`;
        window.history.replaceState({}, "", cleanedUrl);
      }
    };

    void syncSubscription();
  }, []);

  useEffect(() => {
    const loadCountry = async () => {
      try {
        const response = await fetch("/api/country", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          country?: BillingCountry;
          currency?: BillingCurrency;
          proPrice?: number;
        };

        if (data.country) setBillingCountry(data.country);
        if (data.currency) setBillingCurrency(data.currency);
        if (typeof data.proPrice === "number" && data.proPrice > 0) setProPrice(data.proPrice);
      } catch {
        // ignore
      }
    };

    void loadCountry();
  }, []);

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
    
    runStudyTypeDetection(textToDetect);
  }, [sttState, transcript, transcription, runStudyTypeDetection]);

  // Load available templates when entering recording state
  useEffect(() => {
    if (demoState === "recording" && availableStudyTypes.length === 0) {
      getAvailableTemplates({ language })
        .then((result) => {
          setAvailableStudyTypes(
            result.templates.map((templateId: string) => ({
              value: templateId,
              label: getTemplateLabel(templateId),
            }))
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
  }, [demoState, sidebarView, t]);

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
          onRunAutoDetect={() => {
            const normalizedText = (transcription.trim() || transcript.trim()).trim();

            if (!normalizedText) {
              return;
            }

            // Clear the ref to allow re-detection with the same text
            lastStudyTypeDetectionTextRef.current = "";
            setDetectedStudyType(null);
            setSelectedStudyType("");
            runStudyTypeDetection(normalizedText);
          }}
          isDetectingStudyType={isDetectingStudyType}
          language={language}
          labels={recordingLabels}
          generatedReport={generatedReport}
          onReportChange={setGeneratedReport}
          isGenerating={isGenerating}
          currentReportId={currentReportId}
          reportTitle={currentReportTitle}
          reportChatSessionId={
            currentReportId ? reportChatSessions[currentReportId] ?? null : null
          }
          onCopyReport={handleCopyReport}
          onOpenReportChat={handleOpenReportChat}
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
      return <WelcomeSection onGenerateReport={handleGenerateReport} onToggleChat={handleToggleChat} />;
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
        const [reports, sessions] = await Promise.all([getReports(), getChatSessions()]);
        const historyItems = reports.map(mapReportToHistoryItem);
        const sessionMap = sessions.reduce<Record<string, string>>((acc, session) => {
          if (session.report_id) {
            acc[session.report_id] = session.id;
          }
          return acc;
        }, {});
        setReportHistory(historyItems);
        setReportChatSessions(sessionMap);
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

  const handleToggleChat = useCallback(() => {
    window.dispatchEvent(new CustomEvent("chat-toggle"));
  }, []);

  const handleSubscribe = useCallback(async (planId: "pro") => {
    try {
      setSubscribingPlanId(planId);
      const response = await createSubscription({ plan: planId });
      window.location.href = response.initPoint;
    } catch (error) {
      toast({
        title: t("errors.generic"),
        description: (error as ApiError)?.message ?? t("errors.requestFailed"),
        variant: "destructive",
      });
    } finally {
      setSubscribingPlanId(null);
    }
  }, [toast, t]);

  const handleRenewSubscription = useCallback(async (planId: "pro") => {
    try {
      setSubscribingPlanId(planId);
      const response = await renewSubscription({ plan: planId });
      window.location.href = response.initPoint;
    } catch (error) {
      toast({
        title: t("errors.generic"),
        description: (error as ApiError)?.message ?? t("errors.requestFailed"),
        variant: "destructive",
      });
    } finally {
      setSubscribingPlanId(null);
    }
  }, [toast, t]);

  const handleSidebarSubscriptions = useCallback(() => {
    const open = async () => {
      try {
        setIsSubscriptionLoading(true);
        const subscription = await getCurrentSubscription();
        setCurrentSubscription(subscription);

        if (subscription) {
          setIsSubscriptionManagementModalOpen(true);
        } else {
          setIsSubscriptionModalOpen(true);
        }
      } catch (error) {
        toast({
          title: t("errors.generic"),
          description: (error as ApiError)?.message ?? t("errors.requestFailed"),
          variant: "destructive",
        });
        setIsSubscriptionModalOpen(true);
      } finally {
        setIsSubscriptionLoading(false);
      }
    };

    void open();
  }, [t, toast]);

  const dateTimeFormatter = useMemo(() => {
    return new Intl.DateTimeFormat(language === "es" ? "es-CO" : "en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }, [language]);

  const formatSubscriptionDate = useCallback(
    (value: string | null) => {
      if (!value) return t("subscriptions.manage.notAvailable");
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return t("subscriptions.manage.notAvailable");
      return dateTimeFormatter.format(date);
    },
    [dateTimeFormatter, t]
  );

  const handleCancelSubscription = useCallback(async () => {
    if (!currentSubscription?.mp_preapproval_id) {
      toast({
        title: t("errors.generic"),
        description: t("subscriptions.manage.cancel.missingId"),
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCancellingSubscription(true);
      const response = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ preapprovalId: currentSubscription.mp_preapproval_id }),
      });

      if (!response.ok) {
        throw new Error(t("errors.requestFailed"));
      }

      const updated = (await response.json()) as SubscriptionRecord;
      setCurrentSubscription(updated);
      toast({
        title: t("subscriptions.manage.cancel.successTitle"),
        description: t("subscriptions.manage.cancel.successDescription"),
      });
      setIsCancelSubscriptionDialogOpen(false);

      try {
        const refreshed = await getCurrentSubscription();
        setCurrentSubscription(refreshed);
      } catch {
        // ignore
      }
    } catch (error) {
      console.error("[subscriptions] Cancel failed:", error);
      toast({
        title: t("errors.generic"),
        description: t("subscriptions.manage.cancel.error"),
        variant: "destructive",
      });
    } finally {
      setIsCancellingSubscription(false);
    }
  }, [currentSubscription?.mp_preapproval_id, currentSubscription, t, toast]);

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
          studyType: selectedStudyType || detectedStudyType || undefined,
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
          onComplete: async (reportId: string) => {
            savedReportId = reportId;
            setIsGenerating(false);
            toast({ title: t("app.generatedToast") });

            if (reportTitle) {
              const existingSessionId = reportChatSessions[reportId];
              if (existingSessionId) {
                window.dispatchEvent(
                  new CustomEvent("report-chat-open", {
                    detail: { sessionId: existingSessionId, reportId },
                  })
                );
              } else {
                try {
                  const normalizedChatTitle = reportTitle.trim().slice(0, 48);
                  const { sessionId } = await createReportChatSession({
                    reportId,
                    title: normalizedChatTitle,
                    model: process.env.NEXT_PUBLIC_DEFAULT_CHAT_MODEL || "openai/gpt-4o",
                    initialPrompt: t("chat.report.initialPrompt"),
                  });
                  setReportChatSessions((prev) => ({ ...prev, [reportId]: sessionId }));
                  window.dispatchEvent(
                    new CustomEvent("report-chat-created", {
                      detail: { sessionId, reportId },
                    })
                  );
                } catch (error) {
                  console.error("[ReportChat] Failed to create report chat", error);
                }
              }
            }
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

  const handleOpenReportChat = useCallback((reportId: string, sessionId: string) => {
    window.dispatchEvent(
      new CustomEvent("report-chat-open", {
        detail: { sessionId, reportId },
      })
    );
  }, []);

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
      reportChatSessions,
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
      onOpenReportChat: handleOpenReportChat,
      onGenerateReport: handleGenerateReport,
      generateLabel: t("reports.generate"),
      subtitleLabel: t("reports.title"),
      emptyLabel: t("reports.emptyState"),
      copyLabel: t("report.copy"),
      copiedLabel: t("report.copied"),
    }),
    [
      reportHistory,
      currentReportId,
      copiedReportId,
      reportChatSessions,
      handleOpenReportChat,
      handleCopyReportCard,
      handleGenerateReport,
      t,
    ]
  );

  const renderSubscriptionModalContent = () => (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-background" />
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
              {t("subscriptions.title")}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-2 max-w-2xl">
              {t("subscriptions.subtitle")}
            </DialogDescription>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            <span className="text-xs">{t("subscriptions.secureCheckout")}</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Gratis</CardTitle>
                  <CardDescription className="mt-1">Ideal para empezar</CardDescription>
                </div>
                {!currentSubscription && (
                  <Badge variant="secondary">Plan actual</Badge>
                )}
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold">$0</span>
                  <span className="text-sm text-muted-foreground">/ mes</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3 text-sm">
                <li className="flex gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-primary" />
                  <span>Generación de reportes básicos</span>
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-primary" />
                  <span>Historial limitado de reportes</span>
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-primary" />
                  <span>Plantillas estándar</span>
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-primary" />
                  <span>Soporte por email (básico)</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter className="pt-2">
              <Button className="w-full" variant="secondary" disabled>
                {currentSubscription ? t("subscriptions.currentPlan") : "Plan actual"}
              </Button>
            </CardFooter>
          </Card>

          <Card className="relative overflow-hidden border-primary/40 bg-gradient-to-b from-primary/10 via-background to-background">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.25),transparent_55%)]" />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{t("subscriptions.plan.pro")}</CardTitle>
                  <CardDescription className="mt-1">Para uso profesional y mayor productividad</CardDescription>
                </div>
                <Badge>Popular</Badge>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold">
                    {proPrice.toLocaleString(
                      billingCountry === "AR" ? "es-AR" : "es-CO"
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {billingCurrency} / {t("subscriptions.plan.month")}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3 text-sm">
                <li className="flex gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-primary" />
                  <span>Reportes ilimitados</span>
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-primary" />
                  <span>Mejor precisión y formato avanzado</span>
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-primary" />
                  <span>Plantillas pro y personalización</span>
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-primary" />
                  <span>Soporte prioritario</span>
                </li>
              </ul>

              <div className="mt-4 text-sm text-muted-foreground">
                {currentSubscription?.plan === "pro" ? (
                  <p>
                    {t("subscriptions.plan.status").replace(
                      "{status}",
                      formatSubscriptionStatus(currentSubscription?.status)
                    )}
                  </p>
                ) : (
                  <p>
                    {t("subscriptions.currentPlan")}:
                    {currentSubscription ? " " + t(`subscriptions.plan.${currentSubscription.plan}`) : " Gratis"}
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button
                className="w-full"
                onClick={() => handleSubscribe("pro")}
                disabled={
                  (currentSubscription?.plan === "pro" && currentSubscription?.status === "active") ||
                  subscribingPlanId === "pro" ||
                  isSubscriptionLoading
                }
              >
                {subscribingPlanId === "pro" ? t("subscriptions.processing") : t("subscriptions.cta")}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );

  const formatSubscriptionStatus = useCallback(
    (status?: SubscriptionRecord["status"] | null) => {
      if (!status) return t("subscriptions.status.pending");
      return t(`subscriptions.status.${status}`);
    },
    [t]
  );

  const renderSubscriptionManagementContent = () => {
    const isCancelled = currentSubscription?.status === "cancelled";
    const hasSubscription = Boolean(currentSubscription);
    const canCancel = Boolean(
      currentSubscription?.mp_preapproval_id && currentSubscription?.status !== "cancelled"
    );
    const isPending = currentSubscription?.status === "pending";
    const isCancelledButStillActive = (() => {
      if (!currentSubscription || currentSubscription.status !== "cancelled") return false;
      if (!currentSubscription.current_period_end) return false;
      const end = new Date(currentSubscription.current_period_end);
      if (Number.isNaN(end.getTime())) return false;
      return end.getTime() > Date.now();
    })();

    const isEffectivelyActive = Boolean(
      currentSubscription?.status === "active" || isCancelledButStillActive
    );

    const canRenew = Boolean(currentSubscription?.status === "cancelled");

    return (
      <div className="relative">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-background" />
        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
                {t("subscriptions.manage.title")}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2 max-w-2xl">
                {t("subscriptions.manage.subtitle")}
              </DialogDescription>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              <span className="text-xs">{t("subscriptions.secureCheckout")}</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-border/60 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">
                        {hasSubscription ? t(`subscriptions.plan.${currentSubscription?.plan}`) : "Gratis"}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {hasSubscription
                          ? isPending
                            ? t("subscriptions.manage.pendingDescription")
                            : t("subscriptions.manage.planDescription")
                          : t("subscriptions.manage.freeDescription")}
                      </CardDescription>
                    </div>
                    {hasSubscription ? (
                      <Badge variant={isCancelled ? "secondary" : "default"}>
                        {t("subscriptions.manage.status").replace(
                          "{status}",
                          formatSubscriptionStatus(currentSubscription?.status)
                        )}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t("subscriptions.manage.freeBadge")}</Badge>
                    )}
                  </div>
                  {isCancelledButStillActive && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      {t("subscriptions.manage.cancelledActiveUntil").replace(
                        "{date}",
                        formatSubscriptionDate(currentSubscription?.current_period_end ?? null)
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("subscriptions.manage.startDate")}
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {formatSubscriptionDate(currentSubscription?.current_period_start ?? null)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("subscriptions.manage.renewalDate")}
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {formatSubscriptionDate(currentSubscription?.current_period_end ?? null)}
                      </div>
                    </div>
                  </div>

                </CardContent>
                <CardFooter className="pt-2 flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setIsSubscriptionModalOpen(true)}
                  >
                    {t("subscriptions.manage.changePlan")}
                  </Button>
                  {isPending && (
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => handleSubscribe("pro")}
                      disabled={subscribingPlanId === "pro" || isSubscriptionLoading}
                    >
                      {subscribingPlanId === "pro"
                        ? t("subscriptions.processing")
                        : t("subscriptions.manage.pending.cta")}
                    </Button>
                  )}
                  {canRenew && (
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => handleRenewSubscription("pro")}
                      disabled={subscribingPlanId === "pro" || isSubscriptionLoading}
                    >
                      {subscribingPlanId === "pro"
                        ? t("subscriptions.processing")
                        : t("subscriptions.manage.renew.cta")}
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={() => setIsCancelSubscriptionDialogOpen(true)}
                    disabled={!canCancel || isPending}
                  >
                    {t("subscriptions.manage.cancel.cta")}
                  </Button>
                </CardFooter>
              </Card>

              <Card className="border-border/60 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("subscriptions.manage.summaryTitle")}</CardTitle>
                  <CardDescription>{t("subscriptions.manage.summarySubtitle")}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-3 text-sm">
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-primary" />
                      <span>{t("subscriptions.manage.summary.item1")}</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-primary" />
                      <span>{t("subscriptions.manage.summary.item2")}</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-primary" />
                      <span>{t("subscriptions.manage.summary.item3")}</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-primary" />
                      <span>{t("subscriptions.manage.summary.item4")}</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
          </div>
        </div>
      </div>
    );
  };

  const renderMainContent = () => (
    <MainContentLayout
      isReportsOpen={isReportsOpen}
      leftPanel={<ReportsSubmenu {...reportsSubmenuProps} />}
      rightPanel={renderContentPanel()}
      showReportOnMobile={shouldShowReportOnMobile}
    />
  );

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
            onSelectSubscriptions={() => {
              handleSidebarSubscriptions();
              setIsMobileMenuOpen(false);
            }}
            onToggleChat={() => {
              handleToggleChat();
              setIsMobileMenuOpen(false);
            }}
            currentSubscription={currentSubscription}
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
          onSelectSubscriptions={handleSidebarSubscriptions}
          onToggleChat={handleToggleChat}
          currentSubscription={currentSubscription}
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
      <Dialog open={isSubscriptionModalOpen} onOpenChange={setIsSubscriptionModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader>{renderSubscriptionModalContent()}</DialogHeader>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isSubscriptionManagementModalOpen}
        onOpenChange={setIsSubscriptionManagementModalOpen}
      >
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogHeader>
            {renderSubscriptionManagementContent()}
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isCancelSubscriptionDialogOpen}
        onOpenChange={setIsCancelSubscriptionDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("subscriptions.manage.cancel.title")}</DialogTitle>
            <DialogDescription>{t("subscriptions.manage.cancel.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsCancelSubscriptionDialogOpen(false)}
              disabled={isCancellingSubscription}
            >
              {t("subscriptions.manage.cancel.back")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={isCancellingSubscription}
            >
              {isCancellingSubscription
                ? t("subscriptions.manage.cancel.processing")
                : t("subscriptions.manage.cancel.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

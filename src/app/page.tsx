'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Menu, MessageCircle, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ReportsSubmenu } from "@/components/ReportsSubmenu";
import { SidebarMenu } from "@/components/SidebarMenu";
import { RecordingInterface } from "@/components/RecordingInterface";
import { ReportFeedback } from "@/components/ReportFeedback";
import { WelcomeSection } from "@/components/WelcomeSection";
import { ContentHeader } from "@/components/ContentHeader";
import { MainContentLayout } from "@/components/MainContentLayout";
import { cn } from "@/lib/utils";
import { ChatWidget } from "@/components/ChatWidget";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { useReportScroll } from "@/hooks/useReportScroll";
import { useUserGreeting } from "@/hooks/useUserGreeting";
import { createSpeechToTextProvider } from "@/infrastructure/speech-to-text";
import {
  createDraftReport,
  createCustomTemplate,
  updateCustomTemplate,
  createReportChatSession,
  detectStudyType,
  generateReportStream,
  getAvailableTemplates,
  getChatSessions,
  getReports,
  updateReport,
} from "@/lib/api";
import type { UpdateReportRequest } from "@/lib/api";
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
  const {
    transcript,
    state: sttState,
    error: sttError,
    start: startSTT,
    stop: stopSTT,
    reset: resetSTT,
  } = useSpeechToText(sttProvider);

  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [copiedReportId, setCopiedReportId] = useState<string | null>(null);
  const [reportChatSessions, setReportChatSessions] = useState<Record<string, string>>({});
  const [sidebarView, setSidebarView] = useState<SidebarView>("home");
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasChatBadge, setHasChatBadge] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [demoState, setDemoState] = useState<DemoState>("main");
  const [transcription, setTranscription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [currentReportTitle, setCurrentReportTitle] = useState<string | null>(null);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const savingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [editedTemplate, setEditedTemplate] = useState<string>("");
  const [isTemplateCustom, setIsTemplateCustom] = useState(false);
  const [currentTemplateMeta, setCurrentTemplateMeta] = useState<{ templateId: string | null; isSystem: boolean }>({
    templateId: null,
    isSystem: true,
  });
  const [isMobileViewport, setIsMobileViewport] = useState(false);

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
  const isCreatingDraftRef = useRef(false);
  const inFlightCreateRef = useRef<Promise<string> | null>(null);
  const pendingTitleRef = useRef<string | null>(null);
  const lastSavedTranscriptionRef = useRef<string>("");
  const pendingReportIdRef = useRef<string | null>(null);
  
  // Refs to avoid stale closures in useCallback
  const currentReportIdRef = useRef<string | null>(null);
  const currentReportTitleRef = useRef<string | null>(null);
  
  // Update refs when state changes
  useEffect(() => {
    currentReportIdRef.current = currentReportId;
  }, [currentReportId]);
  
  useEffect(() => {
    currentReportTitleRef.current = currentReportTitle;
  }, [currentReportTitle]);

  const getTemplateLabel = useCallback(
    (templateId: string) => {
      const translated = t(`studyType.${templateId}`);
      return translated === `studyType.${templateId}` ? templateId : translated;
    },
    [t]
  );

  useEffect(() => {
    setTranscription(transcript);
  }, [transcript]);

  const ensureDraftReport = useCallback(
    async (isCustomTemplate?: boolean) => {
      console.log("[ensureDraftReport] Called with:", {
        currentReportId: currentReportIdRef.current,
        currentReportTitle: currentReportTitleRef.current,
        isCustomTemplate,
        inFlight: !!inFlightCreateRef.current
      });

      // Early return guard: if we already have a reportId, don't create a new one
      // This prevents duplicate drafts when called from other handlers
      if (currentReportIdRef.current) {
        console.log("[ensureDraftReport] Using existing reportId:", currentReportIdRef.current);
        return currentReportIdRef.current;
      }

      if (inFlightCreateRef.current) {
        console.log("[ensureDraftReport] Returning in-flight promise");
        return inFlightCreateRef.current;
      }

      const createPromise = (async () => {
        try {
          isCreatingDraftRef.current = true;
          console.log("[ensureDraftReport] Creating report with:", {
            report_title: currentReportTitleRef.current || null,
            language,
            is_custom_template: isCustomTemplate ?? null,
            caller: 'ensureDraftReport'
          });
          const created = await createDraftReport({
            report_title: currentReportTitleRef.current || null,
            language,
            is_custom_template: isCustomTemplate ?? null,
          });
          const reportId = created.report_id;
          console.log("[ensureDraftReport] Created new report with ID:", reportId);
          pendingReportIdRef.current = reportId;
          setCurrentReportId(reportId);
          setReportHistory((prev) => {
            const mapped = mapReportToHistoryItem(created);
            return [mapped, ...prev];
          });
          return reportId;
        } finally {
          isCreatingDraftRef.current = false;
          inFlightCreateRef.current = null;
        }
      })();

      inFlightCreateRef.current = createPromise;
      return createPromise;
    },
    [language, setReportHistory] // Incluimos setReportHistory para mantener consistencia
  );

  const { firstName, isLoading: isGreetingLoading } = useUserGreeting();

  const greetingText = useMemo(() => {
    const greeting = t("welcome.greeting");
    if (isGreetingLoading || !firstName) {
      return greeting;
    }
    return `${greeting} ${firstName}`;
  }, [firstName, isGreetingLoading, t]);

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

  const handleTitleChange = useCallback((value: string) => {
    setCurrentReportTitle(value);
    // Mostrar indicador de guardado cuando el usuario escribe, ocultar cuando está vacío
    if (value.trim()) {
      setIsSavingContent(true);
    } else {
      setIsSavingContent(false);
    }
  }, []);

  const buildTemplateUpdates = useCallback((): UpdateReportRequest | null => {
    const effectiveStudyType = selectedStudyType || detectedStudyType || null;
    const updates: UpdateReportRequest = {};

    if (typeof isTemplateCustom === "boolean") {
      updates.is_custom_template = isTemplateCustom;
    }

    if (effectiveStudyType) {
      updates.study_type = effectiveStudyType;
      updates.used_template = isTemplateCustom ? "custom" : effectiveStudyType;
    }

    if (currentTemplateMeta.templateId) {
      updates.template_id = currentTemplateMeta.templateId;
    }

    const trimmedTemplate = editedTemplate.trim();
    if (isTemplateCustom && trimmedTemplate.length > 0) {
      updates.template_content = trimmedTemplate;
    }

    return Object.keys(updates).length > 0 ? updates : null;
  }, [selectedStudyType, detectedStudyType, isTemplateCustom, currentTemplateMeta.templateId, editedTemplate]);

  const handleTitleCommit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    setCurrentReportTitle(trimmed);

    if (!trimmed) {
      setIsSavingContent(false);
      return;
    }

    if (isCreatingDraftRef.current) {
      return;
    }

    const templateUpdates = buildTemplateUpdates();

    if (currentReportId) {
      try {
        const updates: UpdateReportRequest = {
          report_title: trimmed || undefined,
          ...(templateUpdates ?? {}),
        };

        const updated = await updateReport(currentReportId, updates);

        setReportHistory((prev) => {
          const mapped = mapReportToHistoryItem(updated);
          const existingIndex = prev.findIndex((r) => r.id === mapped.id);
          if (existingIndex >= 0) {
            const next = [...prev];
            next[existingIndex] = mapped;
            return next;
          }
          return [mapped, ...prev];
        });
      } catch (error) {
        console.error("[HomePage] Failed to update report title", error);
      } finally {
        // Ocultar indicador de guardado cuando termina
        setIsSavingContent(false);
      }
      return;
    }

    try {
      isCreatingDraftRef.current = true;
      console.log("[handleTitleCommit] Creating report with:", {
        report_title: trimmed || null,
        language,
        is_custom_template: templateUpdates?.is_custom_template ?? null,
        caller: "handleTitleCommit",
      });

      const created = await createDraftReport({
        report_title: trimmed || null,
        language,
        is_custom_template: templateUpdates?.is_custom_template ?? null,
      });

      let finalReport = created;

      // Si ya tenemos tipo de estudio / template seleccionada en la UI, persistirla inmediatamente
      if (templateUpdates && Object.keys(templateUpdates).length > 1) {
        try {
          finalReport = await updateReport(created.report_id, templateUpdates);
        } catch (error) {
          console.error("[HomePage] Failed to persist template state on title commit", error);
        }
      }

      setCurrentReportId(finalReport.report_id);
      setReportHistory((prev) => {
        const mapped = mapReportToHistoryItem(finalReport);
        return [mapped, ...prev];
      });
    } catch (error) {
      console.error("[HomePage] Failed to create draft report", error);
    } finally {
      isCreatingDraftRef.current = false;
      // Ocultar indicador de guardado cuando termina
      setIsSavingContent(false);
    }
  }, [buildTemplateUpdates, currentReportId, language, setReportHistory, t]);

  const handleContentChange = useCallback((isChanging: boolean) => {
    // Limpiar timeout existente
    if (savingTimeoutRef.current) {
      clearTimeout(savingTimeoutRef.current);
      savingTimeoutRef.current = null;
    }
    
    if (isChanging) {
      // Mostrar indicador inmediatamente cuando el usuario escribe
      setIsSavingContent(true);
    } else {
      // Ocultar indicador después de un breve retraso para evitar parpadeo
      savingTimeoutRef.current = setTimeout(() => {
        setIsSavingContent(false);
        savingTimeoutRef.current = null;
      }, 1000); // 1 segundo de retraso
    }
  }, []);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (savingTimeoutRef.current) {
        clearTimeout(savingTimeoutRef.current);
        savingTimeoutRef.current = null;
      }
    };
  }, []);

  const handleTitleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const target = event.target as HTMLInputElement;
        handleTitleCommit(target.value);
        target.blur();
      }
    },
    [handleTitleCommit],
  );

  const handleStudyTypeChange = useCallback(
    async (studyType: string, isCustomTemplate?: boolean) => {
      try {
        const reportId = await ensureDraftReport(isCustomTemplate);
        if (!reportId || !studyType) return;

        const updated = await updateReport(reportId, {
          used_template: isCustomTemplate ? "custom" : studyType,
          study_type: studyType,
          template_content: null,
          template_id: null,
          is_custom_template: isCustomTemplate ?? null,
        });

        setReportHistory((prev) => {
          const mapped = mapReportToHistoryItem(updated);
          const existingIndex = prev.findIndex((r) => r.id === mapped.id);
          if (existingIndex >= 0) {
            const next = [...prev];
            next[existingIndex] = mapped;
            return next;
          }
          return [mapped, ...prev];
        });

        setSelectedStudyType(studyType);
        setDetectedStudyType(studyType);
        setEditedTemplate("");
        setIsTemplateCustom(false);
        setCurrentTemplateMeta({ templateId: null, isSystem: true });
      } catch (error) {
      console.error("[HomePage] Failed to detect study type", error);
      } finally {
        isCreatingDraftRef.current = false;
      }
    },
    [ensureDraftReport, t],
  );

  const handleTemplateSave = useCallback(
    async (value: string, isCustom: boolean) => {
      const trimmedValue = value.trim();
      const effectiveStudyType = selectedStudyType || detectedStudyType || null;
      let reportId = currentReportId;

      try {
        if (!reportId) {
          reportId = await ensureDraftReport(isCustom);
        }

        if (!reportId) {
          return;
        }

        if (!effectiveStudyType) {
          return;
        }

        // If we're editing an existing custom template, update that template record too
        if (isCustom && !currentTemplateMeta.isSystem && currentTemplateMeta.templateId) {
          await updateCustomTemplate(currentTemplateMeta.templateId, { content: trimmedValue });
        }

        // If user edited a system template, create a new custom template record and persist template_id
        const nextTemplateId =
          isCustom && currentTemplateMeta.isSystem
            ? (
                await createCustomTemplate({
                  studyType: effectiveStudyType,
                  language,
                  content: trimmedValue,
                })
              ).templateId
            : currentTemplateMeta.templateId;

        const updated = await updateReport(reportId, {
          template_content: trimmedValue,
          template_id: nextTemplateId,
          used_template: isCustom ? "custom" : effectiveStudyType,
          study_type: effectiveStudyType,
          is_custom_template: isCustom,
        });

        setReportHistory((prev) => {
          const mapped = mapReportToHistoryItem(updated);
          const existingIndex = prev.findIndex((r) => r.id === mapped.id);
          if (existingIndex >= 0) {
            const next = [...prev];
            next[existingIndex] = mapped;
            return next;
          }
          return [mapped, ...prev];
        });

        setIsTemplateCustom(isCustom);
        setEditedTemplate(trimmedValue);
        setSelectedStudyType(effectiveStudyType);
        setDetectedStudyType(effectiveStudyType);
        if (isCustom && currentTemplateMeta.isSystem) {
          setCurrentTemplateMeta({ templateId: nextTemplateId ?? null, isSystem: false });
        }
      } catch (error) {
      const apiError = error as ApiError;
      console.error("[HomePage] Failed to save template", {
        message: apiError?.message,
        status: apiError?.status,
        details: apiError?.details,
        error,
      });
      } finally {
        isCreatingDraftRef.current = false;
      }
    },
    [ensureDraftReport, currentReportId, currentReportTitle, currentTemplateMeta.isSystem, currentTemplateMeta.templateId, detectedStudyType, language, selectedStudyType, t],
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
      .then(async (result) => {
        setAvailableStudyTypes(
          result.availableTemplates.map((templateId: string) => ({
            value: templateId,
            label: getTemplateLabel(templateId),
          }))
        );
        await handleStudyTypeChange(result.studyType);
      })
      .catch((error) => {
        const message = (error as ApiError)?.message ?? t("errors.requestFailed");
        console.error('[StudyType] Detection failed:', error);
        console.error("[HomePage] Study type detection error:", message);
        lastStudyTypeDetectionTextRef.current = "";
      })
      .finally(() => {
        setIsDetectingStudyType(false);
      });
  }, [getTemplateLabel, handleStudyTypeChange, isDetectingStudyType, language, t]);

  const showWelcome = sidebarView === "home" && demoState === "main" && !currentReportId;

  const headerSubtitle = useMemo(() => {
    if (demoState === "recording") return t("header.generateReport");
    return null;
  }, [demoState, t]);

  const mobileHeaderTitle = useMemo(() => {
    if (headerSubtitle) return headerSubtitle;
    if (isReportsOpen && sidebarView === "reports") return t("reports.subtitle");
    if (demoState !== "recording") return greetingText;
    return null;
  }, [demoState, greetingText, headerSubtitle, isReportsOpen, sidebarView, t]);

  const renderContentPanel = () => {
    if (demoState === "recording") {
      return (
        <RecordingInterface
          transcription={transcription}
          placeholder={t("recording.placeholder")}
          label={t("recording.label")}
          uploadLabel={generatedReport ? t("recording.regenerate") : t("recording.upload")}
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
          onStudyTypeChange={handleStudyTypeChange}
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
          onContentChange={handleContentChange}
          onTemplateChange={setEditedTemplate}
          onTemplateSave={handleTemplateSave}
          initialTemplateContent={(() => {
            const report = reportHistory.find((r) => r.id === currentReportId);
            // Load saved template content if it exists (custom template was used)
            if (report?.templateContent?.trim()) {
              return report.templateContent;
            }
            return null;
          })()}
          onTemplateEditStatusChange={setIsTemplateCustom}
          onTemplateModeChange={handleTemplateModeChange}
          isTemplateCustom={(() => {
            const report = reportHistory.find((r) => r.id === currentReportId);
            const isCustom = report?.isCustomTemplate ?? undefined;
            console.log("[page.tsx] isTemplateCustom for RecordingInterface:", {
              currentReportId,
              isCustom,
              reportFound: !!report,
              reportData: report ? {
                id: report.id,
                isCustomTemplate: report.isCustomTemplate,
                templateContent: report.templateContent?.substring(0, 50) + "..."
              } : null
            });
            return isCustom;
          })()}
          onTemplateMetaChange={async ({ templateId, isSystem }) => {
            setCurrentTemplateMeta({ templateId, isSystem });
            if (!templateId) return;
            const reportId = currentReportId;
            if (!reportId) return;
            try {
              const updated = await updateReport(reportId, { template_id: templateId });
              setReportHistory((prev) => {
                const mapped = mapReportToHistoryItem(updated);
                const existingIndex = prev.findIndex((r) => r.id === mapped.id);
                if (existingIndex >= 0) {
                  const next = [...prev];
                  next[existingIndex] = mapped;
                  return next;
                }
                return [mapped, ...prev];
              });
            } catch (error) {
              console.error("[HomePage] Failed to persist template_id", error);
            }
          }}
        />
      );
    }



    if (showWelcome) {
      return (
        <WelcomeSection
          onGenerateReport={handleGenerateReport}
          onToggleChat={handleToggleChat}
          onOpenNewChat={handleOpenNewChat}
          showGreeting={false}
        />
      );
    }

    // When in reports view but no report selected, show welcome section
    if (sidebarView === "reports" && !currentReportId) {
      return (
        <WelcomeSection
          onGenerateReport={handleGenerateReport}
          onToggleChat={handleToggleChat}
          onOpenNewChat={handleOpenNewChat}
          showGreeting={false}
        />
      );
    }

    // Default: show welcome section
    return (
      <WelcomeSection
        onGenerateReport={handleGenerateReport}
        onToggleChat={handleToggleChat}
        onOpenNewChat={handleOpenNewChat}
        showGreeting={false}
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
        console.error("[HomePage] Failed to load reports/sessions:", message);
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
    setIsReportsOpen(false);
    setIsMobileMenuOpen(false); // Close mobile menu if open
    setDemoState("recording");
    setDetectedStudyType(null);
    setSelectedStudyType("");
    setAvailableStudyTypes([]);
    setGeneratedReport(null);
    setCurrentReportId(null);
    setCurrentReportTitle(null);
    setIsSavingContent(false);
    setTranscription("");
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
      console.error("[HomePage] Microphone access/start error", error);
    }
  }, [startSTT, language, t, transcription]);

  const handleStopRecording = useCallback(async () => {
    await stopSTT();
  }, [stopSTT]);

  const handleToggleChat = useCallback(() => {
    window.dispatchEvent(new CustomEvent("chat-toggle"));
  }, []);

  const handleOpenNewChat = useCallback(() => {
    window.dispatchEvent(new CustomEvent("chat-new"));
  }, []);

  const handleChatOpenChange = useCallback((open: boolean) => {
    setIsChatOpen(open);
  }, []);

  const handleChatBadgeChange = useCallback((hasBadge: boolean) => {
    setHasChatBadge(hasBadge);
  }, []);

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  /**
   * Handles auto-save of transcription updates
   * Errors are handled by the useAutoSave hook and displayed in the status indicator
   * 
   * @param value - The updated transcription text
   * @throws {ApiError} Re-throws errors for the hook to handle
   */
  const handleTranscriptionUpdate = useCallback(async (value: string) => {
    // Mostrar indicador de guardado
    setIsSavingContent(true);
    
    try {
      const reportId = await ensureDraftReport();
      if (!reportId) return;

      await updateReport(reportId, { updated_transcription: value });
      lastSavedTranscriptionRef.current = value;
      
      // Update local state only after successful save
      setReportHistory((prev) =>
        prev.map((report) =>
          report.id === reportId
            ? { ...report, transcription: value }
            : report
        )
      );
    } catch (error) {
      console.error("[handleTranscriptionUpdate] Failed to update transcription", error);
    } finally {
      // Ocultar indicador de guardado
      setIsSavingContent(false);
    }
  }, [ensureDraftReport, setReportHistory]);

  // Auto-detect study type (and persist findings) when recording stops
  useEffect(() => {
    const prevState = prevSttStateRef.current;
    const currentState = sttState;
    prevSttStateRef.current = currentState;

    const justStopped = (prevState === 'recording' || prevState === 'stopping') && currentState === 'idle';
    
    if (!justStopped) {
      return;
    }

    const textToDetect = transcription.trim() || transcript.trim();
    // Persist the final dictated findings
    const trimmedFindings = textToDetect.trim();
    if (trimmedFindings && trimmedFindings !== lastSavedTranscriptionRef.current.trim()) {
      handleTranscriptionUpdate(trimmedFindings).catch((error) => {
        console.error("[STT] Failed to persist transcription", error);
      });
    }
    
    runStudyTypeDetection(textToDetect);
  }, [sttState, transcript, transcription, runStudyTypeDetection, handleTranscriptionUpdate]);

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
    
    // Mostrar indicador de guardado
    setIsSavingContent(true);
    
    try {
      await updateReport(currentReportId, { updated_report: value });
      
      // Update local state only after successful save
      setReportHistory((prev) =>
        prev.map((report) =>
          report.id === currentReportId
            ? { ...report, report: value }
            : report
        )
      );
    } catch (error) {
      console.error("[handleReportUpdate] Failed to update report", error);
    } finally {
      // Ocultar indicador de guardado
      setIsSavingContent(false);
    }
  }, [currentReportId]);

  const handleTemplateModeChange = useCallback(
    async (isCustom: boolean) => {
      setIsTemplateCustom(isCustom);

      const effectiveStudyType = selectedStudyType || detectedStudyType || null;
      const reportId = await ensureDraftReport(isCustom);
      if (!reportId) return;

      try {
        const updates: UpdateReportRequest = {
          is_custom_template: isCustom,
        };

        if (effectiveStudyType) {
          updates.study_type = effectiveStudyType;
          updates.used_template = isCustom ? "custom" : effectiveStudyType;
        }

        const updated = await updateReport(reportId, updates);

        setReportHistory((prev) => {
          const mapped = mapReportToHistoryItem(updated);
          const existingIndex = prev.findIndex((r) => r.id === mapped.id);
          if (existingIndex >= 0) {
            const next = [...prev];
            next[existingIndex] = mapped;
            return next;
          }
          return [mapped, ...prev];
        });
      } catch (error) {
        console.error("[HomePage] Failed to persist template mode", error);
      }
    },
    [ensureDraftReport, selectedStudyType, detectedStudyType, setReportHistory]
  );

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
    } catch (error) {
      console.error("[HomePage] Failed to copy report", error);
    }
  }, [currentReportId, currentReportTitle, generatedReport, reportHistory]);

  const handleStartUpload = async () => {
    if (!selectedStudyType && !detectedStudyType && !isTemplateCustom) {
      console.warn("[HomePage] Template selection required before upload");
      return;
    }

    const trimmed = transcription.trim();
    const userProvidedTitle = currentReportTitle?.trim() || null;
    pendingTitleRef.current = userProvidedTitle?.length ? userProvidedTitle : null;

    // Siempre crear un nuevo informe para nuevas generaciones
    // Solo limpiar el currentReportId si no existe un borrador válido
    let draftReportId: string | null = null;
    
    if (currentReportId) {
      console.log("[handleStartUpload] Using existing reportId:", currentReportId);
      // Usar el reportId existente en lugar de crear uno nuevo
      draftReportId = currentReportId;
      
      // Actualizar el título si el usuario proporcionó uno
      if (userProvidedTitle?.length) {
        try {
          await updateReport(draftReportId, { report_title: userProvidedTitle });
          setCurrentReportTitle(userProvidedTitle);
          setIsSavingContent(false); // Mostrar check verde después de guardar
          currentReportTitleRef.current = userProvidedTitle;
        } catch (error) {
          console.error("[handleStartUpload] Failed to update title", error);
        }
      }
    } else {
      // Solo crear nuevo borrador si no existe uno
      setCurrentReportId(null);
      setCurrentReportTitle(null);
      currentReportIdRef.current = null;  // sync ref immediately
      currentReportTitleRef.current = null;  // sync ref immediately
      
      draftReportId = await ensureDraftReport(isTemplateCustom);
    }

    setIsGenerating(true);
    setGeneratedReport(""); // Clear previous report

    // Mantener el ID de borrador como currentReportId mientras generamos
    if (draftReportId) {
      setCurrentReportId(draftReportId);
    } else {
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
          templateId: currentTemplateMeta.templateId || undefined,
          // Pasar siempre el ID del borrador (si existe) para que el backend
          // actualice la misma fila en vez de crear un nuevo reporte.
          reportId: draftReportId || currentReportId || undefined,
        },
        {
          onChunk: (chunk: string) => {
            accumulatedReport += chunk;
            setGeneratedReport(accumulatedReport);

            // Extract title from first line when we have content
            if (!reportTitle && !pendingTitleRef.current && accumulatedReport.trim()) {
              const lines = accumulatedReport.trim().split('\n');
              if (lines.length > 0) {
                reportTitle = lines[0];
                setCurrentReportTitle(reportTitle);
                setIsSavingContent(false); // Mostrar check verde cuando se extrae título del contenido
              }
            }
          },
          onMetadata: (metadata) => {
            savedReportId = metadata.reportId;
            const pendingTitle = pendingTitleRef.current?.trim();
            reportTitle = pendingTitle || metadata.title;
            setCurrentReportId(metadata.reportId);
            setCurrentReportTitle(reportTitle);
            setIsSavingContent(false); // Mostrar check verde cuando se carga el metadata del reporte

            // Update report history - update existing report or add new one
            setReportHistory((prev) => {
              const existingIndex = prev.findIndex((r) => r.id === metadata.reportId);
              const existingReport = existingIndex >= 0 ? prev[existingIndex] : null;
              const updatedReport: ReportHistoryItem = {
                id: metadata.reportId,
                title: reportTitle,
                report: accumulatedReport,
                transcription: trimmed,
          updatedTranscription: trimmed,
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

            if (pendingTitle) {
              updateReport(metadata.reportId, { report_title: pendingTitle }).catch((error) => {
                console.error("[ReportTitle] Failed to persist pending title", error);
              });
            }

            pendingTitleRef.current = null;
          },
          onComplete: async (reportId: string) => {
            savedReportId = reportId;
            setIsGenerating(false);

            console.log("[onComplete] ReportId:", reportId, "ReportTitle:", reportTitle);

            if (reportTitle) {
              const existingSessionId = reportChatSessions[reportId];
              if (existingSessionId) {
                console.log("[onComplete] Opening existing chat:", existingSessionId);
                window.dispatchEvent(
                  new CustomEvent("report-chat-open", {
                    detail: { sessionId: existingSessionId, reportId },
                  })
                );
              } else {
                try {
                  console.log("[onComplete] Creating new chat for report:", reportId);
                  const normalizedChatTitle = reportTitle.trim().slice(0, 48);
                  const { sessionId } = await createReportChatSession({
                    reportId,
                    title: normalizedChatTitle,
                    model: process.env.NEXT_PUBLIC_DEFAULT_CHAT_MODEL || "openai/gpt-4o",
                    initialPrompt: t("chat.report.initialPrompt"),
                  });
                  setReportChatSessions((prev) => ({ ...prev, [reportId]: sessionId }));
                  console.log("[onComplete] Created chat session:", sessionId, "dispatching event");
                  window.dispatchEvent(
                    new CustomEvent("report-chat-created", {
                      detail: { sessionId, reportId },
                    })
                  );
                } catch (error) {
                  const apiError = error as ApiError;
                  console.warn("[ReportChat] Failed to create report chat", {
                    message: apiError?.message,
                    status: apiError?.status,
                    details: apiError?.details,
                    error,
                  });
                }
              }
            } else {
              console.log("[onComplete] No report title available, skipping chat creation");
            }
          },
          onError: (error: Error) => {
            console.error("Stream error:", error);
            setIsGenerating(false);
            setGeneratedReport(null);
            console.error("[HomePage] Generate report stream error:", error.message || t("errors.requestFailed"));
          },
        }
      );
    } catch (error) {
      const message = (error as ApiError)?.message ?? t("errors.requestFailed");
      setIsGenerating(false);
      setGeneratedReport(null);
      console.error("[HomePage] Generate report failed:", message);
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

  useEffect(() => {
    if (isMobileViewport && shouldShowFeedback && currentReportId) {
      setMinimizedFeedbackReports((prev) => {
        const next = new Set(prev);
        next.add(currentReportId);
        return next;
      });
    }
  }, [currentReportId, isMobileViewport, shouldShowFeedback]);

  const handleShowFeedbackButton = useCallback(() => {
    if (!currentReportId || !shouldShowFeedback) return;
    setMinimizedFeedbackReports((prev) => {
      const next = new Set(prev);
      if (next.has(currentReportId)) {
        next.delete(currentReportId);
      } else {
        next.add(currentReportId);
      }
      return next;
    });
  }, [currentReportId, shouldShowFeedback]);

  const handleCopyReportCard = useCallback(async (report: ReportHistoryItem) => {
    try {
      await navigator.clipboard.writeText(
        `${report.title}\n\n${report.report}`,
      );
      setCopiedReportId(report.id);
      setTimeout(() => setCopiedReportId(null), COPY_FEEDBACK_DURATION_MS);
    } catch (error) {
      console.error("[HomePage] Failed to copy report card", error);
    }
  }, []);

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
    setCurrentReportId(null);
    setCurrentReportTitle(null);
    setIsReportsOpen(false);
  }, []);

  const handleSidebarReports = useCallback(() => {
    setSidebarView("reports");
    setIsReportsOpen((prev) => !prev);
  }, []);

  const handleCloseReports = useCallback(() => {
    setIsReportsOpen(false);
  }, []);

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
          setIsSavingContent(false); // Mostrar check verde al cargar reporte existente
          setTranscription(report.transcription);
          setGeneratedReport(report.report);
          
          // Determine the actual study type (not "custom")
          const actualStudyType = report.studyType || report.usedTemplate || "";

          // Determinar si el reporte usa plantilla custom basándonos en los flags persistidos
          const isCustomTemplate =
            report.isCustomTemplate ?? (report.usedTemplate === "custom");

          // Siempre setear en el selector el study type real (nunca "custom")
          const selectorStudyType = actualStudyType === "custom" ? "" : actualStudyType;
          setSelectedStudyType(selectorStudyType);
          setDetectedStudyType(selectorStudyType);
          
          // Contenido de plantilla: si tenemos snapshot guardado lo usamos; si no, dejamos
          // que RecordingInterface/useTemplateContent lo resuelva vía API/preferencias.
          if (report.templateContent?.trim()) {
            setEditedTemplate(report.templateContent);
          } else {
            setEditedTemplate("");
          }

          // El switch de custom debe reflejar el flag de la BD, aunque templateContent sea null
          setIsTemplateCustom(Boolean(isCustomTemplate));
          
          // Update template metadata
          setCurrentTemplateMeta({
            templateId: report.templateId ?? null,
            isSystem: !isCustomTemplate,
          });
          
          setDemoState("recording");
          setSidebarView("reports");
          setIsReportsOpen(false);
        }
      },
      onCopyReport: handleCopyReportCard,
      subtitleLabel: t("reports.title"),
      emptyLabel: t("reports.emptyState"),
      copyLabel: t("report.copy"),
      copiedLabel: t("report.copied"),
      untitledLabel: t("reports.untitled"),
    }),
    [reportHistory, currentReportId, copiedReportId, handleCopyReportCard, t]
  );

  const reportsPanel = <ReportsSubmenu {...reportsSubmenuProps} />;

  const renderMainContent = () => {
    // On mobile, show reports panel in main content when reports are open
    // On desktop, always show content panel (reports panel is in overlay)
    const feedbackButtonVisible = shouldShowFeedback;
    const feedbackLabel = language === "es" ? "Comentarios" : "Feedback";

    const headerNode = (
      <ContentHeader
        mode={demoState === "recording" ? "recording" : "home"}
        greeting={greetingText}
        title={currentReportTitle ?? ""}
        placeholder={language === "es" ? "Título del informe" : "Report title"}
        copyDisabled={!currentReportId || !generatedReport}
        onCopy={handleCopyReport}
        onTitleChange={handleTitleChange}
        onTitleCommit={handleTitleCommit}
        onTitleKeyDown={handleTitleKeyDown}
        isSaving={isSavingContent}
        onToggleChat={handleToggleChat}
        isChatOpen={isChatOpen}
        showChatBadge={hasChatBadge}
        onShowFeedback={feedbackButtonVisible ? handleShowFeedbackButton : undefined}
        feedbackVisible={feedbackButtonVisible && currentReportId ? !minimizedFeedbackReports.has(currentReportId) : false}
        feedbackLabel={feedbackLabel}
      />
    );

    const content = (
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Mobile: reports panel when open */}
        <div className={cn("flex-1 min-h-0", isReportsOpen ? "lg:hidden" : "hidden")}>
          {reportsPanel}
        </div>
        {/* Content panel: always rendered; hidden on mobile when reports are open */}
        <div className={cn("flex-1 min-h-0 flex flex-col", isReportsOpen && "hidden lg:flex")}>
          {renderContentPanel()}
        </div>
      </div>
    );
    
    return <MainContentLayout header={headerNode} rightPanel={content} />;
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
            {mobileHeaderTitle && (
              <div className="flex-1 flex justify-center">
                <h2 className="text-base sm:text-lg font-medium text-foreground">
                  {mobileHeaderTitle}
                </h2>
              </div>
            )}
            <div className="flex items-center gap-2">
              {shouldShowFeedback && currentReportId && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleShowFeedbackButton}
                  className={cn(
                    "relative w-8 h-8 sm:w-10 sm:h-10",
                    !minimizedFeedbackReports.has(currentReportId) &&
                      "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                  )}
                  aria-label={t("feedback.maximize")}
                >
                  <span className="text-lg leading-none font-semibold text-amber-400">!</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={handleToggleChat}
                className={cn(
                  "relative w-8 h-8 sm:w-10 sm:h-10 mr-1",
                  isChatOpen && "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                )}
                aria-label={isChatOpen ? "Cerrar chat" : "Abrir chat"}
              >
                <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                {hasChatBadge && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-semibold text-white ring-2 ring-background">
                    1
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu Sheet */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-auto max-w-none p-0 shadow-none border-none h-screen data-[state=open]:animate-in data-[state=closed]:animate-out [&>button]:hidden">
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
            onGenerateReport={handleGenerateReport}
            onCloseReports={handleCloseReports}
            reportsPanel={reportsPanel}
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
          onGenerateReport={handleGenerateReport}
          onCloseReports={handleCloseReports}
          reportsPanel={reportsPanel}
        />

        <section className="flex-1 min-w-0 overflow-y-auto h-[calc(100dvh-4rem)] lg:h-screen" data-report-container>
          <div className="h-full flex flex-col min-h-0">
            <div className="flex-1 flex flex-col min-h-0">{renderMainContent()}</div>
          </div>
        </section>
        <ChatWidget
          className="h-[calc(100dvh-4rem)] lg:h-screen"
          onOpenChange={handleChatOpenChange}
          onReportBadgeChange={handleChatBadgeChange}
        />
      </main>
      {shouldShowFeedback && (
        <ReportFeedback
          reportId={currentReportId!}
          onSubmitted={() => handleFeedbackSubmitted(currentReportId!)}
          onMinimize={() => handleFeedbackMinimized(currentReportId!)}
          isMinimized={minimizedFeedbackReports.has(currentReportId!)}
          rightOffset={isChatOpen ? 520 : 16}
        />
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  GlobeIcon,
  HistoryIcon,
  MicIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createChatMessage,
  createChatSession,
  getChatMessages,
  getChatSessions,
  getReports,
  updateChatSession,
  type ChatMessage,
  type ChatSession,
  type Report,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface MessageType {
  key: string;
  from: "user" | "assistant";
  content: string;
  sources?: { href: string; title: string }[];
  reasoning?: {
    content: string;
    duration: number;
  };
}

const PANEL_DEFAULT_WIDTH = 420;
const PANEL_MIN_WIDTH = 360;
const PANEL_MAX_WIDTH = 760;
const MOBILE_BREAKPOINT = 640;
const TEMP_SESSION_ID = "temp-chat";
const TEXTAREA_MIN_HEIGHT = 44;
const TEXTAREA_MAX_HEIGHT = 240;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const setGlobalResizeCursor = (isResizing: boolean) => {
  if (typeof document === "undefined") return;
  const style = isResizing ? "col-resize" : "";
  document.body.style.cursor = style;
  document.documentElement.style.cursor = style;
  const userSelect = isResizing ? "none" : "";
  document.body.style.userSelect = userSelect;
  document.documentElement.style.userSelect = userSelect;
  // Safari/WebKit
  (document.body.style as any).webkitUserSelect = userSelect;
  (document.documentElement.style as any).webkitUserSelect = userSelect;
};

const models = [
  {
    id: "openai/gpt-5.1",
    name: "GPT-5.1",
    chef: "OpenAI",
    chefSlug: "openai",
    providers: ["openai", "azure"],
  },
  {
    id: "anthropic/claude-4.5-sonnet",
    name: "Claude 4.5 Sonnet",
    chef: "Anthropic",
    chefSlug: "anthropic",
    providers: ["anthropic", "azure"],
  },
  {
    id: "google/gemini-3.0-flash",
    name: "Gemini 3.0 Flash",
    chef: "Google",
    chefSlug: "google",
    providers: ["google"],
  },
];

interface ChatWidgetProps {
  className?: string;
  onOpenChange?: (isOpen: boolean) => void;
  onReportBadgeChange?: (hasBadge: boolean) => void;
}

const PromptInputAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <Attachment
          data={attachment}
          key={attachment.id}
          onRemove={() => attachments.remove(attachment.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
};

export function ChatWidget({
  className,
  onOpenChange,
  onReportBadgeChange,
}: ChatWidgetProps = {}) {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);
  const [copiedMessageKey, setCopiedMessageKey] = useState<string | null>(null);
  const resizeStateRef = useRef({
    active: false,
    startX: 0,
    startWidth: PANEL_DEFAULT_WIDTH,
  });
  const [model, setModel] = useState<string>(models[0].id);
  const modelRef = useRef(model);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const selectedReportIdRef = useRef<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [reportChatBadge, setReportChatBadge] = useState(false);
  const [recentSessionIds, setRecentSessionIds] = useState<string[]>([]);
  const [hasTemporaryChat, setHasTemporaryChat] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const autoOpenedRef = useRef(false);
  const streamingQueueRef = useRef<string[]>([]);
  const streamingIntervalRef = useRef<number | null>(null);
  const streamingTextRef = useRef("");
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const [text, setText] = useState<string>("");
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");
  const [messages, setMessages] = useState<MessageType[]>([]);
  const messagesRef = useRef<MessageType[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    selectedReportIdRef.current = selectedReportId;
  }, [selectedReportId]);

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  useEffect(() => {
    const handleReportChatCreated = async (event: Event) => {
      console.log("[ChatWidget] handleReportChatCreated event received");
      const detail = (event as CustomEvent).detail as
        | { sessionId: string; reportId: string }
        | undefined;
      if (!detail) {
        console.log("[ChatWidget] No detail in event");
        return;
      }
      console.log("[ChatWidget] Processing report chat created:", detail);
      const isMobileNow = typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
      setReportChatBadge(true);
      setSelectedReportId(detail.reportId);
      setHasTemporaryChat(false);
      try {
        const sessionData = await getChatSessions();
        setSessions(sessionData);
        const history = await getChatMessages(detail.sessionId);
        setMessages(history.map(mapStoredMessage));
      } catch (error) {
        console.error("[ChatWidget] Failed to load report chat", error);
      }
      setActiveSessionId(detail.sessionId);
      autoOpenedRef.current = true;
      if (!isMobileNow) {
        setIsOpen(true);
      }
      console.log("[ChatWidget] Report chat created and opened successfully");
    };

    window.addEventListener("report-chat-created", handleReportChatCreated);
    return () => {
      window.removeEventListener("report-chat-created", handleReportChatCreated);
    };
  }, []);

  useEffect(() => {
    const handleReportChatOpen = async (event: Event) => {
      console.log("[ChatWidget] handleReportChatOpen event received");
      const detail = (event as CustomEvent).detail as
        | { sessionId: string; reportId: string }
        | undefined;
      if (!detail) {
        console.log("[ChatWidget] No detail in event");
        return;
      }
      console.log("[ChatWidget] Processing report chat open:", detail);
      const isMobileNow = typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
      setReportChatBadge(true);
      setSelectedReportId(detail.reportId);
      setHasTemporaryChat(false);
      try {
        const sessionData = await getChatSessions();
        setSessions(sessionData);
        const history = await getChatMessages(detail.sessionId);
        setMessages(history.map(mapStoredMessage));
      } catch (error) {
        console.error("[ChatWidget] Failed to load report chat", error);
      }
      setActiveSessionId(detail.sessionId);
      if (!isMobileNow) {
        setIsOpen(true);
      }
      console.log("[ChatWidget] Report chat opened successfully");
    };

    window.addEventListener("report-chat-open", handleReportChatOpen);
    return () => {
      window.removeEventListener("report-chat-open", handleReportChatOpen);
    };
  }, []);

  useEffect(() => {
    const handleChatToggle = () => {
      setIsOpen((prev) => {
        const next = !prev;
        if (prev && !next && autoOpenedRef.current) {
          setReportChatBadge(false);
          autoOpenedRef.current = false;
        }
        return next;
      });
    };

    window.addEventListener("chat-toggle", handleChatToggle);
    return () => {
      window.removeEventListener("chat-toggle", handleChatToggle);
    };
  }, []);

  useEffect(() => {
    const handleChatNew = () => {
      setIsOpen(true);
      void handleNewChat();
    };

    window.addEventListener("chat-new", handleChatNew);
    return () => {
      window.removeEventListener("chat-new", handleChatNew);
    };
  }, []);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    onReportBadgeChange?.(reportChatBadge);
  }, [onReportBadgeChange, reportChatBadge]);

  const autoResizeTextarea = useCallback((target?: HTMLTextAreaElement | null) => {
    const element = target ?? textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    const nextHeight = Math.min(
      Math.max(element.scrollHeight, TEXTAREA_MIN_HEIGHT),
      TEXTAREA_MAX_HEIGHT
    );
    element.style.height = `${nextHeight}px`;
    element.style.overflowY =
      element.scrollHeight > TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const candidate = document.querySelector<HTMLTextAreaElement>(
      'textarea[data-slot="input-group-control"][name="message"]'
    );
    if (candidate) {
      textareaRef.current = candidate;
      candidate.style.height = `${TEXTAREA_MIN_HEIGHT}px`;
      candidate.style.overflowY = "hidden";
      autoResizeTextarea(candidate);
    }
  }, [autoResizeTextarea, isOpen]);

  useEffect(() => {
    autoResizeTextarea();
  }, [autoResizeTextarea, text]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!resizeStateRef.current.active) {
        return;
      }
      setGlobalResizeCursor(true);
      const delta = resizeStateRef.current.startX - event.clientX;
      const nextWidth = clamp(
        resizeStateRef.current.startWidth + delta,
        PANEL_MIN_WIDTH,
        PANEL_MAX_WIDTH
      );
      setPanelWidth(nextWidth);
    };

    const handlePointerUp = () => {
      resizeStateRef.current.active = false;
      setGlobalResizeCursor(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      setGlobalResizeCursor(false);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const loadSessions = async () => {
      setLoadingSessions(true);
      try {
        const [sessionData, reportData] = await Promise.all([
          getChatSessions(),
          getReports(),
        ]);
        setSessions(sessionData);
        setReports(reportData);
        if (sessionData.length > 0) {
          setHasTemporaryChat(false);
          // Only set active session if none is already set
          if (!activeSessionId) {
            const preferredSessionId = sessionData[0].id;
            setActiveSessionId(preferredSessionId);
            const history = await getChatMessages(preferredSessionId);
            setMessages(history.map(mapStoredMessage));
          }
        } else {
          setActiveSessionId(null);
          setMessages([]);
          setHasTemporaryChat(true);
        }
      } catch (error) {
        console.error("[ChatWidget] Failed to load sessions", error);
      } finally {
        setLoadingSessions(false);
      }
    };

    void loadSessions();
  }, [isOpen]);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }
    setRecentSessionIds((prev) => {
      if (prev.includes(activeSessionId)) {
        return prev;
      }
      return [activeSessionId, ...prev].slice(0, 6);
    });
  }, [activeSessionId]);

  const mapStoredMessage = (message: ChatMessage): MessageType => ({
    key: message.id,
    from: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
  });

  const handleSelectSession = async (sessionId: string) => {
    if (editingSessionId) {
      return;
    }
    setHasTemporaryChat(false);
    setActiveSessionId(sessionId);
    try {
      const history = await getChatMessages(sessionId);
      setMessages(history.map(mapStoredMessage));
    } catch (error) {
      console.error("[ChatWidget] Failed to load messages", error);
    }
  };

  const handleNewChat = async () => {
    setHasTemporaryChat(true);
    setActiveSessionId(null);
    setMessages([]);
    setSelectedReportId(null);
  };

  const startEditingSession = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title || "");
  };

  const cancelEditingSession = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const saveEditingSession = async (sessionId: string) => {
    const nextTitle = editingTitle.trim();
    if (!nextTitle) {
      cancelEditingSession();
      return;
    }
    try {
      const updated = await updateChatSession(sessionId, { title: nextTitle });
      setSessions((prev) =>
        prev.map((session) => (session.id === updated.id ? updated : session))
      );
    } catch (error) {
      console.error("[ChatWidget] Failed to update chat title", error);
    } finally {
      cancelEditingSession();
    }
  };

  const handleCloseRecentSession = (sessionId: string) => {
    if (sessionId === TEMP_SESSION_ID) {
      setHasTemporaryChat(true);
      setActiveSessionId(null);
      setMessages([]);
      return;
    }
    setRecentSessionIds((prev) => {
      const remaining = prev.filter((id) => id !== sessionId);
      if (activeSessionId === sessionId) {
        if (remaining.length > 0) {
          void handleSelectSession(remaining[0]);
        } else {
          setActiveSessionId(null);
          setMessages([]);
          setHasTemporaryChat(true);
        }
      }
      return remaining;
    });
  };

  const clearStreamingState = useCallback(() => {
    if (streamingIntervalRef.current) {
      window.clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }
    streamingQueueRef.current = [];
  }, []);

  const addUserMessage = useCallback(
    async (content: string) => {
      let sessionId = activeSessionId;
      if (!sessionId) {
        const newSession = await createChatSession({
          model: modelRef.current,
          title: content.slice(0, 48),
        });
        setSessions((prev) => [newSession, ...prev]);
        sessionId = newSession.id;
        setActiveSessionId(newSession.id);
        setHasTemporaryChat(false);
      } else {
        const activeSession = sessions.find((session) => session.id === sessionId);
        if (
          activeSession &&
          (!activeSession.title || activeSession.title === t("chat.newTitle"))
        ) {
          const nextTitle = content.slice(0, 48);
          try {
            const updated = await updateChatSession(sessionId, { title: nextTitle });
            setSessions((prev) =>
              prev.map((session) =>
                session.id === updated.id ? updated : session
              )
            );
          } catch (error) {
            console.error("[ChatWidget] Failed to update chat title", error);
          }
        }
      }

      const userMessage: MessageType = {
        key: `user-${Date.now()}`,
        from: "user",
        content,
      };

      setMessages((prev) => [...prev, userMessage]);
      try {
        await createChatMessage(sessionId, {
          role: "user",
          content,
        });
      } catch (error) {
        console.error("[ChatWidget] Failed to save user message", error);
      }

      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: MessageType = {
        key: assistantMessageId,
        from: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStatus("streaming");

      const enqueueStreamingText = (nextChunk: string) => {
        if (!nextChunk) {
          return;
        }
        streamingQueueRef.current.push(...nextChunk.split(""));
        if (streamingIntervalRef.current) {
          return;
        }
        streamingIntervalRef.current = window.setInterval(() => {
          const nextChar = streamingQueueRef.current.shift();
          if (!nextChar) {
            if (streamingIntervalRef.current) {
              window.clearInterval(streamingIntervalRef.current);
            }
            streamingIntervalRef.current = null;
            return;
          }
          streamingTextRef.current += nextChar;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.key === assistantMessageId
                ? { ...msg, content: streamingTextRef.current }
                : msg
            )
          );
        }, 18);
      };

      const controller = new AbortController();
      streamAbortControllerRef.current = controller;

      try {
        const response = await fetch("/api/chat?stream=true", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          signal: controller.signal,
          body: JSON.stringify({
            messages: messagesRef.current.map((msg) => ({
              role: msg.from,
              content: msg.content,
            })),
            model: modelRef.current,
            reportId: selectedReportIdRef.current ?? undefined,
            language,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch response");
        }

        let finalAssistantText = "";
        let finalAssistantTokens: number | null = null;
        streamingTextRef.current = "";
        streamingQueueRef.current = [];

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            if (controller.signal?.aborted) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const chunks = buffer.split("\n\n");
            buffer = chunks.pop() || "";

            for (const chunk of chunks) {
              const line = chunk.trim();
              if (!line.startsWith("data:")) {
                continue;
              }
              const payload = line.replace("data:", "").trim();
              if (payload === "[DONE]") {
                buffer = "";
                break;
              }
              try {
                const parsed = JSON.parse(payload) as {
                  text?: string;
                  usage?: { totalTokens?: number };
                };
                if (parsed.text) {
                  finalAssistantText += parsed.text;
                  enqueueStreamingText(parsed.text);
                }
                if (
                  parsed.usage &&
                  typeof parsed.usage.totalTokens === "number" &&
                  Number.isFinite(parsed.usage.totalTokens)
                ) {
                  finalAssistantTokens = parsed.usage.totalTokens;
                }
              } catch {
                // ignore malformed chunks
              }
            }
          }
        } else {
          const data = (await response.json()) as { response: string };
          finalAssistantText = data.response;
          enqueueStreamingText(data.response);
        }

        if (streamingIntervalRef.current) {
          await new Promise<void>((resolve) => {
            const timer = window.setInterval(() => {
              if (!streamingIntervalRef.current && streamingQueueRef.current.length === 0) {
                window.clearInterval(timer);
                resolve();
              }
            }, 20);
          });
        }

        const textToSave =
          controller.signal?.aborted ? streamingTextRef.current : finalAssistantText;
        if (textToSave) {
          try {
            await createChatMessage(sessionId, {
              role: "assistant",
              content: textToSave,
              token_count: finalAssistantTokens ?? undefined,
            });
          } catch (error) {
            console.error("[ChatWidget] Failed to save assistant message", error);
          }
        }
      } catch (error) {
        const isAbortError =
          error instanceof Error && error.name === "AbortError";
        if (isAbortError) {
          clearStreamingState();
          const partialText = streamingTextRef.current;
          if (partialText) {
            try {
              await createChatMessage(sessionId, {
                role: "assistant",
                content: partialText,
              });
            } catch (saveError) {
              console.error("[ChatWidget] Failed to save partial message", saveError);
            }
          }
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.key === assistantMessageId
                ? {
                    ...msg,
                    content: t("chat.error.response"),
                  }
                : msg
            )
          );
          setStatus("error");
        }
        streamAbortControllerRef.current = null;
        return;
      }

      streamAbortControllerRef.current = null;
      setStatus("ready");
    },
    [activeSessionId, clearStreamingState]
  );

  const handleStopStreaming = useCallback(() => {
    streamAbortControllerRef.current?.abort();
    clearStreamingState();
    setStatus("ready");
  }, [clearStreamingState]);

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    setStatus("submitted");

    void addUserMessage(message.text || t("chat.input.attachments"));
    setText("");
  };

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isMobile) {
      return;
    }
    event.preventDefault();
    setGlobalResizeCursor(true);
    resizeStateRef.current = {
      active: true,
      startX: event.clientX,
      startWidth: panelWidth,
    };
  };

  const handleCopyAssistantMessage = useCallback(
    async (messageKey: string, textToCopy: string) => {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopiedMessageKey(messageKey);
        window.setTimeout(() => setCopiedMessageKey(null), 1200);
      } catch (error) {
        console.error("[ChatWidget] Failed to copy message", error);
      }
    },
    []
  );

  if (!isOpen) {
    return null;
  }

  const desktopPanelStyle = {
    width: panelWidth,
    minWidth: PANEL_MIN_WIDTH,
    maxWidth: PANEL_MAX_WIDTH,
    flexShrink: 0,
  };

  return (
    <div
      className={cn(
        "relative z-50 flex min-h-0 flex-col bg-background self-stretch",
        isMobile
          ? "fixed inset-0 shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-y-auto"
          : "border-l shadow-[0_20px_60px_rgba(0,0,0,0.4)]",
        className
      )}
      style={
        isMobile
          ? { width: "100vw", height: "100dvh" }
          : { ...desktopPanelStyle }
      }
      role="complementary"
      aria-label={t("chat.open")}
    >
      {!isMobile && (
        <div
          className="absolute left-[-3px] top-0 h-full w-3 cursor-col-resize touch-none"
          onPointerDown={handleResizeStart}
          role="separator"
          aria-label="Resize chat panel"
        />
      )}

      <div className="sticky top-0 z-10 flex flex-col gap-2 bg-background/95 px-4 py-3 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="scrollbar-subtle flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 text-xs text-muted-foreground">
            {(
              hasTemporaryChat
                ? ([
                    { id: TEMP_SESSION_ID, title: t("chat.newTitle"), isTemp: true },
                    ...recentSessionIds
                      .map((sessionId) => sessions.find((session) => session.id === sessionId))
                      .filter((session): session is ChatSession => Boolean(session)),
                  ] as Array<ChatSession & { isTemp?: boolean }>)
                : recentSessionIds
                    .map((sessionId) => sessions.find((session) => session.id === sessionId))
                    .filter((session): session is ChatSession => Boolean(session))
            ).map((session) => (
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition",
                  session.id === activeSessionId
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-transparent bg-background/60 text-muted-foreground hover:text-foreground"
                )}
                key={session.id}
                onClick={() => {
                  if (session.id === TEMP_SESSION_ID) {
                    setHasTemporaryChat(true);
                    setActiveSessionId(null);
                    setMessages([]);
                    setSelectedReportId(null);
                    return;
                  }
                  void handleSelectSession(session.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (session.id === TEMP_SESSION_ID) {
                      setHasTemporaryChat(true);
                      setActiveSessionId(null);
                      setMessages([]);
                      setSelectedReportId(null);
                      return;
                    }
                    void handleSelectSession(session.id);
                  }
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (session.id !== TEMP_SESSION_ID) {
                    startEditingSession(session);
                  }
                }}
              >
                <span className="flex items-center gap-2">
                  {editingSessionId === session.id ? (
                    <input
                      autoFocus
                      className="w-full min-w-[140px] bg-transparent text-xs text-foreground outline-none"
                      onBlur={() => saveEditingSession(session.id)}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void saveEditingSession(session.id);
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelEditingSession();
                        }
                      }}
                      value={editingTitle}
                    />
                  ) : (
                    <span className="max-w-[220px] truncate">
                      {session.title || t("chat.untitled")}
                    </span>
                  )}
                  {editingSessionId !== session.id && session.id !== TEMP_SESSION_ID && (
                    <button
                      className="text-muted-foreground transition hover:text-foreground"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleCloseRecentSession(session.id);
                      }}
                      type="button"
                    >
                      <XIcon className="size-3" />
                      <span className="sr-only">Close tab</span>
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Select
              disabled={loadingSessions}
              onValueChange={handleSelectSession}
              value={activeSessionId ?? undefined}
            >
              <SelectTrigger className="h-7 w-9 justify-center gap-0 px-0 text-xs [&>svg:last-child]:hidden [&>span]:hidden">
                <HistoryIcon className="size-4" />
                <SelectValue
                  className="hidden"
                  placeholder={t("chat.sessionPlaceholder")}
                />
                <span className="sr-only">{t("chat.sessionPlaceholder")}</span>
              </SelectTrigger>
              <SelectContent className="min-w-[260px]">
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    <span className="block max-w-[220px] truncate">
                      {session.title || t("chat.untitled")}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
              onClick={handleNewChat}
              type="button"
            >
              <PlusIcon className="size-4" />
              <span className="sr-only">{t("chat.new")}</span>
            </button>
            <button
              className="rounded-full p-1 text-muted-foreground transition hover:text-foreground"
              onClick={() => {
                setIsOpen(false);
                setReportChatBadge(false);
                autoOpenedRef.current = false;
              }}
              type="button"
            >
              <XIcon className="size-4" />
              <span className="sr-only">{t("chat.close")}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <Conversation className="scrollbar-subtle overflow-x-hidden overflow-y-auto flex-1 min-h-0">
          <ConversationContent>
            {messages.map((message) => (
              <MessageBranch defaultBranch={0} key={message.key}>
                <MessageBranchContent>
                  <Message from={message.from} key={message.key}>
                    <div>
                      {message.sources?.length && (
                        <Sources>
                          <SourcesTrigger count={message.sources.length} />
                          <SourcesContent>
                            {message.sources.map((source) => (
                              <Source
                                href={source.href}
                                key={source.href}
                                title={source.title}
                              />
                            ))}
                          </SourcesContent>
                        </Sources>
                      )}
                      {message.reasoning && (
                        <Reasoning duration={message.reasoning.duration}>
                          <ReasoningTrigger />
                          <ReasoningContent>
                            {message.reasoning.content}
                          </ReasoningContent>
                        </Reasoning>
                      )}
                      <MessageContent>
                        {message.from === "assistant" ? (
                          <div className="relative rounded-xl border border-border/60 bg-muted/20 px-4 py-3 shadow-sm">
                            <button
                              className={cn(
                                "absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition hover:text-foreground",
                                "hover:bg-muted/40"
                              )}
                              onClick={() =>
                                void handleCopyAssistantMessage(
                                  message.key,
                                  message.content
                                )
                              }
                              type="button"
                              aria-label={t("chat.message.copy")}
                              title={t("chat.message.copy")}
                            >
                              {copiedMessageKey === message.key ? (
                                <CheckIcon className="h-4 w-4" />
                              ) : (
                                <CopyIcon className="h-4 w-4" />
                              )}
                            </button>
                            <div className="whitespace-pre-wrap break-words pr-6">
                              {message.content}
                            </div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words">
                            {message.content}
                          </div>
                        )}
                      </MessageContent>
                    </div>
                  </Message>
                </MessageBranchContent>
                <MessageBranchSelector from={message.from}>
                  <MessageBranchPrevious />
                  <MessageBranchPage />
                  <MessageBranchNext />
                </MessageBranchSelector>
              </MessageBranch>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="w-full px-4 pb-4 pt-3 border-t-0">
          <PromptInput globalDrop multiple onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputAttachmentsDisplay />
              <div className="w-full">
                <PromptInputTextarea
                  className="w-full min-h-[44px] max-h-[240px] overflow-y-auto py-2 text-base leading-6"
                  onChange={(event) => {
                    autoResizeTextarea(event.currentTarget);
                    setText(event.target.value);
                  }}
                  style={{ height: `${TEXTAREA_MIN_HEIGHT}px`, overflowY: "hidden" }}
                  placeholder={t("chat.input.placeholder")}
                  value={text}
                />
              </div>
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools className="flex flex-wrap items-center gap-2">
                <div className="hidden">
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger disabled />
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                  <PromptInputButton disabled variant="ghost">
                    <MicIcon size={16} />
                    <span className="sr-only">Microphone</span>
                  </PromptInputButton>
                  <PromptInputButton disabled variant="ghost">
                    <GlobeIcon size={16} />
                    <span>Search</span>
                  </PromptInputButton>
                </div>
                <div className="flex w-full flex-nowrap items-center gap-2 sm:flex-wrap">
                  <div className="flex-1 min-w-0 sm:flex-none">
                    <Select onValueChange={setModel} value={model}>
                      <SelectTrigger className="h-8 w-full text-xs sm:w-[96px]">
                        <SelectValue placeholder={t("chat.model.placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((modelItem) => (
                          <SelectItem key={modelItem.id} value={modelItem.id}>
                            {modelItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-0 sm:flex-none">
                    <Select
                      onValueChange={(value) =>
                        setSelectedReportId(value === "none" ? null : value)
                      }
                      value={selectedReportId ?? "none"}
                    >
                      <SelectTrigger className="h-8 w-full text-xs sm:w-[150px]">
                        <SelectValue placeholder={t("chat.report.placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value="none"
                          className="text-xs sm:text-sm"
                        >
                          {t("chat.report.none")}
                        </SelectItem>
                        {reports.map((report) => (
                          <SelectItem
                            key={report.report_id}
                            value={report.report_id}
                            className="text-xs sm:text-sm"
                          >
                            <span className="block max-w-[140px] truncate sm:max-w-[260px]">
                              {report.report_title || t("chat.untitled")}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PromptInputTools>
              <PromptInputSubmit
                disabled={status === "ready" && !text.trim()}
                status={status}
                onStop={handleStopStreaming}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

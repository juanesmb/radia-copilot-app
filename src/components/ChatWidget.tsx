"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  GlobeIcon,
  HistoryIcon,
  MessageCircleIcon,
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
  MessageResponse,
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
  PromptInputHeader,
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

const DEFAULT_PANEL_POSITION = { x: 0, y: 0 };
const DEFAULT_BUBBLE_POSITION: { x: number | null; y: number | null } = {
  x: null,
  y: null,
};
const DRAG_OFFSET = 16;
const DRAG_THRESHOLD = 4;
const PANEL_WIDTH = 580;
const PANEL_HEIGHT = 680;
const BUBBLE_SIZE = 56;
const BUBBLE_DEFAULT_LEFT = 88;
const BUBBLE_DEFAULT_BOTTOM = 24;
const MOBILE_BREAKPOINT = 640;
const TEMP_SESSION_ID = "temp-chat";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

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

export function ChatWidget() {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState(DEFAULT_PANEL_POSITION);
  const [bubblePosition, setBubblePosition] = useState(DEFAULT_BUBBLE_POSITION);
  const [draggingPanel, setDraggingPanel] = useState(false);
  const [draggingBubble, setDraggingBubble] = useState(false);
  const draggingBubbleRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const bubbleMovedRef = useRef(false);
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
  const [text, setText] = useState<string>("");
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");
  const [messages, setMessages] = useState<MessageType[]>([]);
  const messagesRef = useRef<MessageType[]>([]);

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
      const detail = (event as CustomEvent).detail as
        | { sessionId: string; reportId: string }
        | undefined;
      if (!detail) {
        return;
      }
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
      setIsOpen(true);
    };

    window.addEventListener("report-chat-created", handleReportChatCreated);
    return () => {
      window.removeEventListener("report-chat-created", handleReportChatCreated);
    };
  }, []);

  useEffect(() => {
    const handleReportChatOpen = async (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { sessionId: string; reportId: string }
        | undefined;
      if (!detail) {
        return;
      }
      setSelectedReportId(detail.reportId);
      try {
        const sessionData = await getChatSessions();
        setSessions(sessionData);
        const history = await getChatMessages(detail.sessionId);
        setMessages(history.map(mapStoredMessage));
      } catch (error) {
        console.error("[ChatWidget] Failed to load report chat", error);
      }
      setActiveSessionId(detail.sessionId);
      setIsOpen(true);
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
        if (!prev && next) {
          positionPanelNearBubble();
        }
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
          const preferredSessionId =
            activeSessionId && sessionData.some((session) => session.id === activeSessionId)
              ? activeSessionId
              : sessionData[0].id;
          setActiveSessionId(preferredSessionId);
          const history = await getChatMessages(preferredSessionId);
          setMessages(history.map(mapStoredMessage));
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

  const positionPanelNearBubble = useCallback(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const bubbleX = bubblePosition.x ?? BUBBLE_DEFAULT_LEFT;
    const bubbleY =
      bubblePosition.y ?? viewportHeight - BUBBLE_DEFAULT_BOTTOM - BUBBLE_SIZE;

    const targetX = clamp(
      bubbleX - PANEL_WIDTH + 56,
      DRAG_OFFSET,
      viewportWidth - PANEL_WIDTH - DRAG_OFFSET
    );
    const targetY = clamp(
      bubbleY - PANEL_HEIGHT - 12,
      DRAG_OFFSET,
      viewportHeight - PANEL_HEIGHT - DRAG_OFFSET
    );

    setPanelPosition({ x: targetX, y: targetY });
  }, [bubblePosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    positionPanelNearBubble();
  }, [isOpen, positionPanelNearBubble]);

  useEffect(() => {
    if (!draggingPanel) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      setPanelPosition({
        x: event.clientX - dragOffsetRef.current.x,
        y: event.clientY - dragOffsetRef.current.y,
      });
    };

    const handlePointerUp = () => {
      setDraggingPanel(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingPanel]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!draggingBubbleRef.current) {
        return;
      }
      const next = {
        x: event.clientX - dragOffsetRef.current.x,
        y: event.clientY - dragOffsetRef.current.y,
      };
      setBubblePosition(next);
      const deltaX = event.clientX - dragStartRef.current.x;
      const deltaY = event.clientY - dragStartRef.current.y;
      if (Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD) {
        bubbleMovedRef.current = true;
      }
    };

    const handlePointerUp = () => {
      if (!draggingBubbleRef.current) {
        return;
      }
      draggingBubbleRef.current = false;
      setDraggingBubble(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

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

      try {
        const response = await fetch("/api/chat?stream=true", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            messages: [...messagesRef.current, userMessage].map((msg) => ({
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
                const parsed = JSON.parse(payload) as { text?: string };
                if (parsed.text) {
                  finalAssistantText += parsed.text;
                  enqueueStreamingText(parsed.text);
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

        if (finalAssistantText) {
          try {
            await createChatMessage(sessionId, {
              role: "assistant",
              content: finalAssistantText,
            });
          } catch (error) {
            console.error("[ChatWidget] Failed to save assistant message", error);
          }
        }
      } catch (error) {
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
        return;
      }

      setStatus("ready");
    },
    [activeSessionId]
  );

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

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isMobile) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    setDraggingPanel(true);
  };

  const handleBubblePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (isOpen) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    bubbleMovedRef.current = false;
    draggingBubbleRef.current = true;
    setDraggingBubble(true);
  };

  const handleBubbleClick = () => {
    if (bubbleMovedRef.current) {
      bubbleMovedRef.current = false;
      return;
    }
    setIsOpen((prev) => {
      const next = !prev;
      if (!prev && next) {
        positionPanelNearBubble();
        setReportChatBadge(false);
      }
      if (prev && !next && autoOpenedRef.current) {
        setReportChatBadge(false);
        autoOpenedRef.current = false;
      }
      return next;
    });
  };

  return (
    <>
      <button
        className={cn(
          "fixed z-50 flex size-14 items-center justify-center rounded-full",
          "bg-gradient-to-br from-white via-slate-200 to-slate-400 text-slate-900",
          "shadow-[0_12px_30px_rgba(0,0,0,0.35)] ring-2 ring-white/70",
          "transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        )}
        onClick={handleBubbleClick}
        onPointerDown={handleBubblePointerDown}
        style={{
          left: bubblePosition.x ?? BUBBLE_DEFAULT_LEFT,
          top: bubblePosition.y ?? undefined,
          right: undefined,
          bottom: bubblePosition.y == null ? BUBBLE_DEFAULT_BOTTOM : undefined,
        }}
        type="button"
      >
        <MessageCircleIcon className="size-6" />
        {reportChatBadge && (
          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-semibold text-white shadow ring-2 ring-white">
            1
          </span>
        )}
        <span className="sr-only">{t("chat.open")}</span>
      </button>

      {isOpen && (
        <div
          className={cn(
            "fixed z-50 flex flex-col rounded-2xl border",
            "bg-background shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
          )}
          style={
            isMobile
              ? {
                  left: 0,
                  top: 0,
                  width: "100vw",
                  height: "100vh",
                  borderRadius: 0,
                  resize: "none",
                  overflow: "hidden",
                }
              : {
                  left: panelPosition.x,
                  top: panelPosition.y,
                  width: PANEL_WIDTH,
                  height: PANEL_HEIGHT,
                  resize: "both",
                  overflow: "hidden",
                  minWidth: 340,
                  minHeight: 420,
                }
          }
        >
          <div
            className="flex flex-col gap-2 border-b bg-muted/50 px-4 py-3"
            onPointerDown={handleDragStart}
          >
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
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  <XIcon className="size-4" />
                  <span className="sr-only">{t("chat.close")}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col divide-y">
            <Conversation className="scrollbar-subtle overflow-x-hidden overflow-y-auto">
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
                            <MessageResponse>{message.content}</MessageResponse>
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

            <div className="w-full px-4 pb-4 pt-3">
              <PromptInput globalDrop multiple onSubmit={handleSubmit}>
                <PromptInputHeader>
                  <PromptInputAttachmentsDisplay />
                </PromptInputHeader>
                <PromptInputBody>
                  <PromptInputTextarea
                    className="min-h-8 max-h-[280px] overflow-y-auto"
                    onChange={(event) => {
                      const textarea = event.currentTarget;
                      textarea.style.height = "auto";
                      textarea.style.height = `${textarea.scrollHeight}px`;
                      setText(event.target.value);
                    }}
                    placeholder={t("chat.input.placeholder")}
                    value={text}
                  />
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
                          <SelectTrigger className="h-8 w-full text-xs sm:w-[180px]">
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
                    disabled={!(text.trim() || status) || status === "streaming"}
                    status={status}
                  />
                </PromptInputFooter>
              </PromptInput>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

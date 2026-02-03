import type {
  ApiError,
  GenerateReportRequest,
  GenerateReportResponse,
} from "@/types/frontend/api";

const API_PATH = "/api/generate-report";
const REPORTS_PATH = "/api/reports";

export interface Report {
  report_id: string;
  user_id: string;
  generated_transcription: string;
  updated_transcription: string;
  report_title: string | null;
  generated_report: string;
  updated_report: string;
  used_template: string;
  template_id?: string | null;
  template_content?: string | null;
  is_custom_template?: boolean | null;
  study_type: string | null;
  detection_confidence: number | null;
  model_used: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string | null;
  model: string;
  report_id?: string | null;
  message_count: number | null;
  token_count: number | null;
  max_tokens: number | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  token_count: number | null;
  created_at: string;
}

export interface CreateChatSessionRequest {
  title?: string;
  model: string;
  max_tokens?: number | null;
}

export interface UpdateReportRequest {
  report_title?: string;
  updated_report?: string;
  updated_transcription?: string;
  used_template?: string;
  template_id?: string | null;
  study_type?: string | null;
  template_content?: string | null;
  is_custom_template?: boolean | null;
}

export interface CreateReportRequest {
  report_title?: string | null;
  language: string;
  is_custom_template?: boolean | null;
}

export async function generateReport(
  payload: GenerateReportRequest,
): Promise<GenerateReportResponse> {
  try {
    const response = await fetch(API_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Unexpected server error",
        status: response.status,
        details: details?.details,
      };
    }

    const data = (await response.json()) as GenerateReportResponse;
    return data;
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

// Create custom template
const CREATE_CUSTOM_TEMPLATE_PATH = "/api/templates/custom";

export async function createCustomTemplate(payload: {
  studyType: string;
  language: "en" | "es";
  content: string;
}): Promise<{ templateId: string; studyType: string; language: string }> {
  try {
    const response = await fetch(CREATE_CUSTOM_TEMPLATE_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to create custom template",
        status: response.status,
        details: details?.details,
      };
    }

    return (await response.json()) as { templateId: string; studyType: string; language: string };
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

// Update custom template
export async function updateCustomTemplate(
  templateId: string,
  payload: { content: string }
): Promise<{ ok: true }> {
  try {
    const response = await fetch(`${CREATE_CUSTOM_TEMPLATE_PATH}/${templateId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to update custom template",
        status: response.status,
        details: details?.details,
      };
    }

    return { ok: true };
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

// Set template preference
const SET_TEMPLATE_PREFERENCE_PATH = "/api/templates/preference";

export async function setTemplatePreference(payload: {
  studyType: string;
  language: "en" | "es";
  useDefault: boolean;
}): Promise<{ ok: true }> {
  try {
    const response = await fetch(SET_TEMPLATE_PREFERENCE_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to set template preference",
        status: response.status,
        details: details?.details,
      };
    }

    return { ok: true };
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

export async function createReportChatSession(payload: {
  reportId: string;
  title: string;
  model: string;
  initialPrompt?: string;
}): Promise<{ sessionId: string }> {
  try {
    const response = await fetch("/api/chat/report-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to create report chat",
        status: response.status,
        details: details?.details,
      };
    }

    return (await response.json()) as { sessionId: string };
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

export async function updateChatSession(
  sessionId: string,
  updates: Partial<CreateChatSessionRequest>
): Promise<ChatSession> {
  try {
    const response = await fetch(`/api/chats/${sessionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to update chat session",
        status: response.status,
        details: details?.details,
      };
    }

    const data = (await response.json()) as ChatSession;
    return data;
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

export async function getChatSessions(): Promise<ChatSession[]> {
  try {
    const response = await fetch("/api/chats", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to fetch chat sessions",
        status: response.status,
        details: details?.details,
      };
    }

    const data = (await response.json()) as ChatSession[];
    return data;
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

export async function createChatSession(
  payload: CreateChatSessionRequest
): Promise<ChatSession> {
  try {
    const response = await fetch("/api/chats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to create chat session",
        status: response.status,
        details: details?.details,
      };
    }

    const data = (await response.json()) as ChatSession;
    return data;
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  try {
    const response = await fetch(`/api/chats/${sessionId}/messages`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to fetch chat messages",
        status: response.status,
        details: details?.details,
      };
    }

    const data = (await response.json()) as ChatMessage[];
    return data;
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

export async function createChatMessage(
  sessionId: string,
  payload: Pick<ChatMessage, "role" | "content"> & { token_count?: number | null }
): Promise<ChatMessage> {
  try {
    const response = await fetch(`/api/chats/${sessionId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to create chat message",
        status: response.status,
        details: details?.details,
      };
    }

    const data = (await response.json()) as ChatMessage;
    return data;
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

export async function getReports(): Promise<Report[]> {
  try {
    const response = await fetch(REPORTS_PATH, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Unexpected server error",
        status: response.status,
        details: details?.details,
      };
    }

    const data = (await response.json()) as Report[];
    return data;
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

export async function updateReport(
  reportId: string,
  updates: UpdateReportRequest,
): Promise<Report> {
  try {
    const response = await fetch(`${REPORTS_PATH}/${reportId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Unexpected server error",
        status: response.status,
        details: details?.details,
      };
    }

    const data = (await response.json()) as Report;
    return data;
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

export async function createDraftReport(payload: CreateReportRequest): Promise<Report> {
  try {
    const response = await fetch(REPORTS_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Unexpected server error",
        status: response.status,
        details: details?.details,
      };
    }

    const data = (await response.json()) as Report;
    return data;
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

async function safeParse<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

// Study type detection
const DETECT_STUDY_TYPE_PATH = "/api/detect-study-type";

export interface DetectStudyTypeRequest {
  transcription: string;
  language: "en" | "es";
}

export interface DetectStudyTypeResponse {
  studyType: string;
  confidence: number;
  reasoning?: string;
  keywords?: string[];
  availableTemplates: string[];
}

export async function detectStudyType(
  payload: DetectStudyTypeRequest
): Promise<DetectStudyTypeResponse> {
  try {
    const response = await fetch(DETECT_STUDY_TYPE_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to detect study type",
        status: response.status,
        details: details?.details,
      };
    }

    const data = (await response.json()) as DetectStudyTypeResponse;
    return data;
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

// Get available templates
const GET_TEMPLATES_PATH = "/api/templates";

export interface GetTemplatesRequest {
  language: "en" | "es";
}

export interface GetTemplatesResponse {
  templates: string[];
}

export async function getAvailableTemplates(
  payload: GetTemplatesRequest
): Promise<GetTemplatesResponse> {
  try {
    const response = await fetch(GET_TEMPLATES_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to get templates",
        status: response.status,
        details: details?.details,
      };
    }

    const data = (await response.json()) as GetTemplatesResponse;
    return data;
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

// Get template content
const GET_TEMPLATE_CONTENT_PATH = "/api/templates";

import type { GetTemplateContentRequest, GetTemplateContentResponse } from "@/app/api/types/template";

export async function getTemplateContent(
  payload: GetTemplateContentRequest
): Promise<GetTemplateContentResponse> {
  try {
    const response = await fetch(`${GET_TEMPLATE_CONTENT_PATH}/${payload.studyType}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ language: payload.language, useDefault: payload.useDefault }),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to get template content",
        status: response.status,
        details: details?.details,
      };
    }

    const data = (await response.json()) as GetTemplateContentResponse;
    return data;
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

// Generate report with streaming
export interface GenerateReportStreamCallbacks {
  onChunk: (chunk: string) => void;
  onMetadata: (metadata: {
    reportId: string;
    title: string;
    studyType?: string;
    detectionConfidence?: number;
    modelUsed: string;
    selectedTemplate: string;
    templateId?: string;
  }) => void;
  onComplete: (reportId: string) => void;
  onError: (error: Error) => void;
}

export async function generateReportStream(
  payload: GenerateReportRequest,
  callbacks: GenerateReportStreamCallbacks
): Promise<void> {
  try {
    const response = await fetch(`${API_PATH}?stream=true`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to start stream",
        status: response.status,
        details: details?.details,
      };
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case "chunk":
                  callbacks.onChunk(data.content);
                  break;
                case "metadata":
                  callbacks.onMetadata({
                    reportId: data.reportId,
                    title: data.title,
                    studyType: data.studyType,
                    detectionConfidence: data.detectionConfidence,
                    modelUsed: data.modelUsed,
                    selectedTemplate: data.selectedTemplate,
                    templateId: data.templateId,
                  });
                  break;
                case "done":
                  callbacks.onComplete(data.reportId);
                  break;
                case "error":
                  callbacks.onError(new Error(data.message || "Stream error"));
                  break;
              }
            } catch (parseError) {
              console.error("Failed to parse SSE data:", parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof Error && "message" in error) {
      callbacks.onError(error as Error);
    } else {
      callbacks.onError(
        new Error("Network error", {
          cause: error instanceof Error ? error : undefined,
        })
      );
    }
  }
}

// Submit feedback
const FEEDBACK_PATH = "/api/feedback";

export interface SubmitFeedbackRequest {
  reportId: string;
  confidence: number;
  reason?: string | null;
}

export interface SubmitFeedbackResponse {
  id: string;
  reportId: string;
  confidence: number;
  reason: string | null;
  createdAt: string;
}

export async function submitFeedback(
  payload: SubmitFeedbackRequest
): Promise<SubmitFeedbackResponse> {
  try {
    const response = await fetch(FEEDBACK_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to submit feedback",
        status: response.status,
        details: details?.details,
      };
    }

    const data = (await response.json()) as SubmitFeedbackResponse;
    return data;
  } catch (error) {
    if ((error as ApiError)?.message) {
      throw error;
    }
    throw <ApiError>{
      message: "Network error",
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

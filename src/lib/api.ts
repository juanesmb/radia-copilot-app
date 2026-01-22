import type {
  ApiError,
  GenerateReportRequest,
  GenerateReportResponse,
} from "@/types/frontend/api";

const API_PATH = "/api/generate-report";
const REPORTS_PATH = "/api/reports";
const BILLING_PLANS_PATH = "/api/billing/plans";
const BILLING_SUBSCRIPTION_PATH = "/api/billing/subscription";
const BILLING_CHECKOUT_PATH = "/api/billing/checkout";
const BILLING_PORTAL_PATH = "/api/billing/portal";

export interface Report {
  report_id: string;
  user_id: string;
  generated_transcription: string;
  updated_transcription: string;
  report_title: string | null;
  generated_report: string;
  updated_report: string;
  used_template: string;
  template_content?: string | null;
  study_type: string | null;
  detection_confidence: number | null;
  model_used: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface BillingPlan {
  key: string;
  label: string;
  description: string;
  productId: string;
  priceId: string;
  amount: number | null;
  currency: string | null;
  interval: string;
}

export interface BillingPlansResponse {
  plans: BillingPlan[];
}

export interface BillingSubscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  plan_key: string | null;
  plan_name: string | null;
  status: string;
  amount_total: number | null;
  currency: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  latest_invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingSubscriptionResponse {
  payment: BillingSubscription | null;
}

export interface BillingCheckoutResponse {
  url: string;
}

export async function getBillingPlans(): Promise<BillingPlansResponse> {
  try {
    const response = await fetch(BILLING_PLANS_PATH, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to load billing plans",
        status: response.status,
        details: details?.details,
      };
    }

    return (await response.json()) as BillingPlansResponse;
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

export async function getBillingSubscription(): Promise<BillingSubscriptionResponse> {
  try {
    const response = await fetch(BILLING_SUBSCRIPTION_PATH, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to load subscription",
        status: response.status,
        details: details?.details,
      };
    }

    return (await response.json()) as BillingSubscriptionResponse;
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

export async function createCheckoutSession(planKey: string): Promise<BillingCheckoutResponse> {
  try {
    const response = await fetch(BILLING_CHECKOUT_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ planKey }),
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to start checkout",
        status: response.status,
        details: details?.details,
      };
    }

    return (await response.json()) as BillingCheckoutResponse;
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

export async function createBillingPortalSession(): Promise<BillingCheckoutResponse> {
  try {
    const response = await fetch(BILLING_PORTAL_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const details = await safeParse<ApiError>(response);
      throw <ApiError>{
        message: details?.message ?? "Failed to open billing portal",
        status: response.status,
        details: details?.details,
      };
    }

    return (await response.json()) as BillingCheckoutResponse;
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

export interface UpdateReportRequest {
  report_title?: string;
  updated_report?: string;
  updated_transcription?: string;
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
      body: JSON.stringify({ language: payload.language }),
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

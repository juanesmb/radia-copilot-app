import type {
  ApiError,
  GenerateReportRequest,
  GenerateReportResponse,
} from "@/types/frontend/api";
import type {
  GetTemplateContentRequest,
  GetTemplateContentResponse,
} from "@/app/api/types/template";

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
  study_type: string | null;
  detection_confidence: number | null;
  model_used: string;
  language: string;
  created_at: string;
  updated_at: string;
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
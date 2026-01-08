import type { SupabaseClient } from "@supabase/supabase-js";

import { HttpError } from "../lib/errorHandler";

export interface FeedbackData {
  user_id: string;
  report_id: string;
  confidence: number;
  reason: string | null;
}

export interface Feedback {
  id: string;
  user_id: string;
  report_id: string;
  confidence: number;
  reason: string | null;
  created_at: string;
}

export interface FeedbackRepository {
  createFeedback(data: FeedbackData): Promise<Feedback>;
  getFeedbackByReportId(reportId: string, userId: string): Promise<Feedback | null>;
}

type Dependencies = {
  supabaseClient: SupabaseClient;
};

export const createFeedbackRepository = (deps: Dependencies): FeedbackRepository => {
  const { supabaseClient } = deps;

  return {
    async createFeedback(data: FeedbackData): Promise<Feedback> {
      try {
        const { data: feedback, error } = await supabaseClient
          .from("report_feedback")
          .insert(data)
          .select()
          .single();

        if (error) {
          throw new HttpError(`Failed to create feedback: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        if (!feedback) {
          throw new HttpError("Failed to create feedback: No data returned", {
            status: 500,
          });
        }

        return feedback;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to create feedback", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },

    async getFeedbackByReportId(reportId: string, userId: string): Promise<Feedback | null> {
      try {
        const { data: feedback, error } = await supabaseClient
          .from("report_feedback")
          .select("*")
          .eq("report_id", reportId)
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          throw new HttpError(`Failed to fetch feedback: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        return feedback;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to fetch feedback", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
};


import type { SupabaseClient } from "@supabase/supabase-js";

import { HttpError } from "../lib/errorHandler";

export interface ReportData {
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
}

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

export interface UpdateReportData {
  report_title?: string;
  updated_report?: string;
  updated_transcription?: string;
}

export interface ReportRepository {
  createReport(data: ReportData): Promise<Report>;
  updateReport(reportId: string, userId: string, updates: UpdateReportData): Promise<Report>;
  getUserReports(userId: string): Promise<Report[]>;
}

type Dependencies = {
  supabaseClient: SupabaseClient;
};

export const createReportRepository = (deps: Dependencies): ReportRepository => {
  const { supabaseClient } = deps;

  return {
    async createReport(data: ReportData): Promise<Report> {
      try {
        const { data: report, error } = await supabaseClient
          .from("reports")
          .insert(data)
          .select()
          .single();

        if (error) {
          throw new HttpError(`Failed to create report: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        if (!report) {
          throw new HttpError("Failed to create report: No data returned", {
            status: 500,
          });
        }

        return report as Report;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to create report", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },

    async updateReport(
      reportId: string,
      userId: string,
      updates: UpdateReportData
    ): Promise<Report> {
      try {
        const { data: existingReport, error: fetchError } = await supabaseClient
          .from("reports")
          .select("user_id")
          .eq("report_id", reportId)
          .single();

        if (fetchError || !existingReport) {
          throw new HttpError("Report not found", {
            status: 404,
          });
        }

        if (existingReport.user_id !== userId) {
          throw new HttpError("Unauthorized: You do not own this report", {
            status: 403,
          });
        }

        const { data: report, error } = await supabaseClient
          .from("reports")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("report_id", reportId)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) {
          throw new HttpError(`Failed to update report: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        if (!report) {
          throw new HttpError("Failed to update report: No data returned", {
            status: 500,
          });
        }

        return report as Report;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to update report", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },

    async getUserReports(userId: string): Promise<Report[]> {
      try {
        const { data: reports, error } = await supabaseClient
          .from("reports")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) {
          throw new HttpError(`Failed to fetch reports: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        return (reports || []) as Report[];
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to fetch reports", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },

  };
};


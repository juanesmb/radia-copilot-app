import type { SupabaseClient } from "@supabase/supabase-js";

import { HttpError } from "../lib/errorHandler";
import { getMonthPeriodStart } from "../lib/period";

export interface UserMonthlyUsage {
  id: string;
  user_id: string;
  period_start: string;
  report_count: number;
  chat_token_count: number;
  created_at: string;
  updated_at: string;
}

export interface UserMonthlyUsageRepository {
  getOrCreate(userId: string, periodStart?: string): Promise<UserMonthlyUsage>;
  incrementReportCount(userId: string, periodStart?: string): Promise<UserMonthlyUsage>;
  addChatTokens(userId: string, tokens: number, periodStart?: string): Promise<UserMonthlyUsage>;
}

type Dependencies = {
  supabaseClient: SupabaseClient;
};

export const createUserMonthlyUsageRepository = (
  deps: Dependencies,
): UserMonthlyUsageRepository => {
  const { supabaseClient } = deps;

  const getOrCreate = async (userId: string, periodStart?: string) => {
    const effectivePeriodStart = periodStart ?? getMonthPeriodStart();

    const { data: existing, error: fetchError } = await supabaseClient
      .from("user_monthly_usage")
      .select("*")
      .eq("user_id", userId)
      .eq("period_start", effectivePeriodStart)
      .maybeSingle();

    if (fetchError) {
      throw new HttpError(`Failed to fetch usage: ${fetchError.message}`, {
        status: 500,
        details: fetchError.code,
      });
    }

    if (existing) {
      return existing as UserMonthlyUsage;
    }

    const { data: created, error: insertError } = await supabaseClient
      .from("user_monthly_usage")
      .insert({
        user_id: userId,
        period_start: effectivePeriodStart,
        report_count: 0,
        chat_token_count: 0,
      })
      .select()
      .single();

    if (insertError || !created) {
      throw new HttpError(`Failed to create usage: ${insertError?.message ?? "No data"}`, {
        status: 500,
        details: insertError?.code,
      });
    }

    return created as UserMonthlyUsage;
  };

  const incrementReportCount = async (userId: string, periodStart?: string) => {
    const usage = await getOrCreate(userId, periodStart);

    const { data: updated, error } = await supabaseClient
      .from("user_monthly_usage")
      .update({
        report_count: (usage.report_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", usage.id)
      .select()
      .single();

    if (error || !updated) {
      throw new HttpError(`Failed to update usage: ${error?.message ?? "No data"}`, {
        status: 500,
        details: error?.code,
      });
    }

    return updated as UserMonthlyUsage;
  };

  const addChatTokens = async (userId: string, tokens: number, periodStart?: string) => {
    const safeTokens = Number.isFinite(tokens) ? Math.max(0, Math.floor(tokens)) : 0;
    const usage = await getOrCreate(userId, periodStart);

    const { data: updated, error } = await supabaseClient
      .from("user_monthly_usage")
      .update({
        chat_token_count: (usage.chat_token_count ?? 0) + safeTokens,
        updated_at: new Date().toISOString(),
      })
      .eq("id", usage.id)
      .select()
      .single();

    if (error || !updated) {
      throw new HttpError(`Failed to update usage: ${error?.message ?? "No data"}`, {
        status: 500,
        details: error?.code,
      });
    }

    return updated as UserMonthlyUsage;
  };

  return {
    getOrCreate,
    incrementReportCount,
    addChatTokens,
  };
};

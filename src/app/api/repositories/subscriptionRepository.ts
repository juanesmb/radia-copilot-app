import type { SupabaseClient } from "@supabase/supabase-js";

import { HttpError } from "../lib/errorHandler";

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  plan: "pro" | "business" | "enterprise";
  status: "active" | "paused" | "cancelled" | "pending";
  mp_preapproval_id: string | null;
  mp_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubscriptionData {
  user_id: string;
  plan: "pro" | "business" | "enterprise";
  status: "active" | "paused" | "cancelled" | "pending";
  mp_preapproval_id?: string | null;
  mp_customer_id?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
}

export interface UpdateSubscriptionData {
  status?: "active" | "paused" | "cancelled" | "pending";
  mp_customer_id?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
}

export interface SubscriptionRepository {
  createSubscription(data: CreateSubscriptionData): Promise<SubscriptionRecord>;
  getLatestByUserId(userId: string): Promise<SubscriptionRecord | null>;
  getByPreapprovalId(preapprovalId: string): Promise<SubscriptionRecord | null>;
  updateByPreapprovalId(preapprovalId: string, updates: UpdateSubscriptionData): Promise<SubscriptionRecord>;
}

type Dependencies = {
  supabaseClient: SupabaseClient;
};

export const createSubscriptionRepository = (
  deps: Dependencies,
): SubscriptionRepository => {
  const { supabaseClient } = deps;

  return {
    async createSubscription(data: CreateSubscriptionData): Promise<SubscriptionRecord> {
      try {
        const { data: subscription, error } = await supabaseClient
          .from("subscriptions")
          .insert(data)
          .select()
          .single();

        if (error) {
          throw new HttpError(`Failed to create subscription: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        if (!subscription) {
          throw new HttpError("Failed to create subscription: No data returned", {
            status: 500,
          });
        }

        return subscription as SubscriptionRecord;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to create subscription", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },

    async getLatestByUserId(userId: string): Promise<SubscriptionRecord | null> {
      try {
        const { data: subscription, error } = await supabaseClient
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          throw new HttpError(`Failed to fetch subscription: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        return subscription as SubscriptionRecord | null;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to fetch subscription", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },

    async getByPreapprovalId(preapprovalId: string): Promise<SubscriptionRecord | null> {
      try {
        const { data: subscription, error } = await supabaseClient
          .from("subscriptions")
          .select("*")
          .eq("mp_preapproval_id", preapprovalId)
          .maybeSingle();

        if (error) {
          throw new HttpError(`Failed to fetch subscription: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        return subscription as SubscriptionRecord | null;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to fetch subscription", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },

    async updateByPreapprovalId(
      preapprovalId: string,
      updates: UpdateSubscriptionData,
    ): Promise<SubscriptionRecord> {
      try {
        const { data: subscription, error } = await supabaseClient
          .from("subscriptions")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("mp_preapproval_id", preapprovalId)
          .select()
          .single();

        if (error || !subscription) {
          throw new HttpError("Subscription not found", { status: 404 });
        }

        return subscription as SubscriptionRecord;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to update subscription", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
};

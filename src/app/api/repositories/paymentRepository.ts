import type { SupabaseClient } from "@supabase/supabase-js";

import { HttpError } from "../lib/errorHandler";

export interface PaymentRecord {
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

export interface UpsertPaymentData {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  stripe_product_id?: string | null;
  plan_key?: string | null;
  plan_name?: string | null;
  status: string;
  amount_total?: number | null;
  currency?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  canceled_at?: string | null;
  latest_invoice_id?: string | null;
}

export interface PaymentRepository {
  upsertPayment(data: UpsertPaymentData): Promise<PaymentRecord>;
  getLatestPaymentByUserId(userId: string): Promise<PaymentRecord | null>;
}

type Dependencies = {
  supabaseClient: SupabaseClient;
};

export const createPaymentRepository = (deps: Dependencies): PaymentRepository => {
  const { supabaseClient } = deps;

  return {
    async upsertPayment(data: UpsertPaymentData): Promise<PaymentRecord> {
      try {
        const { data: payment, error } = await supabaseClient
          .from("payments")
          .upsert(
            {
              ...data,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "stripe_customer_id",
            }
          )
          .select()
          .single();

        if (error) {
          throw new HttpError(`Failed to upsert payment: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        if (!payment) {
          throw new HttpError("Failed to upsert payment: No data returned", {
            status: 500,
          });
        }

        return payment as PaymentRecord;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to upsert payment", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },

    async getLatestPaymentByUserId(userId: string): Promise<PaymentRecord | null> {
      try {
        const { data: payments, error } = await supabaseClient
          .from("payments")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (error) {
          throw new HttpError(`Failed to fetch payments: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        return payments?.[0] ?? null;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to fetch payments", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
};

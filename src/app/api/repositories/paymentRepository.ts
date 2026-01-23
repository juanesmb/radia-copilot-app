import type { SupabaseClient } from "@supabase/supabase-js";

import { HttpError } from "../lib/errorHandler";

export interface PaymentRecord {
  id: string;
  user_id: string;
  plan: "pro";
  mp_payment_id: string | null;
  status: string;
  amount_cop: number;
  currency: string;
  paid_at: string | null;
  created_at: string;
}

export interface CreatePaymentData {
  user_id: string;
  plan: "pro";
  mp_payment_id?: string | null;
  status: string;
  amount_cop: number;
  currency: string;
  paid_at?: string | null;
}

export interface PaymentRepository {
  createPayment(data: CreatePaymentData): Promise<PaymentRecord>;
}

type Dependencies = {
  supabaseClient: SupabaseClient;
};

export const createPaymentRepository = (deps: Dependencies): PaymentRepository => {
  const { supabaseClient } = deps;

  return {
    async createPayment(data: CreatePaymentData): Promise<PaymentRecord> {
      try {
        const { data: payment, error } = await supabaseClient
          .from("payments")
          .insert(data)
          .select()
          .single();

        if (error) {
          throw new HttpError(`Failed to create payment: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        if (!payment) {
          throw new HttpError("Failed to create payment: No data returned", {
            status: 500,
          });
        }

        return payment as PaymentRecord;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to create payment", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
};

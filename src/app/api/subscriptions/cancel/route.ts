import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseClient } from "../../clients/supabaseClient";
import { mapErrorToResponse } from "../../lib/errorHandler";
import { createPreApprovalClient } from "../../lib/mercadopagoClient";
import { createSubscriptionRepository } from "../../repositories/subscriptionRepository";

const requestSchema = z.object({
  preapprovalId: z.string().min(1),
});

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const subscriptionRepository = createSubscriptionRepository({
  supabaseClient: supabaseClient.getClient(),
});

const mapStatus = (status?: string | null) => {
  if (!status) return "pending";
  if (["approved", "active", "authorized"].includes(status)) return "active";
  if (["paused"].includes(status)) return "paused";
  if (["cancelled", "cancelled_by_user", "cancelled_by_admin"].includes(status)) return "cancelled";
  return "pending";
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = requestSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { preapprovalId } = parsed.data;

    const existing = await subscriptionRepository.getByPreapprovalId(preapprovalId);
    if (!existing) {
      return NextResponse.json({ message: "Subscription not found" }, { status: 404 });
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const preApprovalClient = createPreApprovalClient();

    const anyClient = preApprovalClient as any;
    if (typeof anyClient.cancel !== "function" && typeof anyClient.update !== "function") {
      return NextResponse.json(
        { message: "MercadoPago client does not support cancelling preapproval." },
        { status: 500 }
      );
    }

    try {
      if (typeof anyClient.cancel === "function") {
        await anyClient.cancel({ id: String(preapprovalId) });
      } else {
        await anyClient.update({
          id: String(preapprovalId),
          body: { status: "cancelled" },
        });
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      const maybeStatus = (error as any)?.status;
      const alreadyCancelled =
        (typeof details === "string" &&
          details.toLowerCase().includes("cancelled preapproval")) ||
        (typeof maybeStatus === "number" && maybeStatus === 400);

      if (!alreadyCancelled) {
        console.warn("[subscriptions/cancel] MercadoPago cancel failed:", error);
        return NextResponse.json(
          {
            message: "Failed to cancel subscription in MercadoPago.",
            details,
          },
          { status: 502 }
        );
      }

      try {
        const preApproval = await preApprovalClient.get({ id: String(preapprovalId) });
        const updated = await subscriptionRepository.updateByPreapprovalId(String(preapprovalId), {
          status: mapStatus(preApproval.status),
          mp_customer_id: preApproval.payer_id ? String(preApproval.payer_id) : null,
          current_period_start: preApproval.last_modified ?? null,
          current_period_end: preApproval.next_payment_date ?? null,
        });
        return NextResponse.json(
          {
            ...updated,
            alreadyCancelled: true,
          },
          { status: 200 }
        );
      } catch (syncError) {
        console.warn("[subscriptions/cancel] MercadoPago sync-after-cancel failed:", syncError);
        const updated = await subscriptionRepository.updateByPreapprovalId(String(preapprovalId), {
          status: "cancelled",
        });
        return NextResponse.json(
          {
            ...updated,
            alreadyCancelled: true,
          },
          { status: 200 }
        );
      }
    }

    const updated = await subscriptionRepository.updateByPreapprovalId(String(preapprovalId), {
      status: "cancelled",
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("[subscriptions/cancel] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

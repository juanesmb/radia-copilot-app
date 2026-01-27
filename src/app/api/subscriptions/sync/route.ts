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
        mp_raw_status: preApproval.status ?? null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[subscriptions/sync] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

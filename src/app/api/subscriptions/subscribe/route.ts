import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "../../clients/supabaseClient";
import { mapErrorToResponse } from "../../lib/errorHandler";
import { createPreApprovalClient } from "../../lib/mercadopagoClient";
import { createSubscriptionRepository } from "../../repositories/subscriptionRepository";
import { validateCreateSubscriptionRequest } from "../../types/subscriptions";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const subscriptionRepository = createSubscriptionRepository({
  supabaseClient: supabaseClient.getClient(),
});

const PLAN_PRICES: Record<string, number> = {
  pro: 20000,
  business: 50000,
  enterprise: 100000,
};

const MP_REASON: Record<string, string> = {
  pro: "Radia Copilot Pro",
  business: "Radia Copilot Business",
  enterprise: "Radia Copilot Enterprise",
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const primaryEmailId = clerkUser.primaryEmailAddressId;
    const clerkEmail =
      clerkUser.emailAddresses.find((email: { id: string; emailAddress: string }) => email.id === primaryEmailId)?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      null;
    const payerEmail = process.env.MP_TEST_PAYER_EMAIL || clerkEmail;

    if (!payerEmail) {
      return NextResponse.json({ message: "payer_email is required" }, { status: 400 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const validation = validateCreateSubscriptionRequest(payload);
    if (!validation.success) {
      return NextResponse.json({ message: validation.message }, { status: 400 });
    }

    const { plan } = validation.data;
    const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!publicBaseUrl) {
      return NextResponse.json({ message: "NEXT_PUBLIC_APP_URL is not configured." }, { status: 500 });
    }

    const preApprovalClient = createPreApprovalClient();
    const now = new Date();
    const startDate = new Date(now.getTime() + 2 * 60 * 1000).toISOString();

    const preApproval = await preApprovalClient.create({
      body: {
        reason: MP_REASON[plan],
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: PLAN_PRICES[plan],
          currency_id: "COP",
        },
        back_url: `${publicBaseUrl}/?subscription=success`,
        payer_email: payerEmail,
        status: "pending",
        external_reference: `${userId}:${plan}`,
        first_invoice_offset: 0,
        start_date: startDate,
      },
    });

    const preapprovalId = preApproval?.id ?? "";
    const initPoint = preApproval?.init_point ?? preApproval?.sandbox_init_point ?? "";

    if (!preapprovalId || !initPoint) {
      return NextResponse.json({ message: "Failed to create MercadoPago subscription." }, { status: 502 });
    }

    await subscriptionRepository.createSubscription({
      user_id: userId,
      plan,
      status: "pending",
      mp_preapproval_id: preapprovalId,
      current_period_start: startDate,
      current_period_end: null,
    });

    return NextResponse.json(
      {
        initPoint,
        preapprovalId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[subscription/subscribe] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

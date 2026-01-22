import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "../../clients/supabaseClient";
import { mapErrorToResponse } from "../../lib/errorHandler";
import { createPaymentClient, createPreApprovalClient } from "../../lib/mercadopagoClient";
import { createPaymentRepository } from "../../repositories/paymentRepository";
import { createSubscriptionRepository } from "../../repositories/subscriptionRepository";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const subscriptionRepository = createSubscriptionRepository({
  supabaseClient: supabaseClient.getClient(),
});

const paymentRepository = createPaymentRepository({
  supabaseClient: supabaseClient.getClient(),
});

const parseExternalReference = (externalReference?: string | null) => {
  if (!externalReference) return null;
  const [userId, plan] = externalReference.split(":");
  if (!userId || !plan) return null;
  if (!(["pro", "business", "enterprise"] as const).includes(plan as any)) return null;
  return { userId, plan: plan as "pro" | "business" | "enterprise" };
};

const mapStatus = (status?: string | null) => {
  if (!status) return "pending";
  if (["authorized", "approved", "active"].includes(status)) return "active";
  if (["paused"].includes(status)) return "paused";
  if (["cancelled", "cancelled_by_user", "cancelled_by_admin"].includes(status)) return "cancelled";
  return "pending";
};

export async function POST(request: NextRequest) {
  try {
    const signatureSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (signatureSecret && !request.headers.get("x-signature")) {
      return NextResponse.json({ message: "Missing webhook signature." }, { status: 401 });
    }

    let payload: any = null;
    try {
      payload = await request.json();
    } catch {
      payload = null;
    }

    const params = request.nextUrl.searchParams;
    const topic = params.get("topic") || params.get("type") || payload?.type;
    const dataId = params.get("id") || payload?.data?.id;

    if (!topic || !dataId) {
      return NextResponse.json({ message: "Invalid webhook payload." }, { status: 400 });
    }

    if (["preapproval", "preapproval_plan", "plan", "subscription"].includes(topic)) {
      const preApprovalClient = createPreApprovalClient();
      const preApproval = await preApprovalClient.get({ id: String(dataId) });
      const mappedStatus = mapStatus(preApproval.status);

      await subscriptionRepository.updateByPreapprovalId(String(dataId), {
        status: mappedStatus,
        mp_customer_id: preApproval.payer_id ? String(preApproval.payer_id) : null,
        current_period_start: preApproval.last_modified ?? null,
        current_period_end: preApproval.next_payment_date ?? null,
      });

      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (topic === "payment") {
      const paymentClient = createPaymentClient();
      const payment = await paymentClient.get({ id: String(dataId) });
      const external = parseExternalReference(payment.external_reference);

      if (!external) {
        return NextResponse.json({ received: true }, { status: 200 });
      }

      await paymentRepository.createPayment({
        user_id: external.userId,
        plan: external.plan,
        mp_payment_id: payment.id ? String(payment.id) : null,
        status: payment.status || "unknown",
        amount_cop: Number(payment.transaction_amount || 0),
        currency: payment.currency_id || "COP",
        paid_at: payment.date_approved || null,
      });

      return NextResponse.json({ received: true }, { status: 200 });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[mercadopago/webhook] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

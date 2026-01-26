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
  if (!(["pro"] as const).includes(plan as any)) return null;
  return { userId, plan: plan as "pro" };
};

const mapStatus = (status?: string | null) => {
  if (!status) return "pending";
  if (["authorized", "approved", "active"].includes(status)) return "active";
  if (["paused"].includes(status)) return "paused";
  if (["cancelled", "cancelled_by_user", "cancelled_by_admin"].includes(status)) return "cancelled";
  return "pending";
};

const handleNotification = async (request: NextRequest) => {
  const signatureSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const hasSignature = Boolean(request.headers.get("x-signature"));
  const enforceSignature = process.env.NODE_ENV === "production";
  if (signatureSecret && enforceSignature && request.method === "POST" && !hasSignature) {
    return NextResponse.json({ message: "Missing webhook signature." }, { status: 401 });
  }

  let payload: any = null;
  if (request.method === "POST") {
    try {
      payload = await request.json();
    } catch {
      payload = null;
    }
  }

  const params = request.nextUrl.searchParams;
  if (params.get("health") === "1") {
    return NextResponse.json({ received: true }, { status: 200 });
  }
  const topic = params.get("topic") || params.get("type") || payload?.type;
  const dataId = params.get("id") || payload?.data?.id;

  if (!topic || !dataId) {
    return NextResponse.json({ message: "Invalid webhook payload." }, { status: 400 });
  }

  if (["preapproval", "preapproval_plan", "plan", "subscription"].includes(topic)) {
    const preApprovalClient = createPreApprovalClient();
    try {
      const preApproval = await preApprovalClient.get({ id: String(dataId) });
      const mappedStatus = mapStatus(preApproval.status);

      await subscriptionRepository.updateByPreapprovalId(String(dataId), {
        status: mappedStatus,
        mp_customer_id: preApproval.payer_id ? String(preApproval.payer_id) : null,
        current_period_start: preApproval.last_modified ?? null,
        current_period_end: preApproval.next_payment_date ?? null,
      });
    } catch (error) {
      console.warn("[mercadopago/webhook] Preapproval fetch failed:", error);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (topic === "payment") {
    const paymentClient = createPaymentClient();
    try {
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
    } catch (error) {
      console.warn("[mercadopago/webhook] Payment fetch failed:", error);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
};

export async function POST(request: NextRequest) {
  try {
    return await handleNotification(request);
  } catch (error) {
    console.error("[mercadopago/webhook] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function GET(request: NextRequest) {
  try {
    return await handleNotification(request);
  } catch (error) {
    console.error("[mercadopago/ipn] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

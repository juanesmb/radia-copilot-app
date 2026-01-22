import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getStripeClient } from "../../clients/stripeClient";
import { createSupabaseClient } from "../../clients/supabaseClient";
import { createPaymentRepository } from "../../repositories/paymentRepository";
import { getOrCreateCustomer } from "../customer";
import { billingPlans } from "../planConfig";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const paymentRepository = createPaymentRepository({
  supabaseClient: supabaseClient.getClient(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as { planKey?: string };
    const plan = billingPlans.find((entry) => entry.key === payload.planKey);
    if (!plan) {
      return NextResponse.json({ message: "Invalid plan." }, { status: 400 });
    }

    const stripe = getStripeClient();
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress ?? null;
    const customer = await getOrCreateCustomer(stripe, userId, email);

    const prices = await stripe.prices.list({
      product: plan.productId,
      active: true,
      recurring: { interval: "month" },
      limit: 1,
    });

    const price = prices.data[0];
    if (!price) {
      return NextResponse.json(
        { message: "No monthly price found." },
        { status: 400 }
      );
    }

    const origin = request.headers.get("origin") ?? "";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancel`,
      subscription_data: {
        metadata: {
          userId,
        },
      },
      allow_promotion_codes: true,
    });

    await paymentRepository.upsertPayment({
      user_id: userId,
      stripe_customer_id: customer.id,
      stripe_product_id: plan.productId,
      stripe_price_id: price.id,
      plan_key: plan.key,
      plan_name: plan.label,
      status: "pending",
      currency: price.currency,
      amount_total: price.unit_amount ?? null,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("[billingCheckout] Error:", error);
    return NextResponse.json(
      { message: "Failed to create checkout session." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripeClient } from "../../clients/stripeClient";
import { createSupabaseClient } from "../../clients/supabaseClient";
import { createPaymentRepository } from "../../repositories/paymentRepository";
import { mapSubscriptionToPayment } from "../stripeMapping";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const paymentRepository = createPaymentRepository({
  supabaseClient: supabaseClient.getClient(),
});

const getUserIdFromSubscription = async (
  stripe: Stripe,
  subscription: Stripe.Subscription
): Promise<string | null> => {
  const metadataUserId = subscription.metadata?.userId;
  if (metadataUserId) {
    return metadataUserId;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) {
    return null;
  }

  const customer = await stripe.customers.retrieve(customerId);
  if (
    customer &&
    !Array.isArray(customer) &&
    "metadata" in customer &&
    customer.metadata?.userId
  ) {
    return customer.metadata.userId;
  }

  return null;
};

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { message: "Missing Stripe webhook configuration." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("[billingWebhook] Signature error:", error);
    return NextResponse.json({ message: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await getUserIdFromSubscription(stripe, subscription);
        if (!userId) {
          return NextResponse.json(
            { message: "Missing user metadata." },
            { status: 200 }
          );
        }

        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id ?? "";

        await paymentRepository.upsertPayment(
          mapSubscriptionToPayment(subscription, userId, customerId)
        );
        break;
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id ?? null;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const userId = await getUserIdFromSubscription(stripe, subscription);
          if (userId) {
            const customerId =
              typeof subscription.customer === "string"
                ? subscription.customer
                : subscription.customer?.id ?? "";

            await paymentRepository.upsertPayment(
              mapSubscriptionToPayment(subscription, userId, customerId)
            );
          }
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[billingWebhook] Handler error:", error);
    return NextResponse.json({ message: "Webhook error." }, { status: 500 });
  }
}

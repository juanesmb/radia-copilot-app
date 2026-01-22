import type Stripe from "stripe";

import type { UpsertPaymentData } from "../repositories/paymentRepository";
import { findPlanByProductId } from "./utils";

export const mapSubscriptionToPayment = (
  subscription: Stripe.Subscription,
  userId: string,
  customerId: string
): UpsertPaymentData => {
  const subscriptionWithPeriod = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const item = subscription.items.data[0];
  const price = item?.price;
  const productId =
    typeof price?.product === "string"
      ? price.product
      : price?.product?.id ?? null;
  const plan = findPlanByProductId(productId);

  return {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: price?.id ?? null,
    stripe_product_id: productId,
    plan_key: plan?.key ?? null,
    plan_name: plan?.label ?? null,
    status: subscription.status,
    amount_total: price?.unit_amount ?? null,
    currency: price?.currency ?? null,
    current_period_start: subscriptionWithPeriod.current_period_start
      ? new Date(subscriptionWithPeriod.current_period_start * 1000).toISOString()
      : null,
    current_period_end: subscriptionWithPeriod.current_period_end
      ? new Date(subscriptionWithPeriod.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? null,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    latest_invoice_id:
      typeof subscription.latest_invoice === "string"
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id ?? null,
  };
};

import { NextResponse } from "next/server";

import { getStripeClient } from "../../clients/stripeClient";
import { billingPlans } from "../planConfig";
import { findPlanByProductId } from "../utils";

export async function GET() {
  try {
    const stripe = getStripeClient();

    const priceLookups = await Promise.all(
      billingPlans.map(async (plan) => {
        const prices = await stripe.prices.list({
          product: plan.productId,
          active: true,
          recurring: { interval: "month" },
          limit: 1,
        });

        const price = prices.data[0];
        if (!price) {
          return null;
        }

        const mappedPlan = findPlanByProductId(plan.productId);
        if (!mappedPlan) {
          return null;
        }

        return {
          key: mappedPlan.key,
          label: mappedPlan.label,
          description: mappedPlan.description,
          productId: plan.productId,
          priceId: price.id,
          amount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval ?? "month",
        };
      })
    );

    const plans = priceLookups.filter(Boolean);

    return NextResponse.json({ plans }, { status: 200 });
  } catch (error) {
    console.error("[billingPlans] Error:", error);
    return NextResponse.json(
      { message: "Failed to load billing plans." },
      { status: 500 }
    );
  }
}

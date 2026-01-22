import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getStripeClient } from "../../clients/stripeClient";
import { createSupabaseClient } from "../../clients/supabaseClient";
import { createPaymentRepository } from "../../repositories/paymentRepository";
import { getOrCreateCustomer } from "../customer";

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

    const stripe = getStripeClient();
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress ?? null;

    const customer = await getOrCreateCustomer(stripe, userId, email);

    await paymentRepository.upsertPayment({
      user_id: userId,
      stripe_customer_id: customer.id,
      status: "portal",
    });

    const origin = request.headers.get("origin") ?? "";
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${origin}/?billing=portal-return`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("[billingPortal] Error:", error);
    return NextResponse.json(
      { message: "Failed to create billing portal session." },
      { status: 500 }
    );
  }
}

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { createSupabaseClient } from "../../clients/supabaseClient";
import { createPaymentRepository } from "../../repositories/paymentRepository";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const paymentRepository = createPaymentRepository({
  supabaseClient: supabaseClient.getClient(),
});

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payment = await paymentRepository.getLatestPaymentByUserId(userId);
    return NextResponse.json({ payment }, { status: 200 });
  } catch (error) {
    console.error("[billingSubscription] Error:", error);
    return NextResponse.json(
      { message: "Failed to load subscription." },
      { status: 500 }
    );
  }
}

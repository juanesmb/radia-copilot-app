import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { createSupabaseClient } from "../clients/supabaseClient";
import { mapErrorToResponse } from "../lib/errorHandler";
import { createSubscriptionRepository } from "../repositories/subscriptionRepository";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const subscriptionRepository = createSubscriptionRepository({
  supabaseClient: supabaseClient.getClient(),
});

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const subscription = await subscriptionRepository.getLatestByUserId(userId);
    return NextResponse.json(subscription, { status: 200 });
  } catch (error) {
    console.error("[subscriptions] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

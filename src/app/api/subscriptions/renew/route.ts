import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseClient } from "../../clients/supabaseClient";
import { mapErrorToResponse } from "../../lib/errorHandler";
import { createPreApprovalClient } from "../../lib/mercadopagoClient";
import { createSubscriptionRepository } from "../../repositories/subscriptionRepository";

const requestSchema = z.object({
  plan: z.literal("pro").default("pro"),
});

type Plan = z.infer<typeof requestSchema>["plan"];

type Country = "CO" | "AR";

const normalizeSimulationCountry = (value?: string | null): Country | null => {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (["ar", "arg", "argentina"].includes(v)) return "AR";
  if (["co", "col", "colombia"].includes(v)) return "CO";
  return null;
};

const detectCountry = (request: Request): Country => {
  const simulation = normalizeSimulationCountry(process.env.SIMULATION_COUNTRY);
  if (simulation) return simulation;

  const headerCountry =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-country");

  if (headerCountry) {
    const v = headerCountry.trim().toUpperCase();
    if (v === "AR") return "AR";
    if (v === "CO") return "CO";
  }

  return "CO";
};

const PLAN_PRICES: Record<Plan, Record<Country, number>> = {
  pro: {
    CO: 20000,
    AR: Number(process.env.PRO_PRICE_ARS || 0) || 0,
  },
};

const MP_REASON: Record<Plan, string> = {
  pro: "Radia Copilot Pro",
};

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const subscriptionRepository = createSubscriptionRepository({
  supabaseClient: supabaseClient.getClient(),
});

const computeStartDate = (currentPeriodEnd: string | null) => {
  const now = new Date();

  if (currentPeriodEnd) {
    const end = new Date(currentPeriodEnd);
    if (!Number.isNaN(end.getTime()) && end.getTime() > now.getTime()) {
      return new Date(end.getTime() + 2 * 60 * 1000).toISOString();
    }
  }

  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload: unknown = {};
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }

    const parsed = requestSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { plan } = parsed.data;
    const country = detectCountry(request);

    const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!publicBaseUrl) {
      return NextResponse.json({ message: "NEXT_PUBLIC_APP_URL is not configured." }, { status: 500 });
    }

    const existing = await subscriptionRepository.getLatestByUserId(userId);
    if (!existing || !existing.mp_preapproval_id) {
      return NextResponse.json({ message: "No existing subscription found." }, { status: 404 });
    }

    if (existing.status !== "cancelled") {
      return NextResponse.json(
        { message: "Subscription is not cancelled." },
        { status: 400 }
      );
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const primaryEmailId = clerkUser.primaryEmailAddressId;
    const clerkEmail =
      clerkUser.emailAddresses.find((email: { id: string; emailAddress: string }) => email.id === primaryEmailId)
        ?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      null;

    const payerEmail = process.env.MP_TEST_PAYER_EMAIL || clerkEmail;
    if (!payerEmail) {
      return NextResponse.json({ message: "payer_email is required" }, { status: 400 });
    }

    const amount = PLAN_PRICES[plan][country];
    const currencyId = country === "AR" ? "ARS" : "COP";
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { message: `Price not configured for country ${country}.` },
        { status: 500 }
      );
    }

    const startDate = computeStartDate(existing.current_period_end);

    const preApprovalClient = createPreApprovalClient();

    const baseBody = {
      reason: MP_REASON[plan],
      auto_recurring: {
        frequency: 1,
        frequency_type: "months" as const,
        transaction_amount: amount,
      },
      back_url: `${publicBaseUrl}/?subscription=success`,
      payer_email: payerEmail,
      status: "pending" as const,
      external_reference: `${userId}:${plan}`,
      first_invoice_offset: 0,
      start_date: startDate,
    };

    const tryCreate = async (includeCurrencyId: boolean) => {
      const body = includeCurrencyId
        ? {
            ...baseBody,
            auto_recurring: {
              ...baseBody.auto_recurring,
              currency_id: currencyId,
            },
          }
        : baseBody;

      return await preApprovalClient.create({ body });
    };

    let preApproval;
    try {
      preApproval = await tryCreate(true);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      const message = (error as any)?.message ?? details;
      const invalidCurrencyField =
        typeof message === "string" &&
        message.toLowerCase().includes("invalid field") &&
        message.toLowerCase().includes("auto_recurring.currency_id");

      if (!invalidCurrencyField) {
        throw error;
      }

      preApproval = await tryCreate(false);
    }

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
    console.error("[subscription/renew] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

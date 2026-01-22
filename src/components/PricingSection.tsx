'use client';

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { createBillingPortalSession, createCheckoutSession, getBillingPlans, getBillingSubscription, type BillingPlan, type BillingSubscription } from "@/lib/api";

const formatCurrency = (
  amount: number | null,
  currency: string | null,
  locale: string
) => {
  if (amount === null || !currency) return "";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount / 100);
};

export function PricingSection() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const loadBillingData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [plansResponse, subscriptionResponse] = await Promise.all([
        getBillingPlans(),
        getBillingSubscription(),
      ]);
      setPlans(plansResponse.plans);
      setSubscription(subscriptionResponse.payment);
    } catch (error) {
      toast({
        title: t("pricing.error"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  const activePlanKey = subscription?.plan_key ?? null;
  const locale = language === "es" ? "es-ES" : "en-US";
  const subscriptionStatus = subscription?.status ?? "";
  const hasActiveSubscription = useMemo(() => {
    return ["active", "trialing", "past_due", "pending"].includes(subscriptionStatus);
  }, [subscriptionStatus]);
  const isPending = subscriptionStatus === "pending";

  const handleCheckout = async (planKey: string) => {
    try {
      setIsActionLoading(true);
      const response = await createCheckoutSession(planKey);
      window.location.href = response.url;
    } catch (error) {
      toast({
        title: t("pricing.error"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePortal = async () => {
    try {
      setIsActionLoading(true);
      const response = await createBillingPortalSession();
      window.location.href = response.url;
    } catch (error) {
      toast({
        title: t("pricing.error"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <section className="h-full px-4 sm:px-6 pb-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {t("pricing.tagline")}
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-foreground">
            {t("pricing.title")}
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl">
            {t("pricing.subtitle")}
          </p>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">{t("pricing.loading")}</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const priceLabel = formatCurrency(plan.amount ?? null, plan.currency ?? null, locale);
              const isCurrent = hasActiveSubscription && activePlanKey === plan.key;
              const isPlanDisabled = isActionLoading || (isCurrent && isPending);

              return (
                <Card key={plan.key} className={`relative ${isCurrent ? "border-primary shadow-lg" : ""}`}>
                  {isCurrent && (
                    <div className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      {t("pricing.currentPlan")}
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-xl">{plan.label}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-3xl font-semibold">
                      {priceLabel}
                      <span className="text-sm text-muted-foreground"> / {t("pricing.perMonth")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("pricing.billingPeriod")}
                    </p>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-2 items-stretch">
                    {hasActiveSubscription ? (
                      <Button
                        variant={isCurrent ? "secondary" : "default"}
                        disabled={isPlanDisabled}
                        onClick={handlePortal}
                      >
                        {isCurrent
                          ? isPending
                            ? t("pricing.pending")
                            : t("pricing.manage")
                          : t("pricing.changePlan")}
                      </Button>
                    ) : (
                      <Button
                        disabled={isPlanDisabled}
                        onClick={() => handleCheckout(plan.key)}
                      >
                        {t("pricing.choosePlan")}
                      </Button>
                    )}
                    {hasActiveSubscription && !isPending && (
                      <Button
                        variant="outline"
                        disabled={isActionLoading}
                        onClick={handlePortal}
                      >
                        {t("pricing.cancelOrUpdate")}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

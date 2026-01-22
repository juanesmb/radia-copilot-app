import Stripe from "stripe";

import { HttpError } from "../lib/errorHandler";

let stripeClient: Stripe | null = null;

export const getStripeClient = () => {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_API_KEY;
  if (!secretKey) {
    throw new HttpError("STRIPE_SECRET_API_KEY is not configured.", {
      status: 500,
    });
  }

  stripeClient = new Stripe(secretKey);

  return stripeClient;
};

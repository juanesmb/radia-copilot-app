import type Stripe from "stripe";

export const getOrCreateCustomer = async (
  stripe: Stripe,
  userId: string,
  email?: string | null
) => {
  const searchResults = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 1,
  });

  if (searchResults.data.length > 0) {
    return searchResults.data[0];
  }

  if (email) {
    const existingByEmail = await stripe.customers.list({
      email,
      limit: 1,
    });
    if (existingByEmail.data.length > 0) {
      return existingByEmail.data[0];
    }
  }

  return stripe.customers.create({
    email: email ?? undefined,
    metadata: {
      userId,
    },
  });
};

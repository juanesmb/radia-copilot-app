import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { HttpError } from "../lib/errorHandler";

export interface SupabaseClientConfig {
  url: string;
  serviceRoleKey: string;
}

export interface SupabaseClientInterface {
  getClient(): SupabaseClient;
}

export const createSupabaseClient = (config: SupabaseClientConfig): SupabaseClientInterface => {
  const { url, serviceRoleKey } = config;

  if (!url) {
    throw new HttpError("NEXT_PUBLIC_SUPABASE_URL is not configured.", {
      status: 500,
    });
  }

  if (!serviceRoleKey) {
    throw new HttpError("SUPABASE_SERVICE_ROLE_KEY is not configured.", {
      status: 500,
    });
  }

  try {
    const client = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    return {
      getClient() {
        return client;
      },
    };
  } catch (error) {
    throw new HttpError("Failed to initialize Supabase client", {
      status: 500,
      details: error instanceof Error ? error.message : String(error),
    });
  }
};


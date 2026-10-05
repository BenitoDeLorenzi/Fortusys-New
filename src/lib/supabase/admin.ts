import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/features/database/types";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Supabase admin credentials are not configured.");
  }

  return createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

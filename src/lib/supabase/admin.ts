import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * Service-role client. Bypasses RLS — only call AFTER the caller's permission has been
 * verified with the user-scoped client. Server-only; the key never reaches the browser.
 */
export function createAdminClient() {
  const { url } = supabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (server-only env var)");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

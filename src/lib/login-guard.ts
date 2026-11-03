import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createClient as createPlainClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import { isValidUsername, usernameToEmail } from "./staff";

// Server-only: deliberately NOT in a "use server" file, so none of this is callable from the browser.
const FAILS_PER_ACCOUNT = 5;
const FAILS_PER_IP = 30;

/** Keyed hash so the throttle table never holds raw usernames or IP addresses. */
function throttleKey(kind: string, value: string) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "kaafiye").update(`${kind}:${value.toLowerCase()}`).digest("hex");
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export function adminOrNull() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : null;
}

export async function loginGuard(identifier: string) {
  const admin = adminOrNull();
  const keys = { user: throttleKey("u", identifier), ip: throttleKey("ip", await clientIp()) };
  return {
    /** Seconds to wait before another attempt (0 = allowed). */
    async waitSeconds() {
      if (!admin) return 0;
      const { data } = await admin.rpc("login_wait_seconds", { p_keys: [keys.user, keys.ip], p_limits: [FAILS_PER_ACCOUNT, FAILS_PER_IP] });
      return typeof data === "number" ? data : 0;
    },
    async record(success: boolean) {
      if (admin) await admin.rpc("login_record", { p_user_key: keys.user, p_ip_key: keys.ip, p_success: success });
    },
  };
}

/**
 * Username → auth e-mail, resolved only on the server. The e-mail never reaches the browser and
 * every failure gives the same generic message, so usernames cannot be enumerated.
 */
export async function resolveLoginEmail(identifier: string) {
  if (identifier.includes("@")) return identifier;
  const admin = adminOrNull();
  if (admin && isValidUsername(identifier)) {
    const { data } = await admin.from("memberships").select("user_id").eq("username", identifier).maybeSingle();
    if (data) {
      const { data: u } = await admin.auth.admin.getUserById(data.user_id);
      if (u.user?.email) return u.user.email;
    }
  }
  return usernameToEmail(identifier);
}

/** Checks a signed-in user's current password with the same throttle as the login form. */
export async function verifyCurrentPassword(email: string, password: string): Promise<"ok" | "wrong" | "throttled"> {
  const guard = await loginGuard(email);
  if ((await guard.waitSeconds()) > 0) return "throttled";
  const probe: SupabaseClient = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  await guard.record(!error);
  if (!error) await probe.auth.signOut({ scope: "local" }); // drop only this probe session
  return error ? "wrong" : "ok";
}

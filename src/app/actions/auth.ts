"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { loginGuard, resolveLoginEmail } from "@/lib/login-guard";
import { normalizeUsername } from "@/lib/staff";
import type { ActionState } from "@/lib/errors";

export async function signIn(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: "login.notConfigured", at: Date.now() };
  const identifier = normalizeUsername(String(form.get("identifier") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!identifier || !password) return { error: "err.REQUIRED", at: Date.now() };

  const guard = await loginGuard(identifier);
  const wait = await guard.waitSeconds();
  if (wait > 0) return { error: "login.throttled", vars: { m: Math.ceil(wait / 60) }, at: Date.now() };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: await resolveLoginEmail(identifier), password });
  await guard.record(!error);
  if (error) return { error: "login.invalid", at: Date.now() };
  redirect("/");
}

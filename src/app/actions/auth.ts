"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { loginToEmail } from "@/lib/staff";
import type { DictKey } from "@/lib/i18n/dict";

export async function signIn(_prev: { error?: DictKey } | undefined, form: FormData): Promise<{ error?: DictKey }> {
  if (!isSupabaseConfigured()) return { error: "login.notConfigured" };
  const identifier = String(form.get("identifier") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!identifier || !password) return { error: "err.REQUIRED" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(identifier), password });
  if (error) return { error: "login.invalid" };
  redirect("/");
}

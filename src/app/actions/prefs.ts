"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/i18n/dict";
import { createClient } from "@/lib/supabase/server";

export async function setLang(lang: Lang) {
  if (lang !== "so" && lang !== "en") return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

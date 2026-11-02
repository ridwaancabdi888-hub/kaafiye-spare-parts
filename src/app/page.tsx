import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function Home() {
  if (!isSupabaseConfigured()) redirect("/login");
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.membership) redirect("/dashboard");
  if (s.isSuper) redirect("/super");
  redirect("/login?e=noaccess");
}

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { FxRate, Membership } from "./types";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: membership }, { data: superRow }] = await Promise.all([
    supabase.from("memberships").select("*").eq("user_id", user.id).eq("active", true).maybeSingle<Membership>(),
    supabase.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  let business: { id: string; name: string; slug: string } | null = null;
  if (membership) {
    const { data } = await supabase.from("businesses").select("id, name, slug").eq("id", membership.business_id).maybeSingle();
    business = data;
  }
  return {
    supabase,
    user,
    membership: business ? membership : null,
    business,
    isSuper: Boolean(superRow),
    isAdmin: Boolean(business && membership?.role === "admin"),
  };
});

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;
export type MemberSession = Session & { membership: Membership; business: NonNullable<Session["business"]> };

export async function requireMember(): Promise<MemberSession> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.membership || !s.business) redirect(s.isSuper ? "/super" : "/login?e=noaccess");
  return s as MemberSession;
}

export async function requireAdmin(): Promise<MemberSession> {
  const s = await requireMember();
  if (!s.isAdmin) redirect("/dashboard");
  return s;
}

export async function requireSuper(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.isSuper) redirect("/dashboard");
  return s;
}

export const getFx = cache(async (businessId: string) => {
  const s = await getSession();
  if (!s) return null;
  const [{ data: rate }, { data: settings }] = await Promise.all([
    s.supabase.from("fx_rates").select("*").eq("business_id", businessId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle<FxRate>(),
    s.supabase.from("business_settings").select("*").eq("business_id", businessId).maybeSingle(),
  ]);
  const staleHours: number = settings?.fx_stale_hours ?? 24;
  return {
    rate: rate ? { ...rate, slsh_per_usd: Number(rate.slsh_per_usd) } : null,
    staleHours,
    settings: settings as { users_see_all_banjarka: boolean; fx_stale_hours: number; default_low_stock: number } | null,
  };
});

/** Map user_id → display name for the current business. */
export const getStaffNames = cache(async (businessId: string) => {
  const s = await getSession();
  const { data } = await s!.supabase.from("memberships").select("user_id, full_name, role, active, username, id, created_at")
    .eq("business_id", businessId).order("created_at");
  const rows = (data ?? []) as Membership[];
  return { rows, names: Object.fromEntries(rows.map((m) => [m.user_id, m.full_name])) as Record<string, string> };
});

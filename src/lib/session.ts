import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { FxRate, Membership } from "./types";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // One round-trip for membership + its business (RLS lets members read their own business).
  const [{ data: row }, { data: superRow }] = await Promise.all([
    supabase.from("memberships").select("*, business:businesses(id, name, slug, active)").eq("user_id", user.id).eq("active", true)
      .maybeSingle<Membership & { business: { id: string; name: string; slug: string; active: boolean } | null }>(),
    supabase.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  const biz = row?.business;
  const business = biz && biz.active ? { id: biz.id, name: biz.name, slug: biz.slug } : null;
  let membership: Membership | null = null;
  if (row) {
    const { business: _drop, ...m } = row;
    void _drop;
    membership = m;
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

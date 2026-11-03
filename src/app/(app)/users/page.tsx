import { getStaffNames, requireAdmin } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDateTime, fmtUsd, monthStart, num, rangeToIso } from "@/lib/format";
import type { DictKey } from "@/lib/i18n/dict";
import type { Membership } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { Alert, EmptyState, Initials, PageHeader, SectionHeader } from "@/components/kit";
import { AccountControls } from "@/components/AccountControls";
import { AddStaffButton } from "./UserForms";

export const metadata = { title: "Staff" };

type Event = { id: number; event: string; target_name: string | null; actor_name: string | null; created_at: string };

export default async function UsersPage() {
  const s = await requireAdmin();
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const start = rangeToIso({ from: monthStart(), to: null }).start!;
  const [staff, sales, bj, events, full] = await Promise.all([
    getStaffNames(s.business.id),
    s.supabase.from("sales").select("created_by, total_usd").eq("business_id", s.business.id).eq("status", "active").gte("created_at", start),
    s.supabase.from("banjarka_records").select("created_by, worker_share_usd").eq("business_id", s.business.id).eq("status", "active").gte("work_date", monthStart()),
    s.supabase.from("account_events").select("id, event, target_name, actor_name, created_at").eq("business_id", s.business.id).order("id", { ascending: false }).limit(20),
    s.supabase.from("memberships").select("*").eq("business_id", s.business.id).order("created_at"),
  ]);
  const sum = (rows: Record<string, unknown>[] | null, key: string) =>
    (rows ?? []).reduce<Record<string, number>>((a, r) => ((a[r.created_by as string] = (a[r.created_by as string] ?? 0) + num(r[key])), a), {});
  const salesBy = sum(sales.data, "total_usd");
  const shareBy = sum(bj.data, "worker_share_usd");
  const members = ((full.data ?? staff.rows) as Membership[]);
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Sign-in identifier shown to the admin: the username, or "email" (address itself stays private).
  const emailUsers = new Set<string>();
  if (hasKey) {
    const admin = createAdminClient();
    await Promise.all(members.filter((m) => !m.username).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      if (data.user?.email && !data.user.email.endsWith(".kaafiye.local")) emailUsers.add(m.user_id);
    }));
  }

  return (
    <>
      <PageHeader title={t("users.title")} subtitle={t("users.subtitle")} actions={hasKey && <AddStaffButton />} />
      {!hasKey && <Alert tone="warning" className="mb-4">{t("users.serviceKeyMissing")}</Alert>}

      <ul className="grid gap-3 md:grid-cols-2">
        {members.map((m) => {
          const self = m.user_id === s.user.id;
          return (
            <li key={m.user_id} className={`card ${m.active ? "" : "opacity-70"}`}>
              <div className="flex items-start gap-3">
                <Initials name={m.full_name} className="h-11 w-11 text-[14px]" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-bold">{m.full_name}</span>
                    {self && <span className="badge badge-navy">{t("users.you")}</span>}
                  </div>
                  <div className="mt-0.5 truncate text-[13px] text-muted">
                    {t("users.signsInWith", { v: m.username ? `@${m.username}` : emailUsers.has(m.user_id) ? t("users.emailLogin") : "—" })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="badge badge-slate">{m.role === "admin" ? t("role.admin") : t("role.user")}</span>
                    <span className={`badge ${m.active ? "badge-green" : "badge-red"}`}>{m.active ? t("common.active") : t("common.disabled")}</span>
                    {m.must_change_password && <span className="badge badge-amber"><Icon name="key" className="h-3 w-3" />{t("users.mustChange")}</span>}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-canvas p-2.5"><div className="text-[11.5px] text-muted">{t("users.monthSales")}</div><div className="num font-bold">{fmtUsd(salesBy[m.user_id] ?? 0)}</div></div>
                <div className="rounded-xl bg-canvas p-2.5"><div className="text-[11.5px] text-muted">{t("users.monthShare")}</div><div className="num font-bold">{fmtUsd(shareBy[m.user_id] ?? 0)}</div></div>
              </div>
              {!self && m.role === "user" && hasKey && (
                <div className="mt-3 border-t border-line pt-3">
                  <AccountControls userId={m.user_id} name={m.full_name} username={m.username} active={m.active} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <SectionHeader title={t("users.events")} />
      {(events.data ?? []).length ? (
        <ul className="card-tight divide-y divide-line">
          {((events.data ?? []) as Event[]).map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"><Icon name="shield" className="h-4 w-4" /></span>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold">{t(`users.event.${e.event}` as DictKey)} — {e.target_name ?? "—"}</div>
                <div className="text-[12.5px] text-muted">{t("rep.by", { name: e.actor_name ?? "—" })} · {fmtDateTime(e.created_at, lang)}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="shield" text={t("empty.events")} />
      )}
    </>
  );
}

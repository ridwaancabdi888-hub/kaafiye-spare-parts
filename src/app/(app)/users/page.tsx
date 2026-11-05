import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { getDisplayCurrency, getLang, getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDateTime, fmtInt, fmtMoney, fmtWorkDate, localDate, num, periodRange, pickMoney, type Currency } from "@/lib/format";
import type { DictKey } from "@/lib/i18n/dict";
import type { Membership } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { Alert, EmptyState, Initials, PageHeader, SectionHeader } from "@/components/kit";
import { AccountControls, RestoreButton } from "@/components/AccountControls";
import { DisplayCurrencyToggle } from "@/components/DisplayCurrencyToggle";
import { PeriodChips, parsePeriod } from "@/components/PeriodChips";
import { AddStaffButton, RewardButton, VoidRewardButton } from "./UserForms";

export const metadata = { title: "Staff" };

type Event = { id: number; event: string; target_name: string | null; actor_name: string | null; created_at: string };
type Perf = {
  user_id: string; full_name: string; role: "admin" | "user"; active: boolean; archived: boolean; sales_count: number; bj_count: number;
} & Record<`${"sales" | "bj_gross" | "bj_expenses" | "bj_net" | "bj_worker" | "bj_shop" | "business"}_${"usd" | "slsh"}`, number>;
type Reward = {
  id: string; user_id: string; amount: number; currency: Currency; amount_usd: number; fx_slsh_per_usd: number;
  reward_date: string; reason: string; status: "active" | "voided"; void_reason: string | null;
};

const RANKS = { combined: "business", parts: "sales", banjarka: "bj_gross", count: "sales_count" } as const;
type Rank = keyof typeof RANKS;
const MEDALS = ["🥇", "🥈", "🥉"];

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string; rank?: string }> }) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const [t, lang, cur] = await Promise.all([getT(), getLang(), getDisplayCurrency()]);
  const period = parsePeriod(sp.period, "month");
  const range = periodRange(period, sp.from, sp.to);
  const rank: Rank = sp.rank && sp.rank in RANKS ? (sp.rank as Rank) : "combined";
  const [perfRes, events, full, rewardsRes] = await Promise.all([
    s.supabase.rpc("staff_performance", { p_from: range.from, p_to: range.to }),
    s.supabase.from("account_events").select("id, event, target_name, actor_name, created_at").eq("business_id", s.business.id).order("id", { ascending: false }).limit(20),
    s.supabase.from("memberships").select("*").eq("business_id", s.business.id).order("created_at"),
    s.supabase.from("employee_rewards").select("*").eq("business_id", s.business.id).order("reward_date", { ascending: false }).order("created_at", { ascending: false }).limit(30),
  ]);
  const members = (full.data ?? []) as Membership[];
  const current = members.filter((m) => !m.archived_at);
  const archived = members.filter((m) => m.archived_at);
  const names = Object.fromEntries(members.map((m) => [m.user_id, m.full_name]));
  const rewards = (rewardsRes.data ?? []) as Reward[];
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const metric = (p: Perf) => (rank === "count" ? num(p.sales_count) : num(p[`${RANKS[rank] as "business" | "sales" | "bj_gross"}_${cur === "USD" ? "usd" : "slsh"}`]));
  const showMetric = (p: Perf) => (rank === "count" ? `${fmtInt(p.sales_count)} ${t("perf.salesUnit")}` : fmtMoney(metric(p), cur));
  const perf = ((perfRes.data ?? []) as Perf[]).filter((p) => !p.archived || p.sales_count > 0 || p.bj_count > 0).sort((a, b) => metric(b) - metric(a));
  const podium = perf.filter((p) => metric(p) > 0).slice(0, 3);

  const qs = (extra: Record<string, string>) => new URLSearchParams({
    period, ...(period === "custom" && range.from ? { from: range.from } : {}), ...(period === "custom" && range.to ? { to: range.to } : {}), rank, ...extra,
  }).toString();

  // Sign-in identifier shown to the admin: the username, or "email" (address itself stays private).
  const emailUsers = new Set<string>();
  if (hasKey) {
    const admin = createAdminClient();
    await Promise.all(current.filter((m) => !m.username).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      if (data.user?.email && !data.user.email.endsWith(".kaafiye.local")) emailUsers.add(m.user_id);
    }));
  }

  return (
    <>
      <PageHeader title={t("users.title")} subtitle={t("users.subtitle")} actions={hasKey && <AddStaffButton />} />
      {!hasKey && <Alert tone="warning" className="mb-4">{t("users.serviceKeyMissing")}</Alert>}

      {/* ───────── Performance ───────── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title flex items-center gap-2"><Icon name="trending" className="h-5 w-5 text-brand-600" /> {t("perf.title")}</h2>
        <DisplayCurrencyToggle value={cur} />
      </div>
      <PeriodChips base="/users" period={period} from={range.from} to={range.to} custom extra={{ rank }} />
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label={t("perf.rankBy")}>
        <span className="shrink-0 self-center text-[12.5px] font-semibold text-muted">{t("perf.rankBy")}:</span>
        {(Object.keys(RANKS) as Rank[]).map((k) => (
          <Link key={k} href={`/users?${qs({ rank: k })}`} className={`chip ${rank === k ? "chip-active" : ""}`} aria-current={rank === k ? "true" : undefined}>
            {t(`perf.rank.${k}` as DictKey)}
          </Link>
        ))}
      </div>

      {podium.length ? (
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {podium.map((p, i) => (
            <li key={p.user_id} className={`card flex items-center gap-3 ${i === 0 ? "border-amber-300 bg-amber-50/60" : ""}`}>
              <span className="text-[30px] leading-none" aria-label={t("perf.place", { n: i + 1 })}>{MEDALS[i]}</span>
              <div className="min-w-0">
                <div className="truncate font-bold">{p.full_name}</div>
                <div className="num text-[17px] font-extrabold text-navy-900">{showMetric(p)}</div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4"><EmptyState icon="chart" text={t("perf.empty")} /></div>
      )}

      <Alert tone="info" className="mt-4">{t("perf.disclaimer")}</Alert>

      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {perf.map((p, i) => (
          <li key={p.user_id} className="card">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-[13px] font-bold text-slate-600">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{p.full_name}</span>
              {p.archived && <span className="badge badge-slate">{t("users.archived")}</span>}
              {p.role === "admin" && <span className="badge badge-navy">{t("role.admin")}</span>}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
              <Stat label={t("perf.sales")} value={pickMoney(p, "sales", cur)} />
              <Stat label={t("perf.salesCount")} value={fmtInt(p.sales_count)} />
              <Stat label={t("perf.bjGross")} value={pickMoney(p, "bj_gross", cur)} />
              <Stat label={t("perf.bjExpenses")} value={pickMoney(p, "bj_expenses", cur)} />
              <Stat label={t("perf.bjNet")} value={pickMoney(p, "bj_net", cur)} />
              <Stat label={t("perf.bjWorker")} value={pickMoney(p, "bj_worker", cur)} />
              <Stat label={t("perf.bjShop")} value={pickMoney(p, "bj_shop", cur)} />
              <Stat label={t("perf.business")} value={pickMoney(p, "business", cur)} strong />
            </dl>
          </li>
        ))}
      </ul>

      {/* ───────── Rewards ───────── */}
      <SectionHeader title={t("perf.rewards")} action={<RewardButton members={current} today={localDate()} />} />
      {rewards.length ? (
        <ul className="card-tight divide-y divide-line">
          {rewards.map((r) => {
            const shown = cur === r.currency ? null : cur === "USD" ? num(r.amount_usd) : num(r.amount_usd) * num(r.fx_slsh_per_usd);
            return (
              <li key={r.id} className={`flex flex-wrap items-start gap-3 px-4 py-3 ${r.status === "voided" ? "opacity-60" : ""}`}>
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700"><Icon name="award" className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{names[r.user_id] ?? "—"}</span>
                    <span className={`num font-bold ${r.status === "voided" ? "line-through" : ""}`}>{fmtMoney(r.amount, r.currency)}</span>
                    {shown !== null && <span className="num text-[12.5px] text-muted">≈ {fmtMoney(shown, cur)}</span>}
                    {r.status === "voided" && <span className="badge badge-red">{t("common.voided")}</span>}
                  </div>
                  <div className="text-[12.5px] text-muted">{fmtWorkDate(r.reward_date, lang)} · {r.reason}{r.void_reason ? ` · ${r.void_reason}` : ""}</div>
                </div>
                {r.status === "active" && <VoidRewardButton id={r.id} />}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon="award" text={t("perf.noRewards")} />
      )}

      {/* ───────── Accounts ───────── */}
      <SectionHeader title={t("users.accounts")} />
      <ul className="grid gap-3 md:grid-cols-2">
        {current.map((m) => {
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
              {!self && m.role === "user" && hasKey && (
                <div className="mt-3 border-t border-line pt-3">
                  <AccountControls userId={m.user_id} name={m.full_name} username={m.username} active={m.active} canRemove />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {archived.length > 0 && (
        <details className="mt-4 rounded-2xl border border-line bg-white">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-semibold">
            <Icon name="archive" className="h-5 w-5 text-slate-500" /> {t("users.archivedTitle")} ({archived.length})
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {archived.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Initials name={m.full_name} className="h-9 w-9 text-[13px]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{m.full_name}</div>
                  <div className="text-[12.5px] text-muted">{t("users.archivedOn", { d: fmtDateTime(m.archived_at!, lang) })}</div>
                </div>
                {hasKey && m.role === "user" && <RestoreButton userId={m.user_id} />}
              </li>
            ))}
          </ul>
          <p className="hint px-4 pb-3">{t("users.archivedHint")}</p>
        </details>
      )}

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

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl p-2.5 ${strong ? "bg-brand-50" : "bg-canvas"}`}>
      <dt className="truncate text-[11.5px] text-muted">{label}</dt>
      <dd className={`num truncate font-bold ${strong ? "text-brand-800" : ""}`}>{value}</dd>
    </div>
  );
}

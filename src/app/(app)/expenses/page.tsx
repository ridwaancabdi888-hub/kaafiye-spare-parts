import Link from "next/link";
import { getStaffNames, requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { listProducts } from "@/lib/data";
import { fmtUsd, periodRange, rangeToIso } from "@/lib/format";
import type { Expense } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { PageHeader, SectionHeader, StatCard } from "@/components/kit";
import { PeriodChips, parsePeriod } from "@/components/PeriodChips";
import { ExpensesList } from "@/components/lists";
import { ExpensePanel } from "../spare-parts/Workspace";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string; kind?: string }> }) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const t = await getT();
  const period = parsePeriod(sp.period, "month");
  const range = periodRange(period, sp.from, sp.to);
  const iso = rangeToIso(range);
  const kind = sp.kind === "cash" || sp.kind === "item" ? sp.kind : "";

  let q = s.supabase.from("expenses").select("*").eq("business_id", s.business.id).order("created_at", { ascending: false }).limit(300);
  if (iso.start) q = q.gte("created_at", iso.start);
  if (iso.end) q = q.lt("created_at", iso.end);
  if (kind) q = q.eq("kind", kind);
  const [{ data }, staff, products] = await Promise.all([q, getStaffNames(s.business.id), listProducts(s.supabase, s.business.id, { includeArchived: true })]);
  const rows = (data ?? []) as Expense[];
  const names = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const active = rows.filter((r) => r.status === "active");
  const cash = active.filter((r) => r.kind === "cash").reduce((a, r) => a + Number(r.amount_usd), 0);
  const item = active.filter((r) => r.kind === "item").reduce((a, r) => a + Number(r.amount_usd), 0);
  const base = { period, ...(range.from && period === "custom" ? { from: range.from } : {}), ...(range.to && period === "custom" ? { to: range.to } : {}) };
  const qs = new URLSearchParams(base).toString();

  return (
    <>
      <PageHeader title={t("exp.title")} subtitle={t("exp.subtitle")}
        actions={<a className="btn-secondary btn-sm" href={`/api/export/expenses?${qs}`}><Icon name="download" className="h-4 w-4" /> {t("common.export")}</a>} />
      <PeriodChips base="/expenses" period={period} from={range.from} to={range.to} custom extra={kind ? { kind } : {}} />
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon="wallet" tone="navy" label={t("rep.cashExpenses")} value={fmtUsd(cash)} />
        <StatCard icon="package" tone="amber" label={t("rep.itemUsage")} value={fmtUsd(item)} />
        <div className="col-span-2 lg:col-span-1"><StatCard icon="receipt" tone="rose" label={t("common.total")} value={fmtUsd(cash + item)} hint={t("rep.usdNote")} /></div>
      </div>

      <div className="mt-2 grid gap-x-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="min-w-0">
          <SectionHeader title={t("exp.title")} />
          <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {([["", t("common.all")], ["cash", t("exp.cash")], ["item", t("exp.item")]] as const).map(([k, label]) => (
              <Link key={k} href={`/expenses?${new URLSearchParams({ ...base, ...(k ? { kind: k } : {}) })}`} className={`chip ${kind === k ? "chip-active" : ""}`}>{label}</Link>
            ))}
          </div>
          <ExpensesList rows={rows} products={names} ctx={{ userId: s.user.id, isAdmin: true, names: staff.names }} />
        </div>
        <div>
          <SectionHeader title={t("exp.add")} />
          <ExpensePanel products={products.filter((p) => p.status === "active")} />
        </div>
      </div>
    </>
  );
}

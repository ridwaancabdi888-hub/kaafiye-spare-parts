import Link from "next/link";
import { getStaffNames, requireAdmin } from "@/lib/session";
import { getDisplayCurrency, getLang, getT } from "@/lib/i18n/server";
import { uncertainCostSales } from "@/lib/data";
import { fmtDateTime, fmtInt, fmtMoney, periodRange, pickMoney, rangeToIso, type Currency } from "@/lib/format";
import type { DictKey } from "@/lib/i18n/dict";
import type { ReportSummary, Revision } from "@/lib/types";
import { DisplayCurrencyToggle } from "@/components/DisplayCurrencyToggle";
import { Icon } from "@/components/Icon";
import { Alert, DataTable, EmptyState, PageHeader, SectionHeader, StatCard } from "@/components/kit";
import { PeriodChips, parsePeriod } from "@/components/PeriodChips";

export const metadata = { title: "Reports" };

const ACTION_BADGE = { create: "badge-slate", edit: "badge-green", correction: "badge-amber", void: "badge-red" } as const;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const [t, lang, cur] = await Promise.all([getT(), getLang(), getDisplayCurrency()]);
  const period = parsePeriod(sp.period, "month");
  const range = periodRange(period, sp.from, sp.to);
  const iso = rangeToIso(range);
  const [report, revisions, staff, zc] = await Promise.all([
    s.supabase.rpc("report_summary", { p_from: range.from, p_to: range.to }),
    s.supabase.from("record_revisions").select("id, table_name, record_id, action, actor, reason, changed_fields, created_at")
      .eq("business_id", s.business.id).neq("action", "create").order("id", { ascending: false }).limit(40),
    getStaffNames(s.business.id),
    uncertainCostSales(s.supabase, s.business.id, iso),
  ]);
  const r = (report.data ?? {}) as ReportSummary;
  const qs = new URLSearchParams({ period, ...(period === "custom" && range.from ? { from: range.from } : {}), ...(period === "custom" && range.to ? { to: range.to } : {}) }).toString();
  const byCur = (o: Partial<Record<Currency, number>> | undefined) =>
    o && Object.keys(o).length ? Object.entries(o).map(([c, v]) => fmtMoney(v, c as Currency)).join(" + ") : "—";
  const field = (f: string) => t(`field.${f}` as DictKey);
  const revs = (revisions.data ?? []) as Revision[];

  return (
    <>
      <PageHeader title={t("rep.title")} subtitle={t("rep.subtitle")} actions={<DisplayCurrencyToggle value={cur} />} />
      <PeriodChips base="/reports" period={period} from={range.from} to={range.to} custom />

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="cart" label={t("rep.salesRevenue")} value={pickMoney(r, "sales", cur)} hint={`${fmtInt(r.sales_count)} ${t("common.records")} · ${fmtInt(r.units_sold)} ${t("common.pcs")}`} />
        <StatCard icon="trending" tone="navy" label={t("rep.grossProfit")} value={pickMoney(r, "gross_profit", cur)} />
        <StatCard icon="wrench" label={t("rep.bjShop")} value={pickMoney(r, "banjarka_shop", cur)} />
        <StatCard icon="pencil" tone="amber" label={t("dash.editedRecords")} value={fmtInt(r.edited_count)} />
      </div>
      {zc > 0 && <Alert tone="warning" className="mt-4">{t("rep.zeroCost", { n: zc })}</Alert>}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="section-title mb-2 flex items-center gap-2"><Icon name="cart" className="h-5 w-5 text-brand-600" /> {t("rep.spareParts")}</h2>
          <Line label={t("rep.salesRevenue")} value={pickMoney(r, "sales", cur)} />
          <Line label={t("rep.cogs")} value={`− ${pickMoney(r, "cogs", cur)}`} />
          <Line label={t("rep.grossProfit")} value={pickMoney(r, "gross_profit", cur)} strong />
          <Line label={t("rep.cashExpenses")} value={`− ${pickMoney(r, "cash_expenses", cur)}`} />
          <Line label={t("rep.itemUsage")} value={`− ${pickMoney(r, "item_usage_cost", cur)}`} />
          <Line label={t("rep.spNet")} value={pickMoney(r, "spare_parts_net", cur)} strong green />
          <p className="hint mt-2">{t("rep.byCurrency")}: {byCur(r.sales_by_currency)} · {t("exp.cash")}: {byCur(r.cash_expenses_by_currency)}</p>
        </section>
        <section className="card">
          <h2 className="section-title mb-2 flex items-center gap-2"><Icon name="wrench" className="h-5 w-5 text-brand-600" /> {t("rep.banjarka")} <span className="badge badge-slate">{fmtInt(r.banjarka_count)}</span></h2>
          <Line label={t("rep.bjGross")} value={pickMoney(r, "banjarka_gross", cur)} />
          <Line label={t("rep.bjExpenses")} value={`− ${pickMoney(r, "banjarka_expenses", cur)}`} />
          <Line label={t("rep.bjNet")} value={pickMoney(r, "banjarka_net", cur)} strong />
          <Line label={t("rep.bjWorker")} value={pickMoney(r, "banjarka_worker", cur)} />
          <Line label={t("rep.bjShop")} value={pickMoney(r, "banjarka_shop", cur)} strong green />
          <p className="hint mt-2">{t("rep.byCurrency")}: {byCur(r.banjarka_gross_by_currency)}</p>
        </section>
      </div>

      <div className="mt-4 flex flex-col gap-1 rounded-2xl bg-gradient-to-br from-navy-900 to-brand-800 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-bold">{t("rep.shopNet")}</div>
          <div className="text-[13px] text-white/70">{t("rep.shopNetHint")}</div>
        </div>
        <div className="num text-[30px] font-extrabold">{pickMoney(r, "shop_net", cur)}</div>
      </div>
      <p className="hint mt-2">{t("rep.usdNote")}</p>

      <SectionHeader title={t("rep.downloads")} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {([["sales", "rep.downloadSales"], ["expenses", "rep.downloadExpenses"], ["banjarka", "rep.downloadBanjarka"]] as const).map(([k, label]) => (
          <a key={k} href={`/api/export/${k}?${qs}`} className="btn-secondary justify-between">
            <span>{t(label)}</span> <span className="flex items-center gap-1 text-[13px] text-muted"><Icon name="download" className="h-4 w-4" /> CSV</span>
          </a>
        ))}
      </div>

      <SectionHeader title={t("rep.edits")} />
      <DataTable
        rows={revs}
        rowKey={(v) => String(v.id)}
        empty={<EmptyState icon="history" text={t("empty.history")} />}
        columns={[
          { header: t("common.date"), cell: (v) => <span className="whitespace-nowrap text-[13px]">{fmtDateTime(v.created_at, lang)}</span> },
          { header: t("exp.kind"), cell: (v) => t(`rep.table.${v.table_name}` as DictKey) },
          { header: t("common.status"), cell: (v) => <span className={`badge ${ACTION_BADGE[v.action]}`}>{t(`rep.action.${v.action}` as DictKey)}</span> },
          { header: t("rep.versions"), cell: (v) => <span className="text-[13px]">{v.changed_fields.map(field).join(", ")}</span> },
          { header: t("common.employee"), cell: (v) => (v.actor ? staff.names[v.actor] ?? "—" : "—") },
          { header: t("common.reason"), cell: (v) => <span className="text-[13px] text-muted">{v.reason ?? ""}</span> },
          { header: "", cell: (v) => <Link className="btn-soft btn-sm" href={`/reports/history/${v.table_name}/${v.record_id}`}>{t("common.view")}</Link> },
        ]}
        card={(v) => (
          <Link href={`/reports/history/${v.table_name}/${v.record_id}`} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{t(`rep.table.${v.table_name}` as DictKey)}</span>
                <span className={`badge ${ACTION_BADGE[v.action]}`}>{t(`rep.action.${v.action}` as DictKey)}</span>
              </div>
              <div className="mt-1 text-[13px] text-ink-2">{v.changed_fields.map(field).join(", ")}</div>
              <div className="mt-1 text-[12.5px] text-muted">{v.actor ? staff.names[v.actor] ?? "—" : "—"} · {fmtDateTime(v.created_at, lang)}{v.reason ? ` · “${v.reason}”` : ""}</div>
            </div>
            <Icon name="chevronRight" className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
          </Link>
        )}
      />
    </>
  );
}

function Line({ label, value, strong, green }: { label: string; value: string; strong?: boolean; green?: boolean }) {
  return (
    <div className="row text-[14px]">
      <span className={strong ? "font-bold" : "text-ink-2"}>{label}</span>
      <span className={`num shrink-0 font-bold ${green ? "text-brand-700" : ""}`}>{value}</span>
    </div>
  );
}

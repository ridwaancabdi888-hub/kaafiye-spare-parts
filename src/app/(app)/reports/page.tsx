import Link from "next/link";
import { getStaffNames, requireAdmin } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { fmtDateTime, fmtInt, fmtMoney, fmtUsd, num, periodRange, type Currency } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { PeriodTabs, parsePeriod } from "@/components/PeriodTabs";
import type { DictKey } from "@/lib/i18n/dict";
import type { ReportSummary, Revision } from "@/lib/types";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const period = parsePeriod(sp.period, "month");
  const range = periodRange(period, sp.from, sp.to);
  const [report, revisions, staff] = await Promise.all([
    s.supabase.rpc("report_summary", { p_from: range.from, p_to: range.to }),
    s.supabase.from("record_revisions").select("id, table_name, record_id, action, actor, reason, changed_fields, created_at")
      .eq("business_id", s.business.id).neq("action", "create").order("id", { ascending: false }).limit(40),
    getStaffNames(s.business.id),
  ]);
  const r = (report.data ?? {}) as ReportSummary;
  const qs = new URLSearchParams({ period, ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) }).toString();

  const byCur = (o: Partial<Record<Currency, number>> | undefined) =>
    o && Object.keys(o).length ? Object.entries(o).map(([c, v]) => fmtMoney(v, c as Currency)).join(" + ") : "—";

  return (
    <>
      <PageHeader title={t("rep.title")} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PeriodTabs base="/reports" period={period} from={range.from} to={range.to} custom />
        <div className="flex flex-wrap gap-2">
          <a className="btn-light btn-sm" href={`/api/export/sales?${qs}`}>⬇ {t("rep.salesCount")} CSV</a>
          <a className="btn-light btn-sm" href={`/api/export/expenses?${qs}`}>⬇ {t("exp.title")} CSV</a>
          <a className="btn-light btn-sm" href={`/api/export/banjarka?${qs}`}>⬇ Banjarka CSV</a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("rep.salesRevenue")} value={fmtUsd(r.sales_usd)} hint={`${fmtInt(r.sales_count)} ${t("rep.salesCount").toLowerCase()} • ${fmtInt(r.units_sold)} PCS`} />
        <StatCard label={t("rep.grossProfit")} value={fmtUsd(r.gross_profit_usd)} />
        <StatCard label={t("rep.bjShop")} value={fmtUsd(r.banjarka_shop_usd)} />
        <StatCard label={t("dash.editedRecords")} value={String(num(r.edited_count)).padStart(2, "0")} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 text-xl font-bold">🛞 {t("rep.spareParts")}</h2>
          <Line label={t("rep.salesRevenue")} value={fmtUsd(r.sales_usd)} />
          <Line label={t("rep.cogs")} value={`− ${fmtUsd(r.cogs_usd)}`} />
          <Line label={t("rep.grossProfit")} value={fmtUsd(r.gross_profit_usd)} strong />
          <Line label={t("rep.cashExpenses")} value={`− ${fmtUsd(r.cash_expenses_usd)}`} />
          <Line label={t("rep.itemUsage")} value={`− ${fmtUsd(r.item_usage_cost_usd)}`} />
          <Line label={t("rep.spNet")} value={fmtUsd(r.spare_parts_net_usd)} strong green />
          <p className="muted mt-3">{t("rep.byCurrency")}: {t("rep.salesCount")} {byCur(r.sales_by_currency)} • {t("exp.cash")} {byCur(r.cash_expenses_by_currency)}</p>
        </section>
        <section className="card">
          <h2 className="mb-2 text-xl font-bold">🔧 {t("rep.banjarka")} <span className="muted font-normal">({fmtInt(r.banjarka_count)})</span></h2>
          <Line label={t("rep.bjGross")} value={fmtUsd(r.banjarka_gross_usd)} />
          <Line label={t("rep.bjExpenses")} value={`− ${fmtUsd(r.banjarka_expenses_usd)}`} />
          <Line label={t("rep.bjNet")} value={fmtUsd(r.banjarka_net_usd)} strong />
          <Line label={t("rep.bjWorker")} value={fmtUsd(r.banjarka_worker_usd)} />
          <Line label={t("rep.bjShop")} value={fmtUsd(r.banjarka_shop_usd)} strong green />
          <p className="muted mt-3">{t("rep.byCurrency")}: {byCur(r.banjarka_gross_by_currency)}</p>
        </section>
      </div>

      <div className="card mt-[18px] flex flex-wrap items-center justify-between gap-3 bg-[linear-gradient(105deg,#0a4145,#13775f)] text-white">
        <span>{t("rep.shopNet")}</span>
        <span className="text-[27px] font-extrabold">{fmtUsd(r.shop_net_usd)}</span>
      </div>
      <p className="muted mt-2">{t("rep.usdNote")}</p>

      <div className="section-head">
        <h2>{t("rep.edits")}</h2>
        <span className="tag">5h</span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t("common.date")}</th>
              <th>{t("exp.kind")}</th>
              <th>{t("common.status")}</th>
              <th>{t("rep.changedFields")}</th>
              <th>{t("common.employee")}</th>
              <th>{t("common.reason")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {((revisions.data ?? []) as Revision[]).map((v) => (
              <tr key={v.id}>
                <td className="whitespace-nowrap">{fmtDateTime(v.created_at, lang)}</td>
                <td>{t(`rep.table.${v.table_name}` as DictKey)}</td>
                <td className={v.action === "void" ? "font-bold text-bad" : v.action === "correction" ? "font-bold text-warn" : "font-bold text-ok"}>
                  {t(`rep.action.${v.action}` as DictKey)}
                </td>
                <td className="text-xs">{v.changed_fields.join(", ")}</td>
                <td>{v.actor ? staff.names[v.actor] ?? "—" : "—"}</td>
                <td className="muted">{v.reason ?? ""}</td>
                <td><Link className="btn-light btn-sm" href={`/reports/history/${v.table_name}/${v.record_id}`}>{t("common.view")}</Link></td>
              </tr>
            ))}
            {!revisions.data?.length && <tr><td colSpan={7} className="text-center text-muted">{t("common.none")}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Line({ label, value, strong, green }: { label: string; value: string; strong?: boolean; green?: boolean }) {
  return (
    <div className="row-item">
      <span className={strong ? "font-bold" : ""}>{label}</span>
      <strong className={green ? "text-ok" : ""}>{value}</strong>
    </div>
  );
}

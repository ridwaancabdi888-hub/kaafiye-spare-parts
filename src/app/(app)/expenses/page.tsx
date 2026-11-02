import Link from "next/link";
import { getStaffNames, requireAdmin } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { listProducts } from "@/lib/data";
import { fmtDateTime, fmtMoney, fmtUsd, fmtUsdPrecise, periodRange, rangeToIso } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { PeriodTabs, parsePeriod } from "@/components/PeriodTabs";
import { RecordActions } from "@/components/RecordActions";
import type { Expense } from "@/lib/types";
import { ExpenseForm } from "../spare-parts/ExpenseForm";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string; kind?: string }> }) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const period = parsePeriod(sp.period, "month");
  const range = periodRange(period, sp.from, sp.to);
  const iso = rangeToIso(range);

  let q = s.supabase.from("expenses").select("*").eq("business_id", s.business.id).order("created_at", { ascending: false }).limit(300);
  if (iso.start) q = q.gte("created_at", iso.start);
  if (iso.end) q = q.lt("created_at", iso.end);
  if (sp.kind === "cash" || sp.kind === "item") q = q.eq("kind", sp.kind);
  const [{ data }, staff, products] = await Promise.all([q, getStaffNames(s.business.id), listProducts(s.supabase, s.business.id, { includeArchived: true })]);
  const rows = (data ?? []) as Expense[];
  const productName = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const active = rows.filter((r) => r.status === "active");
  const cashUsd = active.filter((r) => r.kind === "cash").reduce((a, r) => a + Number(r.amount_usd), 0);
  const itemUsd = active.filter((r) => r.kind === "item").reduce((a, r) => a + Number(r.amount_usd), 0);
  const qs = new URLSearchParams({ period, ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) });

  return (
    <>
      <PageHeader title={t("exp.title")} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PeriodTabs base="/expenses" period={period} from={range.from} to={range.to} custom />
        <a className="btn-light btn-sm" href={`/api/export/expenses?${qs}`}>⬇ {t("common.export")}</a>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("rep.cashExpenses")} value={fmtUsd(cashUsd)} />
        <StatCard label={t("rep.itemUsage")} value={fmtUsd(itemUsd)} />
        <StatCard label={t("common.total")} value={fmtUsd(cashUsd + itemUsd)} hint={t("rep.usdNote")} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-[18px] lg:grid-cols-[1.4fr_.6fr]">
        <div>
          <div className="mb-3 flex gap-2 text-sm">
            {[["", t("common.all")], ["cash", t("exp.cash")], ["item", t("exp.item")]].map(([k, label]) => (
              <Link key={k} href={`/expenses?${new URLSearchParams({ ...Object.fromEntries(qs), ...(k ? { kind: k } : {}) })}`}
                className={`rounded-md px-3 py-1.5 ${(sp.kind ?? "") === k ? "bg-brand text-white" : "bg-tag text-tag-ink"}`}>
                {label}
              </Link>
            ))}
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("common.date")}</th>
                  <th>{t("exp.kind")}</th>
                  <th>{t("common.amount")}</th>
                  <th>{t("common.reason")}</th>
                  <th>{t("common.employee")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className={e.status === "voided" ? "opacity-60" : ""}>
                    <td className="whitespace-nowrap">
                      {fmtDateTime(e.created_at, lang)}
                      {e.edit_count > 0 && <div className="text-[11px] text-warn">✎ {t("common.edited")}</div>}
                    </td>
                    <td>{e.kind === "cash" ? t("exp.cash") : `${t("exp.item")}: ${e.quantity} × ${productName[e.product_id!] ?? "—"}`}</td>
                    <td className="font-bold">
                      {e.kind === "cash" ? fmtMoney(e.amount, e.currency) : fmtUsdPrecise(e.amount_usd)}
                      {e.kind === "cash" && e.currency === "SLSH" && <div className="muted font-normal">≈ {fmtUsd(e.amount_usd)}</div>}
                    </td>
                    <td>{e.reason}{e.void_reason && <div className="text-xs text-bad">{t("common.voided")}: {e.void_reason}</div>}</td>
                    <td>{staff.names[e.created_by] ?? "—"}</td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <RecordActions table="expenses" record={e} isOwn={e.created_by === s.user.id} isAdmin />
                        <Link className="text-xs text-tag-ink hover:underline" href={`/reports/history/expenses/${e.id}`}>{t("common.history")}</Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={6} className="text-center text-muted">{t("common.none")}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <section className="card h-fit">
          <h2 className="mb-1 text-xl font-bold">{t("sp.expenseTitle")}</h2>
          <ExpenseForm products={products.filter((p) => p.status === "active")} />
        </section>
      </div>
    </>
  );
}

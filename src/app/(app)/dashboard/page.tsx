import Link from "next/link";
import { getFx, getStaffNames, requireMember, type MemberSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { listProducts } from "@/lib/data";
import { fmtInt, fmtUsd, localDate, monthStart, num, periodRange, rangeToIso } from "@/lib/format";
import { FxWidget } from "@/components/FxWidget";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { StockTable } from "@/components/StockTable";
import { PeriodTabs, parsePeriod } from "@/components/PeriodTabs";
import type { ReportSummary } from "@/lib/types";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const s = await requireMember();
  const sp = await searchParams;
  return s.isAdmin ? <AdminDashboard s={s} period={parsePeriod(sp.period)} /> : <StaffDashboard s={s} />;
}

async function AdminDashboard({ s, period }: { s: MemberSession; period: ReturnType<typeof parsePeriod> }) {
  const t = await getT();
  const range = periodRange(period);
  const [fx, products, staff, report] = await Promise.all([
    getFx(s.business.id),
    listProducts(s.supabase, s.business.id),
    getStaffNames(s.business.id),
    s.supabase.rpc("report_summary", { p_from: range.from, p_to: range.to }),
  ]);
  const r = (report.data ?? {}) as Partial<ReportSummary>;
  const units = products.reduce((a, p) => a + p.stock_qty, 0);
  const low = products.filter((p) => p.stock_qty <= p.low_stock_threshold).length;
  const periodLabel = period === "today" ? t("common.today") : period === "month" ? t("common.month") : t("common.allTime");

  return (
    <>
      <PageHeader title={t("dash.title")} />
      <FxWidget rate={fx?.rate ?? null} staleHours={fx?.staleHours ?? 24} canChange />

      <div className="mb-4 flex justify-end">
        <PeriodTabs base="/dashboard" period={period} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("dash.sparePartsSales")} value={fmtUsd(r.sales_usd)} hint={`${periodLabel} • ${fmtInt(r.sales_count)} ${t("rep.salesCount").toLowerCase()}`} />
        <StatCard label={t("dash.banjarkaIncome")} value={fmtUsd(r.banjarka_gross_usd)} hint={periodLabel} />
        <StatCard label={t("dash.expenses")} value={fmtUsd(num(r.cash_expenses_usd) + num(r.item_usage_cost_usd))} hint={`${periodLabel} • ${t("exp.cash")} + ${t("exp.item")}`} />
        <StatCard label={t("dash.stockUnits")} value={`${fmtInt(units)} PCS`} hint={`${products.length} ${t("sp.product").toLowerCase()}`} />
      </div>

      <div className="section-head">
        <h2>{t("dash.inventoryNow")}</h2>
        <Link href="/inventory/new" className="btn">{t("dash.newProduct")}</Link>
      </div>
      <StockTable products={products} linkToEdit />

      <div className="section-head">
        <h2>{t("dash.staffReports")}</h2>
        <Link href="/reports" className="tag">{t("common.today")} • {t("common.month")} • {t("common.allTime")} →</Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("dash.staffCount")} value={String(staff.rows.filter((m) => m.active).length).padStart(2, "0")} />
        <StatCard label={t("dash.editedRecords")} value={String(num(r.edited_count)).padStart(2, "0")} hint={periodLabel} />
        <StatCard label={t("dash.lowStockCount")} value={String(low).padStart(2, "0")} />
        <StatCard label={t("dash.banjarkaShop")} value={fmtUsd(r.banjarka_shop_usd)} hint={periodLabel} />
      </div>
    </>
  );
}

async function StaffDashboard({ s }: { s: MemberSession }) {
  const t = await getT();
  const today = rangeToIso({ from: localDate(), to: localDate() });
  const [fx, products, mySales, myBj] = await Promise.all([
    getFx(s.business.id),
    listProducts(s.supabase, s.business.id),
    s.supabase.from("sales").select("total_usd").eq("created_by", s.user.id).eq("status", "active").gte("created_at", today.start!),
    s.supabase.from("banjarka_records").select("worker_share_usd").eq("created_by", s.user.id).eq("status", "active").gte("work_date", monthStart()),
  ]);
  const salesToday = (mySales.data ?? []).reduce((a, r) => a + num(r.total_usd), 0);
  const shareMonth = (myBj.data ?? []).reduce((a, r) => a + num(r.worker_share_usd), 0);

  return (
    <>
      <PageHeader title={t("dash.staffTitle")} />
      <FxWidget rate={fx?.rate ?? null} staleHours={fx?.staleHours ?? 24} canChange={false} />

      <div className="section-head">
        <h2>{t("common.yourWork")} / Your work</h2>
        <span className="tag">{t("common.onlyTwo")}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <WorkTile icon="🛞" title={t("nav.spareParts")} desc={t("dash.recordSaleDesc")} href="/spare-parts" cta={t("dash.recordSale")}
          meta={`${t("dash.mySalesToday")}: ${fmtUsd(salesToday)}`} />
        <WorkTile icon="🔧" title={t("nav.banjarka")} desc={t("dash.recordBanjarkaDesc")} href="/banjarka" cta={t("dash.recordBanjarka")}
          meta={`${t("dash.myShareMonth")}: ${fmtUsd(shareMonth)}`} />
      </div>

      <div className="section-head">
        <h2>{t("dash.stockViewOnly")}</h2>
        <span className="tag">{t("common.search")} & {t("common.lowStock")}</span>
      </div>
      <StockTable products={products} />
    </>
  );
}

function WorkTile({ icon, title, desc, href, cta, meta }: { icon: string; title: string; desc: string; href: string; cta: string; meta: string }) {
  return (
    <div className="min-h-[165px] rounded-[18px] border border-[#e2eaec] bg-white p-6 sm:p-[30px]">
      <div className="text-[34px]" aria-hidden>{icon}</div>
      <h2 className="mb-1 mt-4 text-[22px] font-bold">{title}</h2>
      <p className="muted mb-4">{desc}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={href} className="btn">{cta}</Link>
        <span className="text-sm text-label">{meta}</span>
      </div>
    </div>
  );
}

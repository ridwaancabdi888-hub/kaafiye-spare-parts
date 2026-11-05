import Link from "next/link";
import { getFx, getStaffNames, requireMember, type MemberSession } from "@/lib/session";
import { getDisplayCurrency, getLang, getT } from "@/lib/i18n/server";
import { listProducts, signedImageUrls } from "@/lib/data";
import { fmtInt, fmtLongDate, fmtMoney, localDate, monthStart, num, periodRange, pickMoney, rangeToIso, type Currency } from "@/lib/format";
import type { Product, ReportSummary, Sale } from "@/lib/types";
import { DisplayCurrencyToggle } from "@/components/DisplayCurrencyToggle";
import { FxWidget } from "@/components/FxWidget";
import { Icon, type IconName } from "@/components/Icon";
import { EmptyState, PageHeader, SectionHeader, StatCard } from "@/components/kit";
import { PeriodChips, parsePeriod } from "@/components/PeriodChips";
import { ProductThumb } from "@/components/ProductIcon";
import { SalesList } from "@/components/lists";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const s = await requireMember();
  const sp = await searchParams;
  return s.isAdmin ? <AdminDashboard s={s} period={parsePeriod(sp.period)} /> : <StaffDashboard s={s} />;
}

async function shared(s: MemberSession) {
  const [fx, products, staff, recent] = await Promise.all([
    getFx(s.business.id),
    listProducts(s.supabase, s.business.id),
    getStaffNames(s.business.id),
    s.supabase.from("sales").select("*").eq("business_id", s.business.id).order("created_at", { ascending: false }).limit(5),
  ]);
  const low = products.filter((p) => p.stock_qty <= p.low_stock_threshold).sort((a, b) => a.stock_qty - b.stock_qty);
  const images = await signedImageUrls(s.supabase, low.slice(0, 6).map((p) => p.image_path));
  return { fx, products, staff, recent: (recent.data ?? []) as Sale[], low, images };
}

async function AdminDashboard({ s, period }: { s: MemberSession; period: ReturnType<typeof parsePeriod> }) {
  const [t, lang, cur] = await Promise.all([getT(), getLang(), getDisplayCurrency()]);
  const range = periodRange(period);
  const [{ fx, products, staff, recent, low, images }, report] = await Promise.all([
    shared(s),
    s.supabase.rpc("report_summary", { p_from: range.from, p_to: range.to }),
  ]);
  const r = (report.data ?? {}) as Partial<ReportSummary>;
  const units = products.reduce((a, p) => a + p.stock_qty, 0);
  const retail = products.reduce((a, p) => a + p.stock_qty * (p.sell_price_usd ?? 0), 0);
  // Stock is valued today, so its SlSh figure uses the current rate (records use their own saved rate).
  const rate = fx?.rate?.slsh_per_usd;
  const retailShown = cur === "SLSH" && rate ? fmtMoney(retail * rate, "SLSH") : fmtMoney(retail, "USD");
  const expenses = cur === "USD" ? num(r.cash_expenses_usd) + num(r.item_usage_cost_usd) : num(r.cash_expenses_slsh) + num(r.item_usage_cost_slsh);
  const names = Object.fromEntries(products.map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader title={t("dash.greeting", { name: s.membership.full_name.split(" ")[0] })} subtitle={fmtLongDate(new Date(), lang)} />
      <FxWidget rate={fx?.rate ?? null} staleHours={fx?.staleHours ?? 24} canChange />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">{t("dash.title")}</h2>
        <DisplayCurrencyToggle value={cur} />
      </div>
      <PeriodChips base="/dashboard" period={period} />
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard icon="cart" label={t("dash.sales")} value={pickMoney(r, "sales", cur)} hint={`${fmtInt(r.sales_count)} ${t("common.records")}`} />
        <StatCard icon="trending" tone="navy" label={t("dash.profit")} value={pickMoney(r, "gross_profit", cur)} />
        <StatCard icon="wrench" tone="green" label={t("dash.banjarkaShop")} value={pickMoney(r, "banjarka_shop", cur)} />
        <StatCard icon="wallet" tone="rose" label={t("dash.expenses")} value={fmtMoney(expenses, cur)} />
      </div>

      <SectionHeader title={t("dash.quickActions")} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Quick href="/spare-parts" icon="cart" label={t("dash.newSale")} primary />
        <Quick href="/banjarka" icon="wrench" label={t("dash.newBanjarka")} />
        <Quick href="/inventory/new" icon="plus" label={t("dash.newProduct")} />
        <Quick href="/reports" icon="chart" label={t("dash.viewReports")} />
      </div>

      <div className="mt-2 grid gap-x-6 lg:grid-cols-2">
        <div>
          <SectionHeader title={t("dash.stockSummary")} action={<Link href="/inventory" className="text-[13px] font-semibold text-brand-700">{t("common.viewAll")}</Link>} />
          <div className="grid grid-cols-3 gap-3">
            <Mini label={t("dash.products")} value={fmtInt(products.length)} />
            <Mini label={t("dash.stockUnits")} value={fmtInt(units)} />
            <Mini label={t("dash.retailValue")} value={retailShown} />
          </div>
          <SectionHeader title={`${t("dash.lowStockTitle")} (${low.length})`} />
          <LowStock products={low} images={images} empty={t("empty.lowStock")} pcs={t("common.pcs")} />
        </div>
        <div>
          <SectionHeader title={t("dash.recentSales")} action={<Link href="/spare-parts" className="text-[13px] font-semibold text-brand-700">{t("common.viewAll")}</Link>} />
          <SalesList rows={recent} products={names} ctx={{ userId: s.user.id, isAdmin: true, names: staff.names }} actions={false} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Mini label={t("dash.staffCount")} value={fmtInt(staff.rows.filter((m) => m.active).length)} />
            <Mini label={t("dash.editedRecords")} value={fmtInt(r.edited_count)} />
          </div>
        </div>
      </div>
    </>
  );
}

async function StaffDashboard({ s }: { s: MemberSession }) {
  const [t, lang, cur] = await Promise.all([getT(), getLang(), getDisplayCurrency()]);
  const today = rangeToIso({ from: localDate(), to: localDate() });
  const [{ fx, products, staff, recent, low, images }, mySales, myBj] = await Promise.all([
    shared(s),
    s.supabase.from("sales").select("total, total_usd, currency, fx_slsh_per_usd").eq("created_by", s.user.id).eq("status", "active").gte("created_at", today.start!),
    s.supabase.from("banjarka_records").select("worker_share, worker_share_usd, currency, fx_slsh_per_usd").eq("created_by", s.user.id).eq("status", "active").gte("work_date", monthStart()),
  ]);
  const salesToday = (mySales.data ?? []).reduce((a, x) => a + inCurrency(x.total, x.total_usd, x.currency, x.fx_slsh_per_usd, cur), 0);
  const shareMonth = (myBj.data ?? []).reduce((a, x) => a + inCurrency(x.worker_share, x.worker_share_usd, x.currency, x.fx_slsh_per_usd, cur), 0);
  const names = Object.fromEntries(products.map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader title={t("dash.greeting", { name: s.membership.full_name.split(/[\s(]/)[0] })} subtitle={fmtLongDate(new Date(), lang)} />
      <FxWidget rate={fx?.rate ?? null} staleHours={fx?.staleHours ?? 24} canChange={false} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">{t("common.yourWork")}</h2>
        <DisplayCurrencyToggle value={cur} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <WorkTile href="/spare-parts" icon="cart" title={t("nav.spareParts")} desc={t("dash.tileSaleDesc")} cta={t("dash.tileSaleCta")}
          metaLabel={t("dash.mySalesToday")} meta={fmtMoney(salesToday, cur)} />
        <WorkTile href="/banjarka" icon="wrench" title={t("nav.banjarka")} desc={t("dash.tileBjDesc")} cta={t("dash.tileBjCta")}
          metaLabel={t("dash.myShareMonth")} meta={fmtMoney(shareMonth, cur)} navy />
      </div>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <div>
          <SectionHeader title={`${t("dash.lowStockTitle")} (${low.length})`} action={<Link href="/inventory" className="text-[13px] font-semibold text-brand-700">{t("common.viewAll")}</Link>} />
          <LowStock products={low} images={images} empty={t("empty.lowStock")} pcs={t("common.pcs")} />
        </div>
        <div>
          <SectionHeader title={t("dash.recentSales")} action={<Link href="/spare-parts" className="text-[13px] font-semibold text-brand-700">{t("common.viewAll")}</Link>} />
          <SalesList rows={recent} products={names} ctx={{ userId: s.user.id, isAdmin: false, names: staff.names }} actions={false} />
        </div>
      </div>
    </>
  );
}

/** One record in the display currency: its entered amount, or its USD total at the rate saved on it. */
function inCurrency(native: unknown, usd: unknown, currency: Currency, rate: unknown, cur: Currency) {
  if (cur === "USD") return num(usd);
  return currency === "SLSH" ? num(native) : num(usd) * num(rate);
}

function Quick({ href, icon, label, primary }: { href: string; icon: IconName; label: string; primary?: boolean }) {
  return (
    <Link href={href} className={`flex min-h-[4.5rem] items-center gap-3 rounded-2xl border p-3.5 font-semibold transition active:scale-[.98] ${
      primary ? "border-brand-600 bg-brand-600 text-white shadow-sm hover:bg-brand-700" : "border-line bg-white text-ink hover:border-brand-300"}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${primary ? "bg-white/15" : "bg-brand-50 text-brand-700"}`}>
        <Icon name={icon} />
      </span>
      <span className="min-w-0 text-[14px] leading-tight">{label}</span>
    </Link>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-3">
      <div className="truncate text-[11.5px] font-semibold text-muted">{label}</div>
      <div className="num mt-1 truncate text-[17px] font-extrabold text-navy-900 sm:text-[19px]">{value}</div>
    </div>
  );
}

function WorkTile({ href, icon, title, desc, cta, metaLabel, meta, navy }: {
  href: string; icon: IconName; title: string; desc: string; cta: string; metaLabel: string; meta: string; navy?: boolean;
}) {
  return (
    <Link href={href} className={`group relative overflow-hidden rounded-2xl p-5 text-white shadow-[var(--shadow-card)] transition active:scale-[.99] sm:p-6 ${
      navy ? "bg-gradient-to-br from-navy-800 to-navy-950" : "bg-gradient-to-br from-brand-500 to-brand-700"}`}>
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><Icon name={icon} className="h-6 w-6" /></span>
      <h3 className="mt-4 text-[22px] font-extrabold">{title}</h3>
      <p className="mt-1 text-[14px] text-white/80">{desc}</p>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-[14px] font-bold text-navy-900 transition group-hover:gap-3">
          <Icon name="plus" className="h-4 w-4" /> {cta}
        </span>
        <span className="text-right">
          <span className="block text-[11.5px] text-white/70">{metaLabel}</span>
          <span className="num block text-[18px] font-extrabold">{meta}</span>
        </span>
      </div>
    </Link>
  );
}

function LowStock({ products, images, empty, pcs }: { products: Product[]; images: Record<string, string>; empty: string; pcs: string }) {
  if (!products.length) return <EmptyState icon="checkCircle" text={empty} />;
  return (
    <ul className="card-tight divide-y divide-line">
      {products.slice(0, 6).map((p) => (
        <li key={p.id} className="flex items-center gap-3 px-4 py-3">
          <ProductThumb product={p} url={p.image_path ? images[p.image_path] : undefined} />
          <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
          <span className={`badge num ${p.stock_qty <= 0 ? "badge-red" : "badge-amber"}`}>{fmtInt(p.stock_qty)} {pcs}</span>
        </li>
      ))}
    </ul>
  );
}

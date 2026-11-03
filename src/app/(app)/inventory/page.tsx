import Link from "next/link";
import { requireMember } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { listProducts, signedImageUrls } from "@/lib/data";
import { fmtInt, fmtMoney, fmtUsd, fmtUsdPrecise, fmtWorkDate, num } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { PageHeader, SectionHeader, StatCard } from "@/components/kit";
import { InventoryBrowser } from "@/components/InventoryBrowser";

export const metadata = { title: "Inventory" };

type Receipt = {
  id: string; supplier: string; purchased_on: string | null; currency: "USD" | "SLSH"; discount: number; total: number; note: string | null;
  purchase_items: { id: string; description: string; quantity: number; line_total: number; unit_cost: number }[];
};

/** Staff: read-only stock view. Admins: full management. */
export default async function InventoryPage() {
  const s = await requireMember();
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const [products, receipts] = await Promise.all([
    listProducts(s.supabase, s.business.id, { includeArchived: s.isAdmin }),
    s.isAdmin
      ? s.supabase.from("purchases").select("*, purchase_items(*)").eq("business_id", s.business.id).order("purchased_on", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const images = await signedImageUrls(s.supabase, products.map((p) => p.image_path));
  const active = products.filter((p) => p.status === "active");
  const units = active.reduce((a, p) => a + p.stock_qty, 0);
  const retail = active.reduce((a, p) => a + p.stock_qty * (p.sell_price_usd ?? 0), 0);
  const low = active.filter((p) => p.stock_qty <= p.low_stock_threshold).length;
  const list = (receipts.data ?? []) as Receipt[];

  return (
    <>
      <PageHeader
        title={t("inv.title")}
        subtitle={s.isAdmin ? t("inv.subtitle") : <span className="badge badge-slate"><Icon name="eye" className="h-3 w-3" /> {t("inv.viewOnly")}</span>}
        actions={s.isAdmin && <Link href="/inventory/new" className="btn"><Icon name="plus" /> {t("inv.add")}</Link>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="package" label={t("dash.products")} value={fmtInt(active.length)} />
        <StatCard icon="grid" tone="navy" label={t("inv.units")} value={fmtInt(units)} />
        <StatCard icon="tag" tone="green" label={t("inv.retailValue")} value={fmtUsd(retail)} />
        <StatCard icon="alert" tone="amber" label={t("dash.lowStockCount")} value={fmtInt(low)} />
      </div>
      <InventoryBrowser products={products} images={images} canEdit={s.isAdmin} />

      {s.isAdmin && list.length > 0 && (
        <>
          <SectionHeader title={t("inv.receipts")} />
          <p className="hint -mt-1 mb-3">{t("inv.receiptsNote")}</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {list.map((r) => (
              <div key={r.id} className="card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-bold">{r.supplier}</h3>
                  <span className="text-[13px] text-muted">{r.purchased_on ? fmtWorkDate(r.purchased_on, lang) : "—"}</span>
                </div>
                <ul className="mt-2">
                  {r.purchase_items.map((i) => (
                    <li key={i.id} className="row text-[14px]">
                      <span className="min-w-0">{i.description} <span className="text-muted">× {fmtInt(i.quantity)}</span></span>
                      <span className="num shrink-0 text-right">{fmtMoney(i.line_total, r.currency)}<span className="block text-[12px] text-muted">{fmtUsdPrecise(i.unit_cost)}</span></span>
                    </li>
                  ))}
                </ul>
                <div className="num mt-2 text-right text-[14px] font-bold">
                  {num(r.discount) > 0 && <span className="mr-3 font-normal text-muted">− {fmtMoney(r.discount, r.currency)}</span>}
                  {t("common.total")}: {fmtMoney(r.total, r.currency)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

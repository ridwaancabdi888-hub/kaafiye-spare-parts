import Link from "next/link";
import { getFx, requireAdmin } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { listProducts, signedImageUrls } from "@/lib/data";
import { fmtDate, fmtInt, fmtMoney, fmtUsd, fmtUsdPrecise, num } from "@/lib/format";
import { FxWidget } from "@/components/FxWidget";
import { PageHeader } from "@/components/PageHeader";
import { StockTable } from "@/components/StockTable";
import { stockBadge } from "@/lib/stock";
import { ProductThumb } from "@/components/ProductIcon";

export const metadata = { title: "Inventory" };

type Receipt = {
  id: string; supplier: string; invoice_ref: string | null; purchased_on: string | null; currency: "USD" | "SLSH";
  discount: number; total: number; note: string | null;
  purchase_items: { id: string; description: string; quantity: number; line_total: number; unit_cost: number }[];
};

export default async function InventoryPage() {
  const s = await requireAdmin();
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const [fx, products, receipts] = await Promise.all([
    getFx(s.business.id),
    listProducts(s.supabase, s.business.id, { includeArchived: true }),
    s.supabase.from("purchases").select("*, purchase_items(*)").eq("business_id", s.business.id).order("purchased_on", { ascending: false }),
  ]);
  const images = await signedImageUrls(s.supabase, products.map((p) => p.image_path));
  const active = products.filter((p) => p.status === "active");

  return (
    <>
      <PageHeader title={t("inv.title")} />
      <FxWidget rate={fx?.rate ?? null} staleHours={fx?.staleHours ?? 24} canChange />

      <div className="section-head">
        <h2>{t("inv.withPhotos")}</h2>
        <Link href="/inventory/new" className="btn">{t("inv.add")}</Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {active.map((p) => {
          const b = stockBadge(p);
          return (
            <Link key={p.id} href={`/inventory/${p.id}`} className="overflow-hidden rounded-[15px] border border-[#e3ebed] bg-white transition hover:shadow-md">
              <ProductThumb product={p} url={p.image_path ? images[p.image_path] : undefined} size="lg" />
              <div className="p-4">
                <strong className="mb-2 block leading-snug">{p.name}</strong>
                <small className="mb-2.5 block text-[#6c8289]">
                  {fmtInt(p.stock_qty)} {p.unit} • {p.category ?? (p.condition ? t(p.condition === "used" ? "inv.used" : "inv.new") : "—")}
                  <span className={`ml-1 font-bold ${b.cls}`}>• {t(b.key)}</span>
                </small>
                <div className="text-lg font-extrabold text-[#0f8068] sm:text-xl">{fmtUsdPrecise(p.cost_usd)} {t("inv.cost")}</div>
                <div className="muted">{p.sell_price_usd !== null ? `→ ${fmtUsd(p.sell_price_usd)}` : t("inv.priceNotSet")}</div>
              </div>
            </Link>
          );
        })}
        {!active.length && <p className="muted col-span-full">{t("common.none")}</p>}
      </div>

      <div className="section-head">
        <h2>{t("inv.stockHistory")}</h2>
        <span className="tag">{t("common.edit")} • {t("inv.archive")} • {t("inv.photo")}</span>
      </div>
      <StockTable products={products} linkToEdit />

      <div className="section-head">
        <h2>{t("inv.receipts")}</h2>
      </div>
      <p className="muted mb-3">{t("inv.receiptsNote")}</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {((receipts.data ?? []) as Receipt[]).map((r) => (
          <div key={r.id} className="card">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-bold">{r.supplier}</h3>
              <span className="muted">{r.purchased_on ? fmtDate(`${r.purchased_on}T12:00:00+03:00`, lang) : "—"}</span>
            </div>
            <ul>
              {r.purchase_items.map((i) => (
                <li key={i.id} className="row-item text-sm">
                  <span>{i.description} — {fmtInt(i.quantity)} PCS</span>
                  <span>{fmtMoney(i.line_total, r.currency)} <span className="muted">({fmtUsdPrecise(i.unit_cost)})</span></span>
                </li>
              ))}
            </ul>
            <div className="mt-2 text-right text-sm">
              {num(r.discount) > 0 && <span className="muted mr-3">− {fmtMoney(r.discount, r.currency)}</span>}
              <b>{t("common.total")}: {fmtMoney(r.total, r.currency)}</b>
            </div>
            {r.note && <p className="muted mt-2">{r.note}</p>}
          </div>
        ))}
        {!receipts.data?.length && <p className="muted">{t("common.none")}</p>}
      </div>
    </>
  );
}

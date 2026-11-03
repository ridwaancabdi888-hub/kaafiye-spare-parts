import { notFound } from "next/navigation";
import { getStaffNames, requireAdmin } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { signedImageUrls } from "@/lib/data";
import { stockBadge } from "@/lib/stock";
import { fmtDateTime, fmtInt, fmtUsdPrecise } from "@/lib/format";
import type { DictKey } from "@/lib/i18n/dict";
import type { Product } from "@/lib/types";
import { DataTable, EmptyState, PageHeader, SectionHeader } from "@/components/kit";
import { ProductForm } from "../ProductForm";
import { ArchiveButton, StockAdjustForm } from "./StockAdjustForm";

export const metadata = { title: "Product" };

type Movement = {
  id: number; qty_change: number; balance_after: number; kind: string; unit_cost_usd: number | null;
  note: string | null; created_by: string | null; created_at: string;
};
const BADGE = { "common.inStock": "badge-green", "common.lowStock": "badge-amber", "common.outOfStock": "badge-red", "common.archived": "badge-slate" } as const;

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireAdmin();
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const { data } = await s.supabase.from("products").select("*").eq("id", id).eq("business_id", s.business.id).maybeSingle<Product>();
  if (!data) notFound();
  const product = { ...data, cost_usd: Number(data.cost_usd), sell_price_usd: data.sell_price_usd === null ? null : Number(data.sell_price_usd) };
  const [images, movements, staff] = await Promise.all([
    signedImageUrls(s.supabase, [product.image_path]),
    s.supabase.from("stock_movements").select("*").eq("product_id", id).order("id", { ascending: false }).limit(100),
    getStaffNames(s.business.id),
  ]);
  const b = stockBadge(product);
  const rows = (movements.data ?? []) as Movement[];
  const qty = (m: Movement) => <span className={`num font-bold ${m.qty_change > 0 ? "text-brand-700" : "text-rose-600"}`}>{m.qty_change > 0 ? "+" : ""}{m.qty_change}</span>;

  return (
    <>
      <PageHeader
        title={product.name}
        back={{ href: "/inventory", label: t("inv.title") }}
        subtitle={<span className="flex flex-wrap items-center gap-2"><span className={`badge ${BADGE[b.key]}`}>{t(b.key)}</span><span className="num font-semibold text-ink">{t("inv.stockNow")}: {fmtInt(product.stock_qty)} {t("common.pcs")}</span></span>}
        actions={<ArchiveButton productId={product.id} status={product.status} />}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-start">
        <ProductForm product={product} imageUrl={product.image_path ? images[product.image_path] : undefined} businessId={s.business.id} />
        <StockAdjustForm productId={product.id} />
      </div>

      <SectionHeader title={t("inv.movements")} />
      <DataTable
        rows={rows}
        rowKey={(m) => String(m.id)}
        empty={<EmptyState icon="history" text={t("empty.history")} />}
        columns={[
          { header: t("common.date"), cell: (m) => <span className="whitespace-nowrap text-[13px]">{fmtDateTime(m.created_at, lang)}</span> },
          { header: t("exp.kind"), cell: (m) => t(`inv.kind.${m.kind}` as DictKey) },
          { header: t("inv.qtyChange"), cell: qty },
          { header: t("inv.stockNow"), cell: (m) => <span className="num">{m.balance_after}</span> },
          { header: t("inv.costUsd"), cell: (m) => <span className="num">{m.unit_cost_usd !== null ? fmtUsdPrecise(m.unit_cost_usd) : "—"}</span> },
          { header: t("common.employee"), cell: (m) => (m.created_by ? staff.names[m.created_by] ?? "—" : "—") },
          { header: t("field.note"), cell: (m) => <span className="text-[13px] text-muted">{m.note ?? ""}</span> },
        ]}
        card={(m) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">{t(`inv.kind.${m.kind}` as DictKey)}</div>
              <div className="text-[12.5px] text-muted">{fmtDateTime(m.created_at, lang)}{m.created_by && staff.names[m.created_by] ? ` · ${staff.names[m.created_by]}` : ""}</div>
              {m.note && <div className="mt-1 text-[13px] text-muted">{m.note}</div>}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-lg">{qty(m)}</div>
              <div className="num text-[12px] text-muted">= {m.balance_after}</div>
            </div>
          </div>
        )}
      />
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaffNames, requireAdmin } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { signedImageUrls } from "@/lib/data";
import { fmtDateTime, fmtInt, fmtUsdPrecise } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import type { DictKey } from "@/lib/i18n/dict";
import type { Product } from "@/lib/types";
import { ProductForm } from "../ProductForm";
import { ArchiveButton, StockAdjustForm } from "./StockAdjustForm";

export const metadata = { title: "Product" };

type Movement = {
  id: number; qty_change: number; balance_after: number; kind: string; unit_cost_usd: number | null;
  note: string | null; created_by: string | null; created_at: string;
};

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

  return (
    <>
      <PageHeader title={product.name} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/inventory" className="muted hover:underline">{t("common.back")}</Link>
        <div className="flex items-center gap-3">
          <span className="pill">{t("inv.stock")}: {fmtInt(product.stock_qty)} {product.unit}</span>
          <ArchiveButton productId={product.id} status={product.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-[1.4fr_.6fr]">
        <ProductForm product={product} imageUrl={product.image_path ? images[product.image_path] : undefined} businessId={s.business.id} />
        <StockAdjustForm productId={product.id} />
      </div>

      <div className="section-head"><h2>{t("inv.movements")}</h2></div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t("common.date")}</th>
              <th>{t("exp.kind")}</th>
              <th>{t("inv.qtyChange")}</th>
              <th>{t("inv.stock")}</th>
              <th>{t("inv.costUsd")}</th>
              <th>{t("common.employee")}</th>
              <th>{t("common.note")}</th>
            </tr>
          </thead>
          <tbody>
            {((movements.data ?? []) as Movement[]).map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap">{fmtDateTime(m.created_at, lang)}</td>
                <td>{t(`inv.kind.${m.kind}` as DictKey)}</td>
                <td className={`font-bold ${m.qty_change > 0 ? "text-ok" : "text-bad"}`}>{m.qty_change > 0 ? "+" : ""}{m.qty_change}</td>
                <td>{m.balance_after}</td>
                <td>{m.unit_cost_usd !== null ? fmtUsdPrecise(m.unit_cost_usd) : "—"}</td>
                <td>{m.created_by ? staff.names[m.created_by] ?? "—" : "—"}</td>
                <td className="muted">{m.note ?? ""}</td>
              </tr>
            ))}
            {!movements.data?.length && (
              <tr><td colSpan={7} className="text-center text-muted">{t("common.none")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

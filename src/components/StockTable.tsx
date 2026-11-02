"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { fmtInt, fmtUsd, fmtUsdPrecise } from "@/lib/format";
import type { Product } from "@/lib/types";

export function stockBadge(p: Pick<Product, "stock_qty" | "low_stock_threshold" | "status">) {
  if (p.status === "archived") return { key: "common.archived", cls: "text-muted" } as const;
  if (p.stock_qty <= 0) return { key: "common.outOfStock", cls: "text-bad" } as const;
  if (p.stock_qty <= p.low_stock_threshold) return { key: "common.lowStock", cls: "text-warn" } as const;
  return { key: "common.inStock", cls: "text-ok" } as const;
}

export function StockTable({ products, linkToEdit = false, showSearch = true }: {
  products: Product[];
  linkToEdit?: boolean;
  showSearch?: boolean;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => {
      if (lowOnly && p.stock_qty > p.low_stock_threshold) return false;
      if (!s) return true;
      return [p.name, p.name_en, p.sku, p.tyre_size, p.category].some((v) => v?.toLowerCase().includes(s));
    });
  }, [products, q, lowOnly]);

  return (
    <div>
      {showSearch && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input className="input max-w-xs" placeholder={`🔍  ${t("sp.searchPlaceholder")}`} value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-label">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> {t("common.lowStock")}
          </label>
        </div>
      )}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t("sp.product")} / Product</th>
              <th>{t("common.quantity")}</th>
              <th>{t("inv.costUsd").replace(" (USD)", "")}</th>
              <th>{t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const b = stockBadge(p);
              return (
                <tr key={p.id}>
                  <td>
                    {linkToEdit ? <Link className="font-bold hover:underline" href={`/inventory/${p.id}`}>{p.name}</Link> : p.name}
                    {p.tyre_size && <span className="muted"> • {p.tyre_size}</span>}
                  </td>
                  <td>{fmtInt(p.stock_qty)} {p.unit}</td>
                  <td>
                    {fmtUsdPrecise(p.cost_usd)} {t("inv.cost")}
                    {p.sell_price_usd !== null && <div className="muted">→ {fmtUsd(p.sell_price_usd)}</div>}
                  </td>
                  <td className={`font-bold ${b.cls}`}>{t(b.key)}</td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="text-center text-muted">{t("common.none")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { fmtInt, fmtUsd, fmtUsdPrecise } from "@/lib/format";
import { stockBadge } from "@/lib/stock";
import type { Product } from "@/lib/types";
import { Icon } from "./Icon";
import { EmptyState } from "./kit";
import { ProductThumb } from "./ProductIcon";

type Filter = "all" | "low" | "out" | "archived";
const BADGE = { "common.inStock": "badge-green", "common.lowStock": "badge-amber", "common.outOfStock": "badge-red", "common.archived": "badge-slate" } as const;

export function InventoryBrowser({ products, images, canEdit }: { products: Product[]; images: Record<string, string>; canEdit: boolean }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const counts = useMemo(() => {
    const active = products.filter((p) => p.status === "active");
    return {
      all: active.length,
      low: active.filter((p) => p.stock_qty > 0 && p.stock_qty <= p.low_stock_threshold).length,
      out: active.filter((p) => p.stock_qty <= 0).length,
      archived: products.length - active.length,
    };
  }, [products]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === "archived" ? p.status !== "archived" : p.status !== "active") return false;
      if (filter === "low" && !(p.stock_qty > 0 && p.stock_qty <= p.low_stock_threshold)) return false;
      if (filter === "out" && p.stock_qty > 0) return false;
      return !s || [p.name, p.name_en, p.sku, p.tyre_size, p.category].some((v) => v?.toLowerCase().includes(s));
    });
  }, [products, q, filter]);

  const filters: [Filter, string][] = [["all", t("inv.filterAll")], ["low", t("inv.filterLow")], ["out", t("inv.filterOut")]];
  if (canEdit && counts.archived) filters.push(["archived", t("inv.filterArchived")]);

  return (
    <div>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input className="input pl-12" type="search" placeholder={t("sp.searchPlaceholder")} aria-label={t("common.search")}
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {filters.map(([f, label]) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`chip ${filter === f ? "chip-active" : ""}`} aria-pressed={filter === f}>
            {label}
            <span className={`ml-1.5 rounded-full px-1.5 text-[11px] ${filter === f ? "bg-white/20" : "bg-slate-100 text-muted"}`}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {rows.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
          {rows.map((p) => {
            const b = stockBadge(p);
            const body = (
              <>
                <ProductThumb product={p} url={p.image_path ? images[p.image_path] : undefined} size="lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:p-4">
                  <div className="line-clamp-2 min-h-[2.5em] text-[14px] font-bold leading-tight text-ink sm:text-[15px]">{p.name}</div>
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="num text-[22px] font-extrabold leading-none text-navy-900">{fmtInt(p.stock_qty)}</span>
                    <span className="text-[12px] text-muted">{t("common.pcs")}</span>
                  </div>
                  <span className={`badge ${BADGE[b.key]} w-fit`}>{t(b.key)}</span>
                  <div className="mt-auto pt-1 text-[13px]">
                    <div className="num font-bold text-brand-700">
                      {p.sell_price_usd !== null ? t("inv.price", { v: fmtUsd(p.sell_price_usd) }) : <span className="text-muted">{t("inv.priceNotSet")}</span>}
                    </div>
                    {canEdit && (
                      <div className={`num text-[12px] ${p.cost_usd > 0 && p.cost_confirmed ? "text-muted" : "font-semibold text-amber-700"}`}>
                        {p.cost_usd <= 0 ? t("inv.costNotSet") : p.cost_confirmed ? t("inv.cost", { v: fmtUsdPrecise(p.cost_usd) })
                          : t("inv.costUnconfirmed", { v: fmtUsdPrecise(p.cost_usd) })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
            return (
              <li key={p.id} className="min-w-0">
                {canEdit ? (
                  <Link href={`/inventory/${p.id}`} className="card-tight flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
                    {body}
                  </Link>
                ) : (
                  <div className="card-tight flex h-full flex-col overflow-hidden">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4"><EmptyState text={t("empty.products")} /></div>
      )}
    </div>
  );
}

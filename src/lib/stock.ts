import type { Product } from "./types";

/** Shared by server and client components. */
export function stockBadge(p: Pick<Product, "stock_qty" | "low_stock_threshold" | "status">) {
  if (p.status === "archived") return { key: "common.archived", cls: "text-muted" } as const;
  if (p.stock_qty <= 0) return { key: "common.outOfStock", cls: "text-bad" } as const;
  if (p.stock_qty <= p.low_stock_threshold) return { key: "common.lowStock", cls: "text-warn" } as const;
  return { key: "common.inStock", cls: "text-ok" } as const;
}

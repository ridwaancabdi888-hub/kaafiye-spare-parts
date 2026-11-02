import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "./types";

export const IMAGE_BUCKET = "product-images";

export async function listProducts(supabase: SupabaseClient, businessId: string, opts: { includeArchived?: boolean } = {}) {
  let q = supabase.from("products").select("*").eq("business_id", businessId).order("name");
  if (!opts.includeArchived) q = q.eq("status", "active");
  const { data } = await q;
  return ((data ?? []) as Product[]).map((p) => ({
    ...p,
    cost_usd: Number(p.cost_usd),
    sell_price_usd: p.sell_price_usd === null ? null : Number(p.sell_price_usd),
  }));
}

/** Short-lived signed URLs for private product images (bucket is not public). */
export async function signedImageUrls(supabase: SupabaseClient, paths: (string | null)[]) {
  const list = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (!list.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(list, 60 * 60);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl])) as Record<string, string>;
}

export function stockState(p: Pick<Product, "stock_qty" | "low_stock_threshold" | "status">) {
  if (p.status === "archived") return "archived" as const;
  if (p.stock_qty <= 0) return "out" as const;
  if (p.stock_qty <= p.low_stock_threshold) return "low" as const;
  return "ok" as const;
}

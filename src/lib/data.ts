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

/**
 * Active sales whose profit is uncertain: sold with no cost price, or of a product whose cost the
 * owner has not confirmed yet. Their gross profit must not be read as exact.
 */
export async function uncertainCostSales(supabase: SupabaseClient, businessId: string, iso: { start: string | null; end: string | null }) {
  const { data: unconfirmed } = await supabase.from("products").select("id").eq("business_id", businessId).eq("cost_confirmed", false);
  const ids = (unconfirmed ?? []).map((p) => p.id as string);
  let q = supabase.from("sales").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "active")
    .or(ids.length ? `unit_cost_usd.eq.0,product_id.in.(${ids.join(",")})` : "unit_cost_usd.eq.0");
  if (iso.start) q = q.gte("created_at", iso.start);
  if (iso.end) q = q.lt("created_at", iso.end);
  return (await q).count ?? 0;
}

/** Short-lived signed URLs for private product images (bucket is not public). */
export async function signedImageUrls(supabase: SupabaseClient, paths: (string | null)[]) {
  const list = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (!list.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(list, 60 * 60);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl])) as Record<string, string>;
}

"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { errorKey, type ActionState } from "@/lib/errors";
import type { DictKey } from "@/lib/i18n/dict";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v.trim() : "";
};
const numOrNull = (f: FormData, k: string) => {
  const v = str(f, k).replace(/,/g, "");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const fail = (error: DictKey): ActionState => ({ error, at: Date.now() });
const done = (id?: string): ActionState => ({ ok: true, id, at: Date.now() });

/** Re-verifies admin role server-side on every call (never trust the page that rendered the form). */
async function adminCtx() {
  const s = await getSession();
  if (!s?.isAdmin || !s.membership) return null;
  return { supabase: s.supabase, businessId: s.membership.business_id, userId: s.user.id };
}

// ───────────── Inventory ─────────────

function productFields(f: FormData) {
  const cost = numOrNull(f, "cost_usd");
  const sell = numOrNull(f, "sell_price_usd");
  const low = numOrNull(f, "low_stock_threshold");
  const condition = str(f, "condition");
  return {
    name: str(f, "name"),
    name_en: str(f, "name_en") || null,
    category: str(f, "category") || null,
    sku: str(f, "sku") || null,
    tyre_size: str(f, "tyre_size") || null,
    condition: condition === "new" || condition === "used" ? condition : null,
    unit: str(f, "unit") || "PCS",
    cost_usd: cost ?? 0,
    sell_price_usd: sell,
    supplier: str(f, "supplier") || null,
    low_stock_threshold: low ?? 3,
  };
}
const badNumbers = (p: ReturnType<typeof productFields>) =>
  [p.cost_usd, p.sell_price_usd ?? 0, p.low_stock_threshold].some((n) => Number.isNaN(n) || n < 0) ||
  !Number.isInteger(p.low_stock_threshold);

export async function createProduct(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await adminCtx();
  if (!ctx) return fail("err.ADMIN_ONLY");
  const fields = productFields(f);
  if (!fields.name) return fail("err.REQUIRED");
  if (badNumbers(fields)) return fail("err.INVALID_AMOUNT");
  const opening = numOrNull(f, "opening_stock");
  if (opening !== null && (Number.isNaN(opening) || !Number.isInteger(opening) || opening < 0)) return fail("err.INVALID_QUANTITY");

  const { data, error } = await ctx.supabase.from("products").insert({ ...fields, business_id: ctx.businessId }).select("id").single();
  if (error) return fail(errorKey(error));
  if (opening && opening > 0) {
    const r = await ctx.supabase.rpc("adjust_stock", {
      p_product_id: data.id, p_qty_change: opening, p_kind: "opening", p_note: null, p_unit_cost_usd: null,
    });
    if (r.error) return fail(errorKey(r.error));
  }
  revalidatePath("/inventory");
  return done(data.id);
}

export async function updateProduct(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await adminCtx();
  if (!ctx) return fail("err.ADMIN_ONLY");
  const fields = productFields(f);
  if (!fields.name) return fail("err.REQUIRED");
  if (badNumbers(fields)) return fail("err.INVALID_AMOUNT");
  const id = str(f, "id");
  const { error } = await ctx.supabase.from("products").update(fields).eq("id", id).eq("business_id", ctx.businessId);
  if (error) return fail(errorKey(error));
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  return done(id);
}

/** Called after the browser uploaded the photo directly to the private bucket (RLS-scoped). */
export async function setProductImage(productId: string, path: string): Promise<ActionState> {
  const ctx = await adminCtx();
  if (!ctx) return fail("err.ADMIN_ONLY");
  if (!path.startsWith(`${ctx.businessId}/${productId}/`)) return fail("err.generic");
  const { error } = await ctx.supabase.from("products").update({ image_path: path }).eq("id", productId).eq("business_id", ctx.businessId);
  if (error) return fail(errorKey(error));
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${productId}`);
  return done(productId);
}

export async function setProductStatus(productId: string, status: "active" | "archived"): Promise<ActionState> {
  const ctx = await adminCtx();
  if (!ctx) return fail("err.ADMIN_ONLY");
  const { error } = await ctx.supabase.from("products").update({ status }).eq("id", productId).eq("business_id", ctx.businessId);
  if (error) return fail(errorKey(error));
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${productId}`);
  return done(productId);
}

export async function adjustStock(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await adminCtx();
  if (!ctx) return fail("err.ADMIN_ONLY");
  const qty = numOrNull(f, "qty_change");
  const cost = numOrNull(f, "unit_cost_usd");
  if (qty === null || Number.isNaN(qty) || !Number.isInteger(qty) || qty === 0) return fail("err.INVALID_QUANTITY");
  if (Number.isNaN(cost)) return fail("err.INVALID_AMOUNT");
  const id = str(f, "product_id");
  const { error } = await ctx.supabase.rpc("adjust_stock", {
    p_product_id: id, p_qty_change: qty, p_kind: str(f, "kind"), p_note: str(f, "note") || null, p_unit_cost_usd: cost,
  });
  if (error) return fail(errorKey(error));
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  return done(id);
}

// ───────────── FX + settings ─────────────

export async function setFxRate(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await adminCtx();
  if (!ctx) return fail("err.ADMIN_ONLY");
  const rate = numOrNull(f, "rate");
  if (rate === null || Number.isNaN(rate)) return fail("err.INVALID_RATE");
  const { error } = await ctx.supabase.rpc("set_fx_rate", { p_slsh_per_usd: rate, p_note: str(f, "note") || null });
  if (error) return fail(errorKey(error));
  revalidatePath("/", "layout");
  return done();
}

export async function updateBusinessSettings(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await adminCtx();
  if (!ctx) return fail("err.ADMIN_ONLY");
  const hours = numOrNull(f, "fx_stale_hours");
  if (hours === null || Number.isNaN(hours) || hours < 1 || hours > 720) return fail("err.INVALID_AMOUNT");
  const { error } = await ctx.supabase.from("business_settings").update({
    fx_stale_hours: Math.round(hours),
    users_see_all_banjarka: f.get("users_see_all_banjarka") === "on",
    updated_at: new Date().toISOString(),
  }).eq("business_id", ctx.businessId);
  if (error) return fail(errorKey(error));
  revalidatePath("/", "layout");
  return done();
}

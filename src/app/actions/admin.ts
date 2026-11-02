"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorKey, type ActionState } from "@/lib/errors";
import { isValidUsername, loginToEmail } from "@/lib/staff";
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

export async function createProduct(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await adminCtx();
  if (!ctx) return fail("err.ADMIN_ONLY");
  const fields = productFields(f);
  if (!fields.name) return fail("err.REQUIRED");
  if ([fields.cost_usd, fields.sell_price_usd ?? 0, fields.low_stock_threshold].some((n) => Number.isNaN(n) || n < 0)) return fail("err.INVALID_AMOUNT");
  const opening = numOrNull(f, "opening_stock");
  if (opening !== null && (Number.isNaN(opening) || !Number.isInteger(opening) || opening < 0)) return fail("err.INVALID_QUANTITY");

  const { data, error } = await ctx.supabase.from("products").insert({ ...fields, business_id: ctx.businessId }).select("id").single();
  if (error) return fail(errorKey(error));
  if (opening && opening > 0) {
    const r = await ctx.supabase.rpc("adjust_stock", {
      p_product_id: data.id, p_qty_change: opening, p_kind: "opening", p_note: "Opening count", p_unit_cost_usd: null,
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
  if ([fields.cost_usd, fields.sell_price_usd ?? 0, fields.low_stock_threshold].some((n) => Number.isNaN(n) || n < 0)) return fail("err.INVALID_AMOUNT");
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

// ───────────── Staff accounts (service role, after admin check) ─────────────

async function createLogin(identifier: string, password: string, fullName: string): Promise<{ error: DictKey } | { userId: string; username: string | null }> {
  const login = identifier.toLowerCase();
  if (!login.includes("@") && !isValidUsername(login)) return { error: "err.REQUIRED" as const };
  if (password.length < 8) return { error: "err.WEAK_PASSWORD" as const };
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: loginToEmail(login),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }, // display only — roles live in public.memberships
  });
  if (error) return { error: /already|exists|registered/i.test(error.message) ? ("err.USERNAME_TAKEN" as const) : ("err.generic" as const) };
  return { userId: data.user.id, username: login.includes("@") ? null : login };
}

export async function createStaff(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await adminCtx();
  if (!ctx) return fail("err.ADMIN_ONLY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fail("users.serviceKeyMissing");
  const fullName = str(f, "full_name");
  const role = str(f, "role") === "admin" ? "admin" : "user";
  if (!fullName) return fail("err.REQUIRED");
  const created = await createLogin(str(f, "username"), String(f.get("password") ?? ""), fullName);
  if ("error" in created) return fail(created.error);

  const admin = createAdminClient();
  const { error } = await admin.from("memberships").insert({
    business_id: ctx.businessId, user_id: created.userId, role, full_name: fullName, username: created.username,
  });
  if (error) {
    await admin.auth.admin.deleteUser(created.userId);
    return fail(errorKey(error));
  }
  revalidatePath("/users");
  return done(created.userId);
}

async function targetInMyBusiness(userId: string) {
  const ctx = await adminCtx();
  if (!ctx || userId === ctx.userId) return null; // admins cannot lock themselves out
  const { data } = await ctx.supabase.from("memberships").select("user_id").eq("user_id", userId).eq("business_id", ctx.businessId).maybeSingle();
  return data ? ctx : null;
}

export async function setStaffActive(userId: string, active: boolean): Promise<ActionState> {
  const ctx = await targetInMyBusiness(userId);
  if (!ctx) return fail("err.ADMIN_ONLY");
  const admin = createAdminClient();
  const { error } = await admin.from("memberships").update({ active }).eq("user_id", userId).eq("business_id", ctx.businessId);
  if (error) return fail(errorKey(error));
  // Also block sign-in at the auth layer (RLS already denies data access once inactive).
  await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  revalidatePath("/users");
  return done(userId);
}

export async function resetStaffPassword(_: ActionState, f: FormData): Promise<ActionState> {
  const userId = str(f, "user_id");
  const ctx = await targetInMyBusiness(userId);
  if (!ctx) return fail("err.ADMIN_ONLY");
  const password = String(f.get("password") ?? "");
  if (password.length < 8) return fail("err.WEAK_PASSWORD");
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password });
  if (error) return fail("err.generic");
  return done(userId);
}

// ───────────── Super admin ─────────────

export async function createBusinessWithAdmin(_: ActionState, f: FormData): Promise<ActionState> {
  const s = await getSession();
  if (!s?.isSuper) return fail("err.SUPER_ADMIN_ONLY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fail("users.serviceKeyMissing");
  const name = str(f, "name");
  const slug = str(f, "slug").toLowerCase();
  const adminName = str(f, "admin_name");
  if (!name || !/^[a-z0-9-]{2,40}$/.test(slug) || !adminName) return fail("err.REQUIRED");

  const { data: businessId, error } = await s.supabase.rpc("create_business", { p_name: name, p_slug: slug });
  if (error) return fail(errorKey(error));
  const created = await createLogin(str(f, "admin_login"), String(f.get("admin_password") ?? ""), adminName);
  if ("error" in created) {
    revalidatePath("/super");
    return fail(created.error); // business exists; admin can be added again from the list
  }
  const { error: mErr } = await createAdminClient().from("memberships").insert({
    business_id: businessId, user_id: created.userId, role: "admin", full_name: adminName, username: created.username,
  });
  if (mErr) return fail(errorKey(mErr));
  revalidatePath("/super");
  return done(businessId as string);
}

export async function addBusinessAdmin(_: ActionState, f: FormData): Promise<ActionState> {
  const s = await getSession();
  if (!s?.isSuper) return fail("err.SUPER_ADMIN_ONLY");
  const businessId = str(f, "business_id");
  const adminName = str(f, "admin_name");
  if (!adminName || !businessId) return fail("err.REQUIRED");
  const created = await createLogin(str(f, "admin_login"), String(f.get("admin_password") ?? ""), adminName);
  if ("error" in created) return fail(created.error);
  const { error } = await createAdminClient().from("memberships").insert({
    business_id: businessId, user_id: created.userId, role: "admin", full_name: adminName, username: created.username,
  });
  if (error) return fail(errorKey(error));
  revalidatePath("/super");
  return done();
}

export async function setBusinessActive(businessId: string, active: boolean): Promise<ActionState> {
  const s = await getSession();
  if (!s?.isSuper) return fail("err.SUPER_ADMIN_ONLY");
  const { error } = await s.supabase.from("businesses").update({ active }).eq("id", businessId);
  if (error) return fail(errorKey(error));
  revalidatePath("/super");
  return done();
}

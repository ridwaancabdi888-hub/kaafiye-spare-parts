"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorKey, type ActionState } from "@/lib/errors";

// Thin wrappers: every rule (author, 5h window, stock, FX snapshot, audit) is enforced in Postgres.

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
const intOrNull = (f: FormData, k: string) => {
  const n = numOrNull(f, k);
  return n === null || Number.isNaN(n) ? n : Number.isInteger(n) ? n : NaN;
};
const currency = (f: FormData) => (str(f, "currency") === "SLSH" ? "SLSH" : "USD");

async function rpc(fn: string, args: Record<string, unknown>, paths: string[]): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: errorKey(error), at: Date.now() };
  paths.forEach((p) => revalidatePath(p));
  return { ok: true, id: typeof data === "string" ? data : undefined, at: Date.now() };
}

const SP_PATHS = ["/spare-parts", "/dashboard", "/inventory", "/expenses", "/reports"];
const BJ_PATHS = ["/banjarka", "/dashboard", "/reports"];

export async function recordSale(_: ActionState, f: FormData): Promise<ActionState> {
  const quantity = intOrNull(f, "quantity");
  const price = numOrNull(f, "unit_price");
  if (!str(f, "product_id")) return { error: "err.PRODUCT_NOT_FOUND", at: Date.now() };
  if (quantity === null || Number.isNaN(quantity)) return { error: "err.INVALID_QUANTITY", at: Date.now() };
  if (price === null || Number.isNaN(price)) return { error: "err.INVALID_AMOUNT", at: Date.now() };
  return rpc("record_sale", {
    p_product_id: str(f, "product_id"), p_quantity: quantity, p_unit_price: price,
    p_currency: currency(f), p_note: str(f, "note") || null,
  }, SP_PATHS);
}

export async function updateSale(_: ActionState, f: FormData): Promise<ActionState> {
  const quantity = intOrNull(f, "quantity");
  const price = numOrNull(f, "unit_price");
  if (quantity === null || Number.isNaN(quantity)) return { error: "err.INVALID_QUANTITY", at: Date.now() };
  if (price === null || Number.isNaN(price)) return { error: "err.INVALID_AMOUNT", at: Date.now() };
  return rpc("update_sale", {
    p_id: str(f, "id"), p_quantity: quantity, p_unit_price: price, p_currency: currency(f),
    p_note: str(f, "note") || null, p_reason: str(f, "edit_reason") || null,
  }, SP_PATHS);
}

export async function recordCashExpense(_: ActionState, f: FormData): Promise<ActionState> {
  const amount = numOrNull(f, "amount");
  if (amount === null || Number.isNaN(amount)) return { error: "err.INVALID_AMOUNT", at: Date.now() };
  return rpc("record_cash_expense", { p_amount: amount, p_currency: currency(f), p_reason: str(f, "reason") }, SP_PATHS);
}

export async function recordItemExpense(_: ActionState, f: FormData): Promise<ActionState> {
  const quantity = intOrNull(f, "quantity");
  if (quantity === null || Number.isNaN(quantity)) return { error: "err.INVALID_QUANTITY", at: Date.now() };
  return rpc("record_item_expense", { p_product_id: str(f, "product_id"), p_quantity: quantity, p_reason: str(f, "reason") }, SP_PATHS);
}

export async function updateExpense(_: ActionState, f: FormData): Promise<ActionState> {
  const amount = numOrNull(f, "amount");
  const quantity = intOrNull(f, "quantity");
  if (Number.isNaN(amount)) return { error: "err.INVALID_AMOUNT", at: Date.now() };
  if (Number.isNaN(quantity)) return { error: "err.INVALID_QUANTITY", at: Date.now() };
  return rpc("update_expense", {
    p_id: str(f, "id"), p_amount: amount, p_currency: currency(f), p_quantity: quantity,
    p_expense_reason: str(f, "reason"), p_edit_reason: str(f, "edit_reason") || null,
  }, SP_PATHS);
}

export async function recordBanjarka(_: ActionState, f: FormData): Promise<ActionState> {
  const gross = numOrNull(f, "gross");
  const expenses = numOrNull(f, "expenses") ?? 0;
  if (gross === null || Number.isNaN(gross) || Number.isNaN(expenses)) return { error: "err.INVALID_AMOUNT", at: Date.now() };
  return rpc("record_banjarka", {
    p_gross: gross, p_expenses: expenses, p_currency: currency(f),
    p_expense_reason: str(f, "expense_reason") || null, p_work_date: str(f, "work_date") || null,
    p_note: str(f, "note") || null,
  }, BJ_PATHS);
}

export async function updateBanjarka(_: ActionState, f: FormData): Promise<ActionState> {
  const gross = numOrNull(f, "gross");
  const expenses = numOrNull(f, "expenses") ?? 0;
  if (gross === null || Number.isNaN(gross) || Number.isNaN(expenses)) return { error: "err.INVALID_AMOUNT", at: Date.now() };
  return rpc("update_banjarka", {
    p_id: str(f, "id"), p_gross: gross, p_expenses: expenses, p_currency: currency(f),
    p_expense_reason: str(f, "expense_reason") || null, p_note: str(f, "note") || null,
    p_reason: str(f, "edit_reason") || null,
  }, BJ_PATHS);
}

const VOID_FN = { sales: "void_sale", expenses: "void_expense", banjarka_records: "void_banjarka" } as const;

export async function voidRecord(_: ActionState, f: FormData): Promise<ActionState> {
  const table = str(f, "table") as keyof typeof VOID_FN;
  if (!(table in VOID_FN)) return { error: "err.generic", at: Date.now() };
  return rpc(VOID_FN[table], { p_id: str(f, "id"), p_reason: str(f, "edit_reason") }, [...SP_PATHS, ...BJ_PATHS]);
}

// Rewards are a record of what the admin decided to give; nothing is paid or deducted automatically.
export async function recordReward(_: ActionState, f: FormData): Promise<ActionState> {
  const amount = numOrNull(f, "amount");
  if (!str(f, "user_id")) return { error: "err.REQUIRED", at: Date.now() };
  if (amount === null || Number.isNaN(amount)) return { error: "err.INVALID_AMOUNT", at: Date.now() };
  return rpc("record_reward", {
    p_user_id: str(f, "user_id"), p_amount: amount, p_currency: currency(f),
    p_reward_date: str(f, "reward_date") || null, p_reason: str(f, "reason"),
  }, ["/users"]);
}

export async function voidReward(_: ActionState, f: FormData): Promise<ActionState> {
  return rpc("void_reward", { p_id: str(f, "id"), p_reason: str(f, "reason") }, ["/users"]);
}

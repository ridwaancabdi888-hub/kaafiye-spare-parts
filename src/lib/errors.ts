import type { DictKey } from "./i18n/dict";

const KNOWN = [
  "INSUFFICIENT_STOCK", "PRODUCT_NOT_FOUND", "PRODUCT_ARCHIVED", "INVALID_QUANTITY", "INVALID_AMOUNT",
  "INVALID_CURRENCY", "INVALID_RATE", "REASON_REQUIRED", "EDIT_WINDOW_CLOSED", "NOT_AUTHOR", "NO_CHANGES",
  "RECORD_NOT_FOUND", "RECORD_VOIDED", "EXPENSES_EXCEED_GROSS", "DUPLICATE_BANJARKA_DAY", "INVALID_WORK_DATE",
  "NO_FX_RATE", "NOT_A_MEMBER", "ADMIN_ONLY", "SUPER_ADMIN_ONLY", "STOCK_CHANGE_VIA_RPC_ONLY", "USERNAME_TAKEN",
  "USERNAME_INVALID", "REQUIRED", "IMAGE_UPLOAD",
] as const;

/** Maps a Supabase/Postgres error to a translation key. Raw messages are never shown to users. */
export function errorKey(err: unknown): DictKey {
  const msg = typeof err === "string" ? err : (err as { message?: string; code?: string } | null)?.message ?? "";
  const code = (err as { code?: string } | null)?.code;
  const hit = KNOWN.find((k) => msg.includes(k));
  if (hit) return `err.${hit}` as DictKey;
  if (code === "23505") return msg.includes("username") ? "err.USERNAME_TAKEN" : "err.DUPLICATE";
  if (code === "23514" && msg.includes("stock_qty")) return "err.INSUFFICIENT_STOCK";
  return "err.generic";
}

export type ActionState =
  | { ok?: boolean; error?: DictKey; vars?: Record<string, string | number>; id?: string; at?: number }
  | undefined;

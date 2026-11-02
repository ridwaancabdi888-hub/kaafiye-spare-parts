export type Currency = "USD" | "SLSH";
export const CURRENCIES: Currency[] = ["USD", "SLSH"];
export const TIME_ZONE = "Africa/Mogadishu"; // Hargeisa local time (UTC+3)
export const EDIT_WINDOW_MS = 5 * 60 * 60 * 1000;

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdPreciseFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** $1,180.00 */
export const fmtUsd = (v: unknown) => usdFmt.format(num(v));
/** Unit costs like $0.625 keep up to 4 decimals. */
export const fmtUsdPrecise = (v: unknown) => usdPreciseFmt.format(num(v));
/** 118,000 SlSh */
export const fmtSlsh = (v: unknown) => `${(Math.abs(num(v) % 1) > 0 ? numFmt : intFmt).format(num(v))} SlSh`;
export const fmtMoney = (v: unknown, c: Currency) => (c === "USD" ? fmtUsd(v) : fmtSlsh(v));
export const fmtInt = (v: unknown) => intFmt.format(num(v));
export const fmtNum = (v: unknown) => numFmt.format(num(v));

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

export function toUsd(amount: number, currency: Currency, slshPerUsd: number) {
  return currency === "USD" ? amount : round4(amount / slshPerUsd);
}
export function fromUsd(usd: number, currency: Currency, slshPerUsd: number) {
  return currency === "USD" ? usd : usd * slshPerUsd;
}

/** Mirrors public._banjarka_values in SQL (UI preview only; the DB is authoritative). */
export function banjarkaSplit(gross: number, expenses: number) {
  const g = round2(gross);
  const e = round2(expenses || 0);
  if (!(g >= 0) || !(e >= 0)) return { ok: false as const, reason: "INVALID_AMOUNT" as const };
  if (e > g) return { ok: false as const, reason: "EXPENSES_EXCEED_GROSS" as const };
  const net = round2(g - e);
  const worker = round2(net / 2);
  return { ok: true as const, gross: g, expenses: e, net, worker, shop: round2(net - worker) };
}

export function fmtDateTime(iso: string | Date, lang: string) {
  return new Intl.DateTimeFormat(lang === "so" ? "en-GB" : "en-US", {
    timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}
export function fmtDate(iso: string | Date, lang: string) {
  return new Intl.DateTimeFormat(lang === "so" ? "en-GB" : "en-US", {
    timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));
}

/** YYYY-MM-DD in Hargeisa time. */
export function localDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function monthStart(d = new Date()) {
  return `${localDate(d).slice(0, 7)}-01`;
}

export type Period = "today" | "month" | "all" | "custom";
export function periodRange(period: Period, from?: string, to?: string): { from: string | null; to: string | null } {
  const today = localDate();
  if (period === "today") return { from: today, to: today };
  if (period === "month") return { from: monthStart(), to: today };
  if (period === "custom") {
    const ok = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
    return { from: ok(from), to: ok(to) };
  }
  return { from: null, to: null };
}
/** ISO bounds for created_at filters (Hargeisa is UTC+3, no DST). */
export function rangeToIso(r: { from: string | null; to: string | null }) {
  const start = r.from ? new Date(`${r.from}T00:00:00+03:00`).toISOString() : null;
  const end = r.to ? new Date(new Date(`${r.to}T00:00:00+03:00`).getTime() + 86400000).toISOString() : null;
  return { start, end };
}

export function editTimeLeft(createdAt: string, now = Date.now()) {
  return new Date(createdAt).getTime() + EDIT_WINDOW_MS - now;
}
export function fmtDuration(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

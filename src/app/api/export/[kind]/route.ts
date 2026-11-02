import { NextResponse, type NextRequest } from "next/server";
import { getSession, getStaffNames } from "@/lib/session";
import { periodRange, rangeToIso, type Period } from "@/lib/format";

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: Record<string, unknown>[], cols: string[]) =>
  [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\r\n");

const SPEC = {
  sales: { table: "sales", date: "created_at", cols: ["created_at", "employee", "product", "quantity", "unit_price", "currency", "total", "fx_slsh_per_usd", "total_usd", "unit_cost_usd", "cost_usd", "profit_usd", "status", "void_reason", "edit_count", "note", "id"] },
  expenses: { table: "expenses", date: "created_at", cols: ["created_at", "employee", "kind", "product", "quantity", "amount", "currency", "fx_slsh_per_usd", "amount_usd", "unit_cost_usd", "reason", "status", "void_reason", "edit_count", "id"] },
  banjarka: { table: "banjarka_records", date: "work_date", cols: ["work_date", "created_at", "employee", "currency", "gross", "expenses", "expense_reason", "net", "worker_share", "shop_share", "fx_slsh_per_usd", "gross_usd", "expenses_usd", "net_usd", "worker_share_usd", "shop_share_usd", "status", "void_reason", "edit_count", "id"] },
} as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const spec = SPEC[kind as keyof typeof SPEC];
  if (!spec) return NextResponse.json({ error: "not found" }, { status: 404 });
  const s = await getSession();
  if (!s?.isAdmin || !s.business) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const range = periodRange((sp.get("period") as Period) ?? "all", sp.get("from") ?? undefined, sp.get("to") ?? undefined);
  let q = s.supabase.from(spec.table).select("*").eq("business_id", s.business.id).order(spec.date, { ascending: true }).limit(10000);
  if (spec.date === "work_date") {
    if (range.from) q = q.gte("work_date", range.from);
    if (range.to) q = q.lte("work_date", range.to);
  } else {
    const iso = rangeToIso(range);
    if (iso.start) q = q.gte("created_at", iso.start);
    if (iso.end) q = q.lt("created_at", iso.end);
  }
  const [{ data, error }, staff, products] = await Promise.all([
    q,
    getStaffNames(s.business.id),
    s.supabase.from("products").select("id, name").eq("business_id", s.business.id),
  ]);
  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
  const pname = Object.fromEntries((products.data ?? []).map((p) => [p.id, p.name]));
  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    employee: staff.names[r.created_by as string] ?? r.created_by,
    product: r.product_id ? pname[r.product_id as string] ?? r.product_id : "",
  }));
  const name = `kaafiye-${kind}-${range.from ?? "start"}-${range.to ?? "now"}.csv`;
  return new NextResponse("﻿" + toCsv(rows, [...spec.cols]), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}

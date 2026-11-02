import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaffNames, requireAdmin } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { fmtDateTime, fmtMoney, fmtUsdPrecise, type Currency } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { RecordActions } from "@/components/RecordActions";
import type { DictKey } from "@/lib/i18n/dict";
import type { BanjarkaRecord, Expense, Revision, Sale } from "@/lib/types";

export const metadata = { title: "Record history" };

const FIELDS = {
  sales: ["quantity", "unit_price", "currency", "total", "total_usd", "profit_usd", "note", "status", "void_reason"],
  expenses: ["kind", "amount", "currency", "amount_usd", "quantity", "reason", "status", "void_reason"],
  banjarka_records: ["work_date", "currency", "gross", "expenses", "expense_reason", "net", "worker_share", "shop_share", "status", "void_reason"],
} as const;
type Table = keyof typeof FIELDS;

function show(key: string, row: Record<string, unknown>) {
  const v = row[key];
  if (v === null || v === undefined || v === "") return "—";
  const cur = row.currency as Currency;
  if (["unit_price", "total", "amount", "gross", "expenses", "net", "worker_share", "shop_share"].includes(key)) return fmtMoney(v, cur);
  if (key.endsWith("_usd")) return fmtUsdPrecise(v);
  return String(v);
}

export default async function HistoryPage({ params }: { params: Promise<{ table: string; id: string }> }) {
  const { table, id } = await params;
  if (!(table in FIELDS)) notFound();
  const tbl = table as Table;
  const s = await requireAdmin();
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const [{ data: record }, { data: revs }, staff] = await Promise.all([
    s.supabase.from(tbl).select("*").eq("id", id).eq("business_id", s.business.id).maybeSingle(),
    s.supabase.from("record_revisions").select("*").eq("table_name", tbl).eq("record_id", id).order("id"),
    getStaffNames(s.business.id),
  ]);
  if (!record) notFound();
  const revisions = (revs ?? []) as Revision[];
  const fields = FIELDS[tbl];

  return (
    <>
      <PageHeader title={`${t(`rep.table.${tbl}` as DictKey)} — ${t("rep.edits")}`} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/reports" className="muted hover:underline">{t("common.back")}</Link>
        {tbl === "sales" && <RecordActions table="sales" record={record as Sale} isOwn={record.created_by === s.user.id} isAdmin />}
        {tbl === "expenses" && <RecordActions table="expenses" record={record as Expense} isOwn={record.created_by === s.user.id} isAdmin />}
        {tbl === "banjarka_records" && <RecordActions table="banjarka_records" record={record as BanjarkaRecord} isOwn={record.created_by === s.user.id} isAdmin />}
      </div>
      <p className="muted mb-4">{t("rep.correctionHint")}</p>

      {/* Versions side by side, oldest first; changed fields highlighted. */}
      <div className="flex gap-[18px] overflow-x-auto pb-3">
        {revisions.map((v) => (
          <div key={v.id} className="card w-[300px] shrink-0">
            <h3 className="font-bold">
              {t(`rep.action.${v.action}` as DictKey)} • {fmtDateTime(v.created_at, lang)}
            </h3>
            <div className="muted mb-2">
              {t("rep.by")} {v.actor ? staff.names[v.actor] ?? "—" : "—"}
              {v.reason && <> • “{v.reason}”</>}
            </div>
            {fields.map((f) => {
              const changed = v.changed_fields.includes(f);
              return (
                <div key={f} className={`row-item text-sm ${changed ? "-mx-2 rounded-md bg-pill px-2" : ""}`}>
                  <span className="text-label">{f}</span>
                  <strong className={changed ? "text-ok" : ""}>
                    {changed && v.before && <span className="mr-1 font-normal text-bad line-through">{show(f, v.before)}</span>}
                    {show(f, v.after)}
                  </strong>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

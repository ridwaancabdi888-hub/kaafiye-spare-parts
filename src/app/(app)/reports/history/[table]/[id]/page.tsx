import { notFound } from "next/navigation";
import { getStaffNames, requireAdmin } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { fmtDateTime, fmtMoney, fmtUsdPrecise, fmtWorkDate, type Currency } from "@/lib/format";
import type { DictKey } from "@/lib/i18n/dict";
import type { BanjarkaRecord, Expense, Revision, Sale } from "@/lib/types";
import { Alert, EmptyState, PageHeader } from "@/components/kit";
import { RecordActions } from "@/components/RecordActions";

export const metadata = { title: "History" };

const FIELDS = {
  sales: ["quantity", "unit_price", "currency", "total", "total_usd", "profit_usd", "note", "status", "void_reason"],
  expenses: ["kind", "amount", "currency", "amount_usd", "quantity", "reason", "status", "void_reason"],
  banjarka_records: ["work_date", "currency", "gross", "expenses", "expense_reason", "net", "worker_share", "shop_share", "status", "void_reason"],
} as const;
type Table = keyof typeof FIELDS;
const MONEY = ["unit_price", "total", "amount", "gross", "expenses", "net", "worker_share", "shop_share"];

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

  const show = (key: string, row: Record<string, unknown>) => {
    const v = row[key];
    if (v === null || v === undefined || v === "") return "—";
    if (MONEY.includes(key)) return fmtMoney(v, row.currency as Currency);
    if (key.endsWith("_usd")) return fmtUsdPrecise(v);
    if (key === "work_date") return fmtWorkDate(String(v), lang);
    if (key === "status") return v === "voided" ? t("common.voided") : t("common.active");
    if (key === "kind") return v === "cash" ? t("exp.cash") : t("exp.item");
    if (key === "currency") return v === "SLSH" ? "SlSh" : "USD";
    return String(v);
  };

  return (
    <>
      <PageHeader
        title={`${t(`rep.table.${tbl}` as DictKey)} — ${t("rep.edits")}`}
        back={{ href: "/reports", label: t("rep.title") }}
        actions={
          tbl === "sales" ? <RecordActions table="sales" record={record as Sale} isOwn={record.created_by === s.user.id} isAdmin />
          : tbl === "expenses" ? <RecordActions table="expenses" record={record as Expense} isOwn={record.created_by === s.user.id} isAdmin />
          : <RecordActions table="banjarka_records" record={record as BanjarkaRecord} isOwn={record.created_by === s.user.id} isAdmin />
        }
      />
      <Alert tone="info" className="mb-4">{t("rep.correctionHint")}</Alert>
      {revisions.length ? (
        // Versions side by side (scroll sideways on phones), oldest first; changed fields highlighted.
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          {revisions.map((v) => (
            <div key={v.id} className="card w-[85vw] max-w-[320px] shrink-0 snap-start">
              <div className="font-bold">{t(`rep.action.${v.action}` as DictKey)}</div>
              <div className="text-[12.5px] text-muted">{fmtDateTime(v.created_at, lang)}</div>
              <div className="mt-1 text-[12.5px] text-muted">{t("rep.by", { name: v.actor ? staff.names[v.actor] ?? "—" : "—" })}{v.reason ? ` · “${v.reason}”` : ""}</div>
              <div className="mt-3">
                {FIELDS[tbl].map((f) => {
                  const changed = v.changed_fields.includes(f);
                  return (
                    <div key={f} className={`row text-[13.5px] ${changed ? "-mx-2 rounded-lg border-0 bg-brand-50 px-2" : ""}`}>
                      <span className="text-muted">{t(`field.${f}` as DictKey)}</span>
                      <span className="num text-right font-semibold">
                        {changed && v.before && <span className="mr-1.5 font-normal text-rose-600 line-through">{show(f, v.before)}</span>}
                        <span className={changed ? "text-brand-700" : ""}>{show(f, v.after)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="history" text={t("empty.history")} />
      )}
    </>
  );
}

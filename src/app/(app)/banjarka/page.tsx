import { getFx, getStaffNames, requireMember } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { fmtDate, fmtMoney, fmtUsd, localDate } from "@/lib/format";
import { FxWidget } from "@/components/FxWidget";
import { PageHeader } from "@/components/PageHeader";
import { RecordActions } from "@/components/RecordActions";
import type { BanjarkaRecord } from "@/lib/types";
import { BanjarkaForm } from "./BanjarkaForm";

export const metadata = { title: "Banjarka" };

export default async function BanjarkaPage() {
  const s = await requireMember();
  const [t, lang] = await Promise.all([getT(), getLang()]);
  // RLS decides visibility: own records, or all if admin / the business allows it.
  const [fx, staff, records] = await Promise.all([
    getFx(s.business.id),
    getStaffNames(s.business.id),
    s.supabase.from("banjarka_records").select("*").eq("business_id", s.business.id)
      .order("work_date", { ascending: false }).order("created_at", { ascending: false }).limit(60),
  ]);
  const rows = (records.data ?? []) as BanjarkaRecord[];

  return (
    <>
      <PageHeader title={t("bj.title")} />
      <FxWidget rate={fx?.rate ?? null} staleHours={fx?.staleHours ?? 24} canChange={s.isAdmin} />
      <BanjarkaForm today={localDate()} />

      <div className="section-head">
        <h2>{t("bj.history")}</h2>
        <span className="tag">{t("sp.editRule")}</span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t("bj.workDate")}</th>
              <th>{t("common.employee")}</th>
              <th>{t("bj.gross")}</th>
              <th>{t("bj.expenses")}</th>
              <th>{t("bj.net")}</th>
              <th>{t("bj.workerShare")}</th>
              <th>{t("bj.shopShare")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.status === "voided" ? "opacity-60" : ""}>
                <td className="whitespace-nowrap">
                  {fmtDate(`${r.work_date}T12:00:00+03:00`, lang)}
                  {r.edit_count > 0 && <div className="text-[11px] text-warn">✎ {t("common.edited")}</div>}
                </td>
                <td>{staff.names[r.created_by] ?? "—"}</td>
                <td>{fmtMoney(r.gross, r.currency)}</td>
                <td>
                  {fmtMoney(r.expenses, r.currency)}
                  {r.expense_reason && <div className="muted">{r.expense_reason}</div>}
                </td>
                <td>
                  <b>{fmtMoney(r.net, r.currency)}</b>
                  {r.currency === "SLSH" && <div className="muted">≈ {fmtUsd(r.net_usd)}</div>}
                </td>
                <td className="font-bold text-ok">{fmtMoney(r.worker_share, r.currency)}</td>
                <td className="font-bold text-ok">{fmtMoney(r.shop_share, r.currency)}</td>
                <td>
                  <RecordActions table="banjarka_records" record={r} isOwn={r.created_by === s.user.id} isAdmin={s.isAdmin} />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="text-center text-muted">{t("common.none")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

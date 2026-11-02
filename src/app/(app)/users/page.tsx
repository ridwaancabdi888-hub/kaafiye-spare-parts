import { getStaffNames, requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { fmtUsd, monthStart, num, rangeToIso } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { CreateStaffForm, StaffRowActions } from "./UserForms";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const s = await requireAdmin();
  const t = await getT();
  const start = rangeToIso({ from: monthStart(), to: null }).start!;
  const [staff, sales, bj] = await Promise.all([
    getStaffNames(s.business.id),
    s.supabase.from("sales").select("created_by, total_usd").eq("business_id", s.business.id).eq("status", "active").gte("created_at", start),
    s.supabase.from("banjarka_records").select("created_by, worker_share_usd").eq("business_id", s.business.id).eq("status", "active").gte("work_date", monthStart()),
  ]);
  const sum = (rows: { created_by: string }[] | null, key: string) =>
    (rows ?? []).reduce<Record<string, number>>((a, r) => ((a[r.created_by] = (a[r.created_by] ?? 0) + num((r as Record<string, unknown>)[key])), a), {});
  const salesBy = sum(sales.data, "total_usd");
  const shareBy = sum(bj.data, "worker_share_usd");

  return (
    <>
      <PageHeader title={t("users.title")} />
      {!process.env.SUPABASE_SERVICE_ROLE_KEY && (
        <p className="mb-4 rounded-lg bg-[#fff4e5] px-3 py-2 text-sm text-[#8a5a12]">{t("users.serviceKeyMissing")}</p>
      )}
      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-[1.4fr_.6fr]">
        <div className="tbl-wrap h-fit">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t("users.fullName")}</th>
                <th>{t("users.role")}</th>
                <th>{t("users.monthSales")}</th>
                <th>{t("users.monthShare")}</th>
                <th>{t("common.status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.rows.map((m) => (
                <tr key={m.user_id} className={m.active ? "" : "opacity-60"}>
                  <td>
                    <b>{m.full_name}</b>
                    {m.user_id === s.user.id && <span className="muted"> ({t("users.you")})</span>}
                    {m.username && <div className="muted">@{m.username}</div>}
                  </td>
                  <td>{m.role === "admin" ? t("role.admin") : t("role.user")}</td>
                  <td>{fmtUsd(salesBy[m.user_id] ?? 0)}</td>
                  <td>{fmtUsd(shareBy[m.user_id] ?? 0)}</td>
                  <td className={m.active ? "font-bold text-ok" : "font-bold text-bad"}>{m.active ? t("common.active") : t("common.disabled")}</td>
                  <td>{m.user_id !== s.user.id && <StaffRowActions userId={m.user_id} active={m.active} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CreateStaffForm />
      </div>
    </>
  );
}

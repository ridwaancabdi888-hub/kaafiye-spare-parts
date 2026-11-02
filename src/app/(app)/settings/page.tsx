import { getFx, getStaffNames, requireMember } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { fmtDateTime, fmtSlsh } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { LangToggle } from "@/components/LangToggle";
import { InstallButton } from "@/components/InstallButton";
import type { FxRate } from "@/lib/types";
import { BusinessSettingsForm, FxRateForm } from "./SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const s = await requireMember();
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const [fx, staff, history] = await Promise.all([
    getFx(s.business.id),
    getStaffNames(s.business.id),
    s.supabase.from("fx_rates").select("*").eq("business_id", s.business.id).order("created_at", { ascending: false }).limit(30),
  ]);

  return (
    <>
      <PageHeader title={t("set.title")} />
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 text-xl font-bold">{t("set.language")}</h2>
          <LangToggle />
          <h2 className="mb-3 mt-6 text-xl font-bold">{t("set.install")}</h2>
          <InstallButton />
          <h2 className="mb-2 mt-6 text-xl font-bold">{t("set.account")}</h2>
          <p><b>{s.membership.full_name}</b> • {s.isAdmin ? t("role.admin") : t("role.user")}</p>
          <p className="muted">{s.user.email} • {s.business.name}</p>
        </section>

        {s.isAdmin && (
          <section className="card" id="fx">
            <h2 className="mb-2 text-xl font-bold">{t("set.fx")}</h2>
            <p className="muted mb-4">{t("set.fxNoLive")}</p>
            <FxRateForm current={fx?.rate?.slsh_per_usd ?? null} />
            <h3 className="mb-2 mt-6 font-bold">{t("set.fxHistory")}</h3>
            <ul className="max-h-72 overflow-y-auto">
              {((history.data ?? []) as FxRate[]).map((r) => (
                <li key={r.id} className="row-item text-sm">
                  <span>
                    <b>{fmtSlsh(r.slsh_per_usd)}</b>
                    {r.is_example && <span className="ml-2 text-xs font-bold text-warn">{t("common.example")}</span>}
                    {r.note && <span className="muted"> • {r.note}</span>}
                  </span>
                  <span className="muted text-right">
                    {fmtDateTime(r.created_at, lang)}
                    <br />
                    {r.created_by ? staff.names[r.created_by] ?? r.source : r.source}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {s.isAdmin && fx?.settings && (
          <section className="card">
            <h2 className="mb-4 text-xl font-bold">{t("set.business")}</h2>
            <BusinessSettingsForm staleHours={fx.settings.fx_stale_hours} seeAll={fx.settings.users_see_all_banjarka} />
          </section>
        )}
      </div>
    </>
  );
}

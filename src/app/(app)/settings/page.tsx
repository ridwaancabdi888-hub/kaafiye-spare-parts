import { redirect } from "next/navigation";
import { getFx, getSession, getStaffNames } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { fmtDateTime, fmtSlsh } from "@/lib/format";
import type { FxRate } from "@/lib/types";
import { Icon, type IconName } from "@/components/Icon";
import { Alert, Initials, PageHeader } from "@/components/kit";
import { LangToggle } from "@/components/LangToggle";
import { InstallButton } from "@/components/InstallButton";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { BusinessSettingsForm, FxRateForm } from "./SettingsForms";

export const metadata = { title: "Settings" };

function Section({ icon, title, children, id }: { icon: IconName; title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="card scroll-mt-20">
      <h2 className="section-title mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon name={icon} className="h-[18px] w-[18px]" /></span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const bid = s.membership?.business_id;
  const [fx, staff, history] = await Promise.all([
    bid ? getFx(bid) : null,
    bid ? getStaffNames(bid) : null,
    bid && s.isAdmin ? s.supabase.from("fx_rates").select("*").eq("business_id", bid).order("created_at", { ascending: false }).limit(30) : null,
  ]);
  const name = s.membership?.full_name ?? s.user.email ?? "";
  const role = s.isAdmin ? t("role.admin") : s.membership ? t("role.user") : t("role.super");

  return (
    <>
      <PageHeader title={t("set.title")} subtitle={t("set.subtitle")} />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <Section icon="users" title={t("set.account")}>
            <div className="flex items-center gap-3">
              <Initials name={name} className="h-12 w-12 text-[15px]" />
              <div className="min-w-0">
                <div className="truncate font-bold">{name}</div>
                <div className="truncate text-[13px] text-muted">{role}{s.business ? ` · ${s.business.name}` : ""}{s.membership?.username ? ` · @${s.membership.username}` : ""}</div>
              </div>
            </div>
          </Section>
          <Section icon="globe" title={t("set.language")}>
            <LangToggle size="lg" />
          </Section>
          <Section icon="phone" title={t("set.install")}>
            <InstallButton />
          </Section>
          <Section icon="key" title={t("set.changePassword")}>
            <ChangePasswordForm forced={false} />
          </Section>
        </div>

        {s.isAdmin && fx && (
          <div className="space-y-4">
            <Section icon="swap" title={t("set.fx")} id="fx">
              <Alert tone="info" className="mb-4">{t("set.fxNoLive")}</Alert>
              <FxRateForm current={fx.rate?.slsh_per_usd ?? null} />
              <h3 className="mb-1 mt-6 text-[14px] font-bold">{t("set.fxHistory")}</h3>
              <ul className="max-h-72 overflow-y-auto">
                {((history?.data ?? []) as FxRate[]).map((r) => (
                  <li key={r.id} className="row text-[14px]">
                    <span className="min-w-0">
                      <span className="num font-bold">{fmtSlsh(r.slsh_per_usd)}</span>
                      {r.is_example && <span className="badge badge-amber ml-2">{t("common.example")}</span>}
                      {r.note && <span className="block truncate text-[12.5px] text-muted">{r.note}</span>}
                    </span>
                    <span className="shrink-0 text-right text-[12.5px] text-muted">
                      {fmtDateTime(r.created_at, lang)}
                      <span className="block">{r.created_by ? staff?.names[r.created_by] ?? "" : ""}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
            {fx.settings && (
              <Section icon="settings" title={t("set.business")}>
                <BusinessSettingsForm staleHours={fx.settings.fx_stale_hours} seeAll={fx.settings.users_see_all_banjarka} />
              </Section>
            )}
          </div>
        )}
      </div>
    </>
  );
}

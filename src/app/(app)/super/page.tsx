import { requireSuper } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { fmtDate } from "@/lib/format";
import { Alert, EmptyState, Initials, PageHeader } from "@/components/kit";
import { AccountControls } from "@/components/AccountControls";
import { AddAdminButton, BusinessToggle, CreateBusinessButton } from "./SuperForms";

export const metadata = { title: "Businesses" };

type Member = { user_id: string; business_id: string; full_name: string; role: "admin" | "user"; active: boolean; username: string | null };

export default async function SuperPage() {
  const s = await requireSuper();
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const [{ data: businesses }, { data: members }] = await Promise.all([
    s.supabase.from("businesses").select("*").order("created_at"),
    s.supabase.from("memberships").select("user_id, business_id, full_name, role, active, username").order("created_at"),
  ]);
  const byBiz = ((members ?? []) as Member[]).reduce<Record<string, Member[]>>((a, m) => ((a[m.business_id] ??= []).push(m), a), {});
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return (
    <>
      <PageHeader title={t("super.title")} subtitle={t("super.subtitle")} actions={hasKey && <CreateBusinessButton />} />
      {!hasKey && <Alert tone="warning" className="mb-4">{t("users.serviceKeyMissing")}</Alert>}
      {businesses?.length ? (
        <div className="grid gap-4">
          {businesses.map((b) => {
            const list = byBiz[b.id] ?? [];
            const admins = list.filter((m) => m.role === "admin");
            return (
              <section key={b.id} className={`card ${b.active ? "" : "opacity-70"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-extrabold text-navy-900">{b.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                      <span className="badge badge-slate">{b.slug}</span>
                      <span>{fmtDate(b.created_at, lang)}</span>
                      <span>· {t("super.staffCount", { n: list.length - admins.length })}</span>
                      <span className={`badge ${b.active ? "badge-green" : "badge-red"}`}>{b.active ? t("common.active") : t("common.disabled")}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hasKey && <AddAdminButton businessId={b.id} />}
                    <BusinessToggle businessId={b.id} active={b.active} />
                  </div>
                </div>
                <h3 className="mb-2 mt-4 text-[13px] font-bold uppercase tracking-wide text-muted">{t("super.admins")}</h3>
                <ul className="space-y-3">
                  {admins.map((m) => (
                    <li key={m.user_id} className="rounded-xl border border-line p-3">
                      <div className="flex items-center gap-3">
                        <Initials name={m.full_name} className="h-9 w-9 text-[13px]" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{m.full_name}</div>
                          <div className="truncate text-[12.5px] text-muted">
                            {m.username ? `@${m.username}` : t("users.signsInWith", { v: t("users.emailLogin") })} · {m.active ? t("common.active") : t("common.disabled")}
                          </div>
                        </div>
                      </div>
                      {hasKey && m.user_id !== s.user.id && (
                        <div className="mt-3"><AccountControls userId={m.user_id} name={m.full_name} username={m.username} active={m.active} /></div>
                      )}
                    </li>
                  ))}
                  {!admins.length && <li className="text-[14px] text-muted">—</li>}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState icon="building" text={t("empty.businesses")} />
      )}
    </>
  );
}

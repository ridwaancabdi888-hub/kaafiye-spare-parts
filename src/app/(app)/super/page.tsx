import { requireSuper } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { AddAdminButton, BusinessToggle, CreateBusinessForm } from "./SuperForms";

export const metadata = { title: "Businesses" };

export default async function SuperPage() {
  const s = await requireSuper();
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const [{ data: businesses }, { data: members }] = await Promise.all([
    s.supabase.from("businesses").select("*").order("created_at"),
    s.supabase.from("memberships").select("business_id, full_name, role, active, username"),
  ]);
  const byBiz = (members ?? []).reduce<Record<string, { full_name: string; role: string; active: boolean }[]>>((a, m) => {
    (a[m.business_id] ??= []).push(m);
    return a;
  }, {});

  return (
    <>
      <PageHeader title={t("super.title")} />
      {!process.env.SUPABASE_SERVICE_ROLE_KEY && (
        <p className="mb-4 rounded-lg bg-[#fff4e5] px-3 py-2 text-sm text-[#8a5a12]">{t("users.serviceKeyMissing")}</p>
      )}
      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-[1.4fr_.6fr]">
        <div className="flex flex-col gap-4">
          {(businesses ?? []).map((b) => {
            const list = byBiz[b.id] ?? [];
            return (
              <div key={b.id} className={`card ${b.active ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{b.name}</h2>
                    <div className="muted">{b.slug} • {fmtDate(b.created_at, lang)}</div>
                  </div>
                  <div className="flex gap-2">
                    <AddAdminButton businessId={b.id} />
                    <BusinessToggle businessId={b.id} active={b.active} />
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  <b>{t("super.members")}:</b>{" "}
                  {list.length
                    ? list.map((m) => `${m.full_name} (${m.role === "admin" ? t("role.admin") : t("role.user")}${m.active ? "" : ", " + t("common.disabled")})`).join(" • ")
                    : "—"}
                </div>
              </div>
            );
          })}
          {!businesses?.length && <p className="muted">{t("common.none")}</p>}
        </div>
        <CreateBusinessForm />
      </div>
    </>
  );
}

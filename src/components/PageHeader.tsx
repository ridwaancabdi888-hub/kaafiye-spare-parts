import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { signOut } from "@/app/actions/prefs";
import { LangToggle } from "./LangToggle";

export async function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  const [s, t] = await Promise.all([getSession(), getT()]);
  const roleLabel = s?.isAdmin ? t("role.admin") : s?.membership ? t("role.user") : s?.isSuper ? t("role.super") : "";
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="muted">{s?.business ? `${s.business.name.toUpperCase()} / ${t("app.breadcrumb").split(" / ")[1]}` : t("app.breadcrumb")}</div>
        <h1 className="mt-1 text-[24px] font-bold leading-tight sm:text-[28px]">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {children}
        <LangToggle />
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-full bg-[#e1edee] px-4 py-2.5 text-[#245153] [&::-webkit-details-marker]:hidden">
            {roleLabel} ▾
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-line bg-white p-3 shadow-lg">
            <div className="font-bold">{s?.membership?.full_name ?? s?.user.email}</div>
            <div className="muted mb-3 break-all">{s?.user.email}</div>
            <form action={signOut}>
              <button className="btn-light w-full" type="submit">{t("nav.signOut")}</button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="card">
      <div className="text-[13px] text-[#657b84]">{label}</div>
      <div className="mt-3 text-[24px] font-extrabold sm:text-[27px]">{value}</div>
      {hint && <div className="muted mt-2">{hint}</div>}
    </div>
  );
}

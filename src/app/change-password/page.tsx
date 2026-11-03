import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { LangToggle } from "@/components/LangToggle";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { signOut } from "@/app/actions/prefs";

export const metadata = { title: "Password" };

/** Shown right after sign-in when an admin issued a temporary password. */
export default async function ChangePasswordPage() {
  const [s, t] = await Promise.all([getSession(), getT()]);
  if (!s) redirect("/login");
  if (!s.membership?.must_change_password) redirect("/");
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="bg-gradient-to-br from-navy-950 to-navy-800 px-5 pb-20 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Brand tagline={t("app.tagline")} />
          <LangToggle dark />
        </div>
      </header>
      <main className="mx-auto -mt-14 max-w-md px-4 pb-10">
        <div className="card p-6 sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon name="key" className="h-6 w-6" /></span>
          <h1 className="mt-4 text-[22px] font-extrabold tracking-tight text-navy-900">{t("pw.forcedTitle")}</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{t("pw.forcedText")}</p>
          <div className="mt-5"><ChangePasswordForm forced /></div>
        </div>
        <form action={signOut} className="mt-4 text-center">
          <button className="text-[14px] font-semibold text-muted hover:text-ink">{t("nav.signOut")}</button>
        </form>
      </main>
    </div>
  );
}

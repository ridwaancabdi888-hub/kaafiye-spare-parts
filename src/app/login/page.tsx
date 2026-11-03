import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSession } from "@/lib/session";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { Alert } from "@/components/kit";
import { InstallButton } from "@/components/InstallButton";
import { LangToggle } from "@/components/LangToggle";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const configured = isSupabaseConfigured();
  if (configured) {
    const s = await getSession();
    if (s && (s.membership || s.isSuper)) redirect("/");
  }
  const [t, sp] = await Promise.all([getT(), searchParams]);

  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel: full hero on desktop, compact header on phones */}
      <section className="relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-brand-800 px-5 pb-16 pt-6 text-white lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-navy-600/40 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <Brand tagline={t("app.tagline")} />
          <LangToggle dark />
        </div>
        <div className="relative mt-8 max-w-lg lg:mt-0">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight sm:text-[34px] lg:text-[42px]">{t("login.heroTitle")}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/75 lg:text-[17px]">{t("login.heroText")}</p>
          <ul className="mt-8 hidden space-y-3 lg:block">
            {(["login.feature1", "login.feature2", "login.feature3"] as const).map((k) => (
              <li key={k} className="flex items-center gap-3 text-[15px] text-white/90">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-500/25 text-brand-200"><Icon name="check" className="h-4 w-4" /></span>
                {t(k)}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative hidden text-[13px] text-white/50 lg:block">© {new Date().getFullYear()} KAAFIYE</div>
      </section>

      <section className="relative -mt-10 px-4 pb-10 lg:mt-0 lg:flex lg:items-center lg:justify-center lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="card p-6 sm:p-8">
            <h2 className="text-[24px] font-extrabold tracking-tight text-navy-900">{t("login.welcome")}</h2>
            <p className="mt-1 text-[14px] text-muted">{t("login.subtitle")}</p>
            {!configured && <Alert tone="warning" className="mt-5">{t("login.notConfigured")}</Alert>}
            {sp.e === "noaccess" && <Alert tone="error" className="mt-5">{t("login.noAccess")}</Alert>}
            <LoginForm />
          </div>
          {/* Public page: installing does not require signing in. */}
          <div className="mt-4">
            <InstallButton />
          </div>
        </div>
      </section>
    </div>
  );
}

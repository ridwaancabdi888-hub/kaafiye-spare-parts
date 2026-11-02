import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSession } from "@/lib/session";
import { Brand } from "@/components/Brand";
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
    <div className="grid min-h-dvh place-items-center bg-[linear-gradient(125deg,#07343d,#0d7564)] p-4">
      <div className="w-full max-w-[480px] rounded-[23px] bg-white px-6 py-8 shadow-[0_25px_90px_#001a242e] sm:px-[45px] sm:py-[38px]">
        <Brand dark />
        <h1 className="mb-1.5 mt-5 text-[26px] font-bold sm:text-[29px]">{t("login.welcome")}</h1>
        <p className="muted">{t("login.subtitle")}</p>

        <div className="mt-5" />
        {!configured && (
          <p className="mb-4 rounded-lg bg-[#fff4e5] px-3 py-2 text-sm text-[#8a5a12]">{t("login.notConfigured")}</p>
        )}
        {sp.e === "noaccess" && <p className="mb-4 rounded-lg bg-[#fbeaea] px-3 py-2 text-sm text-bad">{t("login.noAccess")}</p>}

        <LoginForm />

        {/* Public page: installing does not require signing in first. */}
        <InstallButton className="mt-5" />

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-center">
          <LangToggle variant="inline" />
          <span className="muted">• {t("install.hint")}</span>
        </div>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { Brand } from "@/components/Brand";
import { LangToggle } from "@/components/LangToggle";
import { Sidebar } from "@/components/shell/Sidebar";
import { BottomNav } from "@/components/shell/BottomNav";
import { UserMenu } from "@/components/shell/UserMenu";
import type { NavItem } from "@/components/shell/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [s, t] = await Promise.all([getSession(), getT()]);
  if (!s) redirect("/login");
  if (s.membership?.must_change_password) redirect("/change-password");

  const item = (href: string, key: Parameters<typeof t>[0], icon: NavItem["icon"]): NavItem => ({ href, label: t(key), icon });
  const all: NavItem[] = [];
  let primary: NavItem[] = [];
  let more: NavItem[] = [];

  if (s.membership) {
    const work = [
      item("/dashboard", "nav.dashboard", "home"),
      item("/spare-parts", "nav.spareParts", "cart"),
      item("/banjarka", "nav.banjarka", "wrench"),
      item("/inventory", "nav.inventory", "package"),
    ];
    const admin = s.isAdmin
      ? [item("/expenses", "nav.expenses", "wallet"), item("/reports", "nav.reports", "chart"), item("/users", "nav.users", "users")]
      : [];
    const extra = [...admin, ...(s.isSuper ? [item("/super", "nav.super", "building")] : []), item("/settings", "nav.settings", "settings")];
    all.push(...work, ...extra);
    // Staff: 4 tabs + Settings fit the bar. Admins: 4 tabs + "More".
    if (extra.length === 1) primary = [...work, ...extra];
    else [primary, more] = [work, extra];
  } else if (s.isSuper) {
    primary = [item("/super", "nav.super", "building"), item("/settings", "nav.settings", "settings")];
    all.push(...primary);
  }

  const name = s.membership?.full_name ?? s.user.email ?? "";
  const role = s.isAdmin ? t("role.admin") : s.membership ? t("role.user") : t("role.super");

  return (
    <div className="min-h-dvh">
      <Sidebar items={all} tagline={t("app.tagline")} business={s.business?.name} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-line/80 bg-white/85 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="min-w-0 lg:hidden">
              <Brand light={false} compact tagline={s.business?.name} />
            </div>
            <div className="hidden min-w-0 truncate text-[14px] font-semibold text-muted lg:block">{s.business?.name ?? t("role.super")}</div>
            <div className="flex shrink-0 items-center gap-2">
              <LangToggle />
              <UserMenu name={name} role={role} business={s.business?.name} canSettings />
            </div>
          </div>
        </header>
        <main className="pb-nav mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-7 lg:px-8">{children}</main>
      </div>
      <BottomNav primary={primary} more={more} moreLabel={t("nav.more")} />
    </div>
  );
}

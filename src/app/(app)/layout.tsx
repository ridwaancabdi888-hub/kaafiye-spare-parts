import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { Brand } from "@/components/Brand";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import { MobileNav } from "@/components/MobileNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [s, t] = await Promise.all([getSession(), getT()]);
  if (!s) redirect("/login");

  const items: NavItem[] = [];
  if (s.membership) {
    items.push(
      { href: "/dashboard", label: t("nav.dashboard"), icon: "▦" },
      { href: "/spare-parts", label: t("nav.spareParts"), icon: "▣" },
      { href: "/banjarka", label: t("nav.banjarka"), icon: "◉" },
    );
    if (s.isAdmin) {
      items.push(
        { href: "/inventory", label: t("nav.inventory"), icon: "▤" },
        { href: "/expenses", label: t("nav.expenses"), icon: "◇" },
        { href: "/reports", label: t("nav.reports"), icon: "▥" },
        { href: "/users", label: t("nav.users"), icon: "♙" },
      );
    }
    items.push({ href: "/settings", label: t("nav.settings"), icon: "⚙" });
  }
  if (s.isSuper) items.push({ href: "/super", label: t("nav.super"), icon: "★" });

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-[244px] shrink-0 overflow-y-auto bg-side px-[18px] py-7 lg:block">
        <Brand />
        <NavLinks items={items} />
      </aside>
      <MobileNav items={items} menuLabel={t("nav.menu")} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-[42px] lg:py-[34px]">{children}</main>
    </div>
  );
}

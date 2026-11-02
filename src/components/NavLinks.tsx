"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; icon: string };

export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="mt-9 flex flex-col gap-1.5">
      {items.map((it) => {
        const active = path === it.href || path.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-[10px] px-[15px] py-[14px] transition ${
              active ? "bg-side-active font-bold text-white" : "text-side-text hover:bg-white/5 hover:text-white"
            }`}
          >
            <span aria-hidden className="w-4 text-center">{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

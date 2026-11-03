"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../Icon";
import { Brand } from "../Brand";
import { isActive, type NavItem } from "./nav";

export function Sidebar({ items, tagline, business }: { items: NavItem[]; tagline: string; business?: string }) {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-gradient-to-b from-navy-900 to-navy-950 px-4 py-6 lg:flex">
      <div className="px-2">
        <Brand tagline={tagline} />
      </div>
      {business && (
        <div className="mx-2 mt-5 truncate rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] font-semibold text-white/85">
          <Icon name="building" className="mr-2 inline h-4 w-4 align-[-3px] text-brand-300" />
          {business}
        </div>
      )}
      <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
        {items.map((it) => {
          const active = isActive(path, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold transition ${
                active ? "bg-brand-600 text-white shadow-lg shadow-brand-950/30" : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon name={it.icon} className={`h-[19px] w-[19px] ${active ? "text-white" : "text-slate-400 group-hover:text-brand-300"}`} />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

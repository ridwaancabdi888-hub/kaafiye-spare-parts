"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "../Icon";
import { isActive, type NavItem } from "./nav";

/** Phone navigation: primary tabs, plus a "More" sheet when there are extra pages. */
export function BottomNav({ primary, more, moreLabel }: { primary: NavItem[]; more: NavItem[]; moreLabel: string }) {
  const path = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path; // closes automatically on navigation
  const moreActive = more.some((m) => isActive(path, m.href));
  const tab = (active: boolean) =>
    `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition ${active ? "text-brand-600" : "text-slate-500"}`;

  return (
    <>
      {open && <div className="anim-fade fixed inset-0 z-40 bg-navy-950/40 lg:hidden" onClick={() => setOpenAt(null)} aria-hidden />}
      {open && (
        <div className="anim-sheet fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 mx-3 rounded-2xl bg-white p-2 shadow-[var(--shadow-pop)] lg:hidden" role="menu">
          {more.map((it) => (
            <Link key={it.href} href={it.href} role="menuitem" onClick={() => setOpenAt(null)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] font-semibold ${isActive(path, it.href) ? "bg-brand-50 text-brand-700" : "text-ink-2 hover:bg-canvas"}`}>
              <Icon name={it.icon} className="h-5 w-5" /> {it.label}
              <Icon name="chevronRight" className="ml-auto h-4 w-4 text-slate-400" />
            </Link>
          ))}
        </div>
      )}
      <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex h-[4.25rem] max-w-xl items-stretch px-1">
          {primary.map((it) => {
            const active = isActive(path, it.href);
            return (
              <Link key={it.href} href={it.href} className={tab(active)} aria-current={active ? "page" : undefined}>
                <span className={`grid h-8 w-12 place-items-center rounded-full transition ${active ? "bg-brand-50" : ""}`}>
                  <Icon name={it.icon} className="h-[21px] w-[21px]" strokeWidth={active ? 2.3 : 2} />
                </span>
                <span className="max-w-full truncate px-0.5">{it.label}</span>
              </Link>
            );
          })}
          {more.length > 0 && (
            <button type="button" onClick={() => setOpenAt(open ? null : path)} className={tab(moreActive || open)} aria-expanded={open}>
              <span className={`grid h-8 w-12 place-items-center rounded-full transition ${moreActive || open ? "bg-brand-50" : ""}`}>
                <Icon name="grid" className="h-[21px] w-[21px]" />
              </span>
              <span className="max-w-full truncate px-0.5">{moreLabel}</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}

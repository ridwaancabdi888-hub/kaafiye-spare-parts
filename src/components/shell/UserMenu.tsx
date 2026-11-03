"use client";
import Link from "next/link";
import { useState } from "react";
import { signOut } from "@/app/actions/prefs";
import { useT } from "@/lib/i18n/client";
import { Icon } from "../Icon";
import { Initials } from "../kit";

export function UserMenu({ name, role, business, canSettings }: { name: string; role: string; business?: string; canSettings: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition hover:bg-slate-100 sm:pr-3">
        <Initials name={name} className="h-9 w-9 text-[13px]" />
        <span className="hidden max-w-[10rem] truncate text-[14px] font-semibold text-ink sm:block">{name}</span>
        <Icon name="chevronDown" className="hidden h-4 w-4 text-muted sm:block" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div role="menu" className="anim-fade absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-line bg-white p-2 shadow-[var(--shadow-pop)]">
            <div className="px-3 py-2.5">
              <div className="truncate font-bold text-ink">{name}</div>
              <div className="truncate text-[13px] text-muted">{role}{business ? ` · ${business}` : ""}</div>
            </div>
            <div className="my-1 h-px bg-line" />
            {canSettings && (
              <Link href="/settings" role="menuitem" onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-ink-2 hover:bg-canvas">
                <Icon name="settings" className="h-[18px] w-[18px]" /> {t("nav.settings")}
              </Link>
            )}
            <form action={signOut}>
              <button type="submit" role="menuitem" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-rose-700 hover:bg-rose-50">
                <Icon name="logout" className="h-[18px] w-[18px]" /> {t("nav.signOut")}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

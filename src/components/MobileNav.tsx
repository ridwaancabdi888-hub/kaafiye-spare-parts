"use client";
import { useState } from "react";
import { NavLinks, type NavItem } from "./NavLinks";
import { Brand } from "./Brand";

export function MobileNav({ items, menuLabel }: { items: NavItem[]; menuLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <div className="sticky top-0 z-30 flex items-center justify-between bg-side px-4 py-3 text-white">
        <Brand compact />
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold" aria-expanded={open}>
          ☰ {menuLabel}
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
          <div className="w-[260px] overflow-y-auto bg-side px-[18px] py-7 text-white">
            <Brand />
            <NavLinks items={items} onNavigate={() => setOpen(false)} />
          </div>
          <button type="button" aria-label="Close" className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

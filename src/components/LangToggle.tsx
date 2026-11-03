"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLang } from "@/app/actions/prefs";
import { useLang } from "@/lib/i18n/client";

// Each option is written in its own language (the usual convention for language pickers).
const OPTIONS = [
  { v: "so", short: "SO", long: "Soomaali" },
  { v: "en", short: "EN", long: "English" },
] as const;

export function LangToggle({ size = "sm", dark = false }: { size?: "sm" | "lg"; dark?: boolean }) {
  const lang = useLang();
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (l: "so" | "en") => {
    if (l === lang) return;
    start(async () => {
      await setLang(l);
      try {
        localStorage.setItem("kaafiye_lang", l);
      } catch {}
      router.refresh();
    });
  };
  const wrap = dark ? "bg-white/10" : "bg-slate-100";
  const on = dark ? "bg-white text-navy-900" : "bg-white text-ink shadow-sm";
  const off = dark ? "text-white/70 hover:text-white" : "text-muted hover:text-ink";
  return (
    <div className={`inline-flex rounded-xl p-1 ${wrap} ${pending ? "opacity-60" : ""}`} role="radiogroup" aria-label="Language / Luqadda">
      {OPTIONS.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={lang === o.v}
          lang={o.v}
          onClick={() => choose(o.v)}
          className={`rounded-lg font-semibold transition ${size === "lg" ? "h-10 px-4 text-[14px]" : "h-8 px-2.5 text-[12px]"} ${lang === o.v ? on : off}`}
        >
          {size === "lg" ? o.long : o.short}
        </button>
      ))}
    </div>
  );
}

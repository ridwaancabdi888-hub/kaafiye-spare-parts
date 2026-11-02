"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLang } from "@/app/actions/prefs";
import { useLang } from "@/lib/i18n/client";

export function LangToggle({ variant = "tag" }: { variant?: "tag" | "inline" }) {
  const lang = useLang();
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (l: "so" | "en") =>
    start(async () => {
      await setLang(l);
      try { localStorage.setItem("kaafiye_lang", l); } catch {}
      router.refresh();
    });
  const cls = (active: boolean) =>
    `px-2 py-1 rounded-md transition ${active ? "bg-white font-bold text-tag-ink shadow-sm" : "text-muted hover:text-ink"}`;
  return (
    <div className={`inline-flex items-center gap-1 ${variant === "tag" ? "rounded-lg bg-tag p-1 text-xs" : "text-sm"} ${pending ? "opacity-60" : ""}`}>
      <button type="button" className={cls(lang === "so")} onClick={() => choose("so")} aria-pressed={lang === "so"}>
        🇸🇴 Somali
      </button>
      <button type="button" className={cls(lang === "en")} onClick={() => choose("en")} aria-pressed={lang === "en"}>
        English
      </button>
    </div>
  );
}

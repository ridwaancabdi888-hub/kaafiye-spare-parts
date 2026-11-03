"use client";
import Link from "next/link";
import { useState } from "react";
import { useLang, useT } from "@/lib/i18n/client";
import { fmtDateTime, fmtSlsh, fmtUsd, num } from "@/lib/format";
import type { FxRate } from "@/lib/types";
import { Icon } from "./Icon";

/** Always the first block on dashboards. Manual rates are labelled as such — never as "live". */
export function FxWidget({ rate, staleHours, canChange }: { rate: FxRate | null; staleHours: number; canChange: boolean }) {
  const t = useT();
  const lang = useLang();
  const [dir, setDir] = useState<"usd" | "slsh">("usd");
  const [amount, setAmount] = useState("10");
  const [now] = useState(() => Date.now());
  const r = rate ? num(rate.slsh_per_usd) : 0;
  const stale = rate && !rate.is_example && (now - new Date(rate.created_at).getTime()) / 3600000 > staleHours;
  const a = num(amount.replace(/,/g, ""));
  const result = dir === "usd" ? fmtSlsh(Math.round(a * r)) : fmtUsd(r ? a / r : 0);

  return (
    <section className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 via-navy-800 to-brand-800 p-4 text-white shadow-[var(--shadow-card)] sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-400/15 blur-2xl" />
      <div className="relative grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-brand-200">
            <Icon name="swap" className="h-4 w-4" /> {t("fx.title")}
          </div>
          {rate ? (
            <div className="num mt-1.5 text-[26px] font-extrabold tracking-tight sm:text-[32px]">1 USD = {fmtSlsh(r)}</div>
          ) : (
            <div className="mt-1.5 text-xl font-bold">{t("fx.none")}</div>
          )}
          {rate && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
              <span className={`badge ${rate.is_example ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-white/85"}`}>
                {rate.is_example ? t("fx.example") : t("fx.manual")}
              </span>
              <span className="text-white/65">{t("fx.updated", { d: fmtDateTime(rate.created_at, lang) })}</span>
            </div>
          )}
          {stale && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-400/15 px-3 py-2 text-[13px] text-amber-100">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {t("fx.stale", { h: staleHours })}
            </div>
          )}
        </div>
        {rate && (
          <div className="min-w-0 rounded-xl bg-white/8 p-3 ring-1 ring-white/10 md:w-72">
            <div className="mb-2 text-[12px] font-semibold text-white/70">{t("fx.converter")}</div>
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                  aria-label={dir === "usd" ? "USD" : "SlSh"}
                  className="num h-11 w-full rounded-lg border border-white/15 bg-white/10 pl-3 pr-14 text-[16px] font-semibold text-white outline-none focus:border-brand-300"
                />
                <span className="absolute inset-y-0 right-3 flex items-center text-[12px] font-bold text-white/60">{dir === "usd" ? "USD" : "SlSh"}</span>
              </div>
              <button type="button" onClick={() => setDir(dir === "usd" ? "slsh" : "usd")} aria-label={t("fx.swap")}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/15 transition hover:bg-white/25">
                <Icon name="swap" className="h-5 w-5" />
              </button>
            </div>
            <div className="num mt-2 truncate text-[18px] font-bold">= {result}</div>
            {canChange && (
              <Link href="/settings#fx" className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-200 hover:text-white">
                <Icon name="pencil" className="h-3.5 w-3.5" /> {t("fx.change")}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

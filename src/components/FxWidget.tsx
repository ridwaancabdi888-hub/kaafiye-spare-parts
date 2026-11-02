"use client";
import Link from "next/link";
import { useState } from "react";
import { useLang, useT } from "@/lib/i18n/client";
import { fmtDateTime, fmtSlsh, fmtUsd, num } from "@/lib/format";
import type { FxRate } from "@/lib/types";

export function FxWidget({ rate, staleHours, canChange }: { rate: FxRate | null; staleHours: number; canChange: boolean }) {
  const t = useT();
  const lang = useLang();
  const [dir, setDir] = useState<"usd" | "slsh">("usd");
  const [amount, setAmount] = useState("10");
  const [now] = useState(() => Date.now());
  const r = rate ? num(rate.slsh_per_usd) : 0;
  const ageH = rate ? (now - new Date(rate.created_at).getTime()) / 3600000 : 0;
  const stale = rate && !rate.is_example && ageH > staleHours;
  const a = num(amount);
  const converted = dir === "usd" ? fmtSlsh(Math.round(a * r)) : fmtUsd(r ? a / r : 0);

  return (
    <section className="mb-6 flex flex-col gap-5 rounded-[18px] bg-[linear-gradient(105deg,#0a4145,#13775f)] px-6 py-6 text-white md:flex-row md:items-center md:justify-between md:px-7">
      <div>
        <div className="text-sm md:text-base">💱 &nbsp;{t("fx.title")} / EXCHANGE RATE</div>
        {rate ? (
          <div className="my-2.5 text-[26px] font-extrabold md:text-[31px]">1 USD = {fmtSlsh(r)}</div>
        ) : (
          <div className="my-2.5 text-xl font-bold">{t("fx.none")}</div>
        )}
        {rate && (
          <div className="text-[13px] opacity-85">
            {rate.is_example ? `⚠ ${t("fx.example")}` : t("fx.manual")} • {t("fx.updated")} {fmtDateTime(rate.created_at, lang)}
          </div>
        )}
        {stale && (
          <div className="mt-2 inline-block rounded-md bg-warn px-2 py-1 text-xs font-bold">⚠ {t("fx.stale", { h: staleHours })}</div>
        )}
      </div>
      {rate && (
        <div className="md:text-right">
          <div className="text-[13px] opacity-80">{t("fx.converter")}: USD ↔ SlSh</div>
          <div className="my-2.5 flex items-center gap-2 md:justify-end">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              aria-label={t("common.amount")}
              className="w-28 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-right text-lg text-white outline-none focus:border-white/60"
            />
            <button
              type="button"
              onClick={() => setDir(dir === "usd" ? "slsh" : "usd")}
              className="rounded-lg bg-white/15 px-2.5 py-1.5 text-sm font-bold hover:bg-white/25"
            >
              {dir === "usd" ? "$ → SlSh" : "SlSh → $"} ⇄
            </button>
          </div>
          <div className="text-xl">= {converted}</div>
          {canChange && (
            <Link href="/settings#fx" className="pill mt-2.5">
              {t("fx.change")} / Change
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

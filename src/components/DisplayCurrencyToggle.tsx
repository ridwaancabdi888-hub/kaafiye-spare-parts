"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setDisplayCurrency } from "@/app/actions/prefs";
import type { Currency } from "@/lib/format";

const OPTIONS: { v: Currency; label: string }[] = [
  { v: "USD", label: "USD ($)" },
  { v: "SLSH", label: "SlSh" },
];

/** Display-only switch for totals. Stored amounts and their saved rates never change. */
export function DisplayCurrencyToggle({ value }: { value: Currency }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (c: Currency) => {
    if (c === value) return;
    start(async () => {
      await setDisplayCurrency(c);
      router.refresh();
    });
  };
  return (
    <div className={`inline-flex shrink-0 rounded-xl bg-slate-100 p-1 ${pending ? "opacity-60" : ""}`} role="radiogroup" aria-label="USD / SlSh">
      {OPTIONS.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => choose(o.v)}
          className={`h-9 min-w-[4.25rem] rounded-lg px-3 text-[13px] font-bold transition ${value === o.v ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

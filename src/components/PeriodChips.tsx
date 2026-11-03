import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { Period } from "@/lib/format";

export function parsePeriod(v: string | undefined, fallback: Period = "today"): Period {
  return v === "today" || v === "month" || v === "all" || v === "custom" ? v : fallback;
}

/** Period filter: chips scroll horizontally on small phones instead of wrapping the page. */
export async function PeriodChips({ base, period, from, to, custom = false, extra = {} }: {
  base: string;
  period: Period;
  from?: string | null;
  to?: string | null;
  custom?: boolean;
  extra?: Record<string, string>;
}) {
  const t = await getT();
  const tabs: [Period, string][] = [["today", t("common.today")], ["month", t("common.month")], ["all", t("common.allTime")]];
  const href = (p: Period) => `${base}?${new URLSearchParams({ ...extra, period: p })}`;
  return (
    <div className="min-w-0">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {tabs.map(([p, label]) => (
          <Link key={p} href={href(p)} className={`chip ${period === p ? "chip-active" : ""}`} aria-current={period === p ? "true" : undefined}>
            {label}
          </Link>
        ))}
      </div>
      {custom && (
        <form action={base} className="mt-2 flex flex-wrap items-end gap-2">
          {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input type="hidden" name="period" value="custom" />
          <label className="min-w-0 flex-1 sm:flex-none">
            <span className="mb-1 block text-[12px] font-semibold text-muted">{t("common.from")}</span>
            <input type="date" name="from" defaultValue={period === "custom" ? from ?? "" : ""} className="input h-10 text-[14px] sm:w-40" />
          </label>
          <label className="min-w-0 flex-1 sm:flex-none">
            <span className="mb-1 block text-[12px] font-semibold text-muted">{t("common.to")}</span>
            <input type="date" name="to" defaultValue={period === "custom" ? to ?? "" : ""} className="input h-10 text-[14px] sm:w-40" />
          </label>
          <button className="btn-secondary h-10 rounded-xl px-4 text-[14px]">{t("common.apply")}</button>
        </form>
      )}
    </div>
  );
}

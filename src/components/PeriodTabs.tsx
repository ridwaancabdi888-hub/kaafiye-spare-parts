import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { Period } from "@/lib/format";

export async function PeriodTabs({ base, period, from, to, custom = false }: {
  base: string;
  period: Period;
  from?: string | null;
  to?: string | null;
  custom?: boolean;
}) {
  const t = await getT();
  const tabs: [Period, string][] = [["today", t("common.today")], ["month", t("common.month")], ["all", t("common.allTime")]];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg bg-tag p-1 text-xs">
        {tabs.map(([p, label]) => (
          <Link
            key={p}
            href={`${base}?period=${p}`}
            className={`rounded-md px-2.5 py-1.5 ${period === p ? "bg-white font-bold text-tag-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {custom && (
        <form className="flex flex-wrap items-center gap-1.5 text-xs" action={base}>
          <input type="hidden" name="period" value="custom" />
          <input type="date" name="from" defaultValue={period === "custom" ? from ?? "" : ""} className="rounded-md border border-field-line bg-white px-2 py-1" aria-label={t("common.from")} />
          <span>–</span>
          <input type="date" name="to" defaultValue={period === "custom" ? to ?? "" : ""} className="rounded-md border border-field-line bg-white px-2 py-1" aria-label={t("common.to")} />
          <button className="rounded-md bg-brand px-2.5 py-1.5 font-bold text-white">{t("common.apply")}</button>
        </form>
      )}
    </div>
  );
}

export function parsePeriod(v: string | undefined, fallback: Period = "today"): Period {
  return v === "today" || v === "month" || v === "all" || v === "custom" ? v : fallback;
}

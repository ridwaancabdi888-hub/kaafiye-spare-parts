"use client";
import { useActionState, useRef, useState } from "react";
import { setFxRate, updateBusinessSettings } from "@/app/actions/admin";
import { useT } from "@/lib/i18n/client";
import { fmtSlsh, fmtUsd, num } from "@/lib/format";
import { FormMessage, SubmitButton, useResetOnSuccess } from "@/components/ui";

export function FxRateForm({ current }: { current: number | null }) {
  const t = useT();
  const [state, action] = useActionState(setFxRate, undefined);
  const [rate, setRate] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref, () => setRate(""));
  const r = num(rate.replace(/,/g, ""));
  return (
    <form action={action} ref={ref}>
      <div className="field">
        <label className="label" htmlFor="rate">{t("set.fxNew")}</label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[14px] font-bold text-muted">1 USD =</span>
          <input id="rate" name="rate" className="input num pl-[5.25rem] pr-16" inputMode="decimal" placeholder={current ? String(current) : "11800"}
            value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9.,]/g, ""))} required />
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[14px] font-bold text-muted">SlSh</span>
        </div>
        {r > 0 && <p className="hint num mt-1.5">{fmtUsd(10)} = {fmtSlsh(r * 10)} · {fmtSlsh(100000)} = {fmtUsd(100000 / r)}</p>}
      </div>
      <div className="field">
        <label className="label" htmlFor="note">{t("set.fxSource")}</label>
        <input id="note" name="note" className="input" />
      </div>
      <SubmitButton className="btn btn-block mt-5 sm:w-auto">{t("common.save")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function BusinessSettingsForm({ staleHours, seeAll }: { staleHours: number; seeAll: boolean }) {
  const t = useT();
  const [state, action] = useActionState(updateBusinessSettings, undefined);
  return (
    <form action={action}>
      <div className="field">
        <label className="label" htmlFor="stale">{t("set.staleHours")}</label>
        <input id="stale" name="fx_stale_hours" className="input num" inputMode="numeric" defaultValue={staleHours} required />
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5">
        <input type="checkbox" name="users_see_all_banjarka" defaultChecked={seeAll} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" />
        <span className="text-[14px] font-medium">{t("set.bjVisibility")}</span>
      </label>
      <SubmitButton className="btn btn-block mt-5 sm:w-auto">{t("common.save")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

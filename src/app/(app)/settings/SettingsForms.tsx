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
      <label className="field-label">{t("set.fxNew")}</label>
      <div className="flex items-center gap-2">
        <input name="rate" className="input" inputMode="decimal" placeholder={current ? String(current) : "11800"} value={rate}
          onChange={(e) => setRate(e.target.value.replace(/[^0-9.,]/g, ""))} required />
        <span className="font-bold">SlSh</span>
      </div>
      {r > 0 && <p className="muted mt-1.5">{fmtUsd(10)} = {fmtSlsh(r * 10)} • {fmtSlsh(100000)} = {fmtUsd(100000 / r)}</p>}
      <label className="field-label mt-3">{t("set.fxSource")} / {t("common.note")}</label>
      <input name="note" className="input mb-4" placeholder="e.g. Hargeisa market, 9am" />
      <SubmitButton>{t("common.save")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function BusinessSettingsForm({ staleHours, seeAll }: { staleHours: number; seeAll: boolean }) {
  const t = useT();
  const [state, action] = useActionState(updateBusinessSettings, undefined);
  return (
    <form action={action}>
      <label className="field-label">{t("set.staleHours")}</label>
      <input name="fx_stale_hours" className="input mb-4" inputMode="numeric" defaultValue={staleHours} required />
      <label className="mb-4 flex items-center gap-3">
        <input type="checkbox" name="users_see_all_banjarka" defaultChecked={seeAll} className="h-5 w-5 accent-brand" />
        <span>{t("set.bjVisibility")}</span>
      </label>
      <SubmitButton>{t("common.save")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

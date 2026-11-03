"use client";
import { useActionState, useRef, useState } from "react";
import { recordBanjarka } from "@/app/actions/records";
import { useT } from "@/lib/i18n/client";
import { banjarkaSplit, fmtMoney, num, type Currency } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { Alert } from "@/components/kit";
import { CurrencyToggle, FormMessage, SubmitButton, useResetOnSuccess } from "@/components/ui";

export function BanjarkaForm({ today }: { today: string }) {
  const t = useT();
  const [state, action] = useActionState(recordBanjarka, undefined);
  const [gross, setGross] = useState("");
  const [exp, setExp] = useState("");
  const [cur, setCur] = useState<Currency>("USD");
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref, () => {
    setGross("");
    setExp("");
  });
  const clean = (v: string) => v.replace(/[^0-9.,]/g, "");
  const g = num(gross.replace(/,/g, ""));
  const split = banjarkaSplit(g, num(exp.replace(/,/g, "")));
  const m = (v: number) => fmtMoney(v, cur);

  return (
    <form action={action} ref={ref} className="grid gap-4 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
      <section className="card">
        <h2 className="section-title">{t("bj.formTitle")}</h2>
        <p className="hint mt-1">{t("bj.formHint")}</p>
        <div className="field mt-4">
          <label className="label" htmlFor="gross">{t("bj.gross")}</label>
          <input id="gross" name="gross" className="input input-lg num" inputMode="decimal" placeholder="0" value={gross} onChange={(e) => setGross(clean(e.target.value))} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="expenses">{t("bj.expenses")} <span className="font-normal text-muted">({t("common.optional")})</span></label>
          <input id="expenses" name="expenses" className="input num" inputMode="decimal" placeholder="0" value={exp} onChange={(e) => setExp(clean(e.target.value))} />
        </div>
        {num(exp) > 0 && (
          <div className="field">
            <label className="label" htmlFor="expense_reason">{t("bj.expenseReason")}</label>
            <input id="expense_reason" name="expense_reason" className="input" required minLength={3} />
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="label">{t("common.currency")}</label>
            <CurrencyToggle value={cur} onChange={setCur} />
          </div>
          <div className="min-w-0">
            <label className="label" htmlFor="work_date">{t("bj.workDate")}</label>
            <input id="work_date" type="date" name="work_date" className="input" defaultValue={today} max={today} />
          </div>
        </div>
      </section>

      <section className="card lg:sticky lg:top-20">
        <h2 className="section-title">{t("bj.calcTitle")}</h2>
        {split.ok ? (
          <>
            <div className="mt-4 rounded-2xl bg-navy-900 p-4 text-white">
              <div className="text-[13px] text-white/70">{t("bj.net")}</div>
              <div className="num text-[30px] font-extrabold leading-tight">{m(split.net)}</div>
              <div className="num mt-1 text-[13px] text-white/60">{m(split.gross)} − {m(split.expenses)}</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-brand-50 p-3.5">
                <div className="text-[12.5px] font-semibold text-brand-700">{t("bj.workerShare")}</div>
                <div className="num mt-1 text-[20px] font-extrabold text-brand-700">{m(split.worker)}</div>
              </div>
              <div className="rounded-2xl bg-navy-800/5 p-3.5">
                <div className="text-[12.5px] font-semibold text-navy-700">{t("bj.shopShare")}</div>
                <div className="num mt-1 text-[20px] font-extrabold text-navy-800">{m(split.shop)}</div>
              </div>
            </div>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div className="w-1/2 bg-brand-500" /><div className="w-1/2 bg-navy-700" />
            </div>
          </>
        ) : (
          <Alert tone="error" className="mt-4">{t("bj.exceeds")}</Alert>
        )}
        <SubmitButton className="btn btn-block mt-5 h-14 text-[16px]" disabled={!split.ok || !g}>
          <Icon name="check" /> {t("bj.save")}
        </SubmitButton>
        <FormMessage state={state} />
        <p className="hint mt-3 flex items-start gap-1.5"><Icon name="shield" className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t("bj.adminNote")}</p>
      </section>
    </form>
  );
}

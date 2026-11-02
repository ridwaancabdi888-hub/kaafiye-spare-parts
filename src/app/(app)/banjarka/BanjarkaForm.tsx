"use client";
import { useActionState, useRef, useState } from "react";
import { recordBanjarka } from "@/app/actions/records";
import { useT } from "@/lib/i18n/client";
import { banjarkaSplit, fmtMoney, num, type Currency } from "@/lib/format";
import { CurrencySelect, FormMessage, SubmitButton, useResetOnSuccess } from "@/components/ui";

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
  const split = banjarkaSplit(num(gross.replace(/,/g, "")), num(exp.replace(/,/g, "")));
  const m = (v: number) => fmtMoney(v, cur);

  return (
    <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.15fr_.85fr]">
      <section className="card">
        <h2 className="mb-3 mt-2 text-[22px] font-bold">{t("bj.formTitle")}</h2>
        <p className="muted">{t("bj.formHint")}</p>
        <form action={action} ref={ref}>
          <div className="my-4">
            <label className="field-label">{t("bj.gross")}</label>
            <input name="gross" className="input" inputMode="decimal" value={gross} onChange={(e) => setGross(clean(e.target.value))} required />
          </div>
          <div className="my-4">
            <label className="field-label">{t("bj.expenses")}</label>
            <input name="expenses" className="input" inputMode="decimal" value={exp} onChange={(e) => setExp(clean(e.target.value))} placeholder="0" />
          </div>
          <div className="my-4">
            <label className="field-label">{t("bj.expenseReason")}{num(exp) > 0 && " *"}</label>
            <input name="expense_reason" className="input" required={num(exp) > 0} minLength={num(exp) > 0 ? 3 : undefined} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t("common.currency")}</label>
              <CurrencySelect value={cur} onChange={setCur} />
            </div>
            <div>
              <label className="field-label">{t("bj.workDate")}</label>
              <input type="date" name="work_date" className="input" defaultValue={today} max={today} />
            </div>
          </div>
          <div className="mt-5">
            <SubmitButton disabled={!split.ok || !gross}>{t("bj.save")}</SubmitButton>
          </div>
          <FormMessage state={state} />
          <p className="muted mt-3">{t("bj.saveHint")}</p>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-3 mt-2 text-[22px] font-bold">{t("bj.calcTitle")}</h2>
        {split.ok ? (
          <ul>
            <li className="row-item"><span>{t("bj.revenue")}</span><strong>{m(split.gross)}</strong></li>
            <li className="row-item"><span>{t("bj.expenses")}</span><strong>− {m(split.expenses)}</strong></li>
            <li className="row-item"><span>{t("bj.net")}</span><strong>{m(split.net)}</strong></li>
            <li className="row-item"><span>{t("bj.workerShare")}</span><strong className="text-ok">{m(split.worker)}</strong></li>
            <li className="row-item"><span>{t("bj.shopShare")}</span><strong className="text-ok">{m(split.shop)}</strong></li>
          </ul>
        ) : (
          <p role="alert" className="rounded-lg bg-[#fbeaea] px-3 py-3 text-sm font-bold text-bad">⚠ {t("bj.exceeds")}</p>
        )}
        <p className="muted mt-3">{t("bj.adminNote")}</p>
      </section>
    </div>
  );
}

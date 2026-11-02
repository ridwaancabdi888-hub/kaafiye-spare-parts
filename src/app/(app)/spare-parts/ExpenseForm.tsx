"use client";
import { useActionState, useRef, useState } from "react";
import { recordCashExpense, recordItemExpense } from "@/app/actions/records";
import { useT } from "@/lib/i18n/client";
import { fmtInt, fmtUsdPrecise, num } from "@/lib/format";
import { CurrencySelect, FormMessage, SubmitButton, useResetOnSuccess } from "@/components/ui";
import type { Product } from "@/lib/types";

/** Cash expense, or stock used/damaged (decrements stock, valued at cost). Reason is mandatory. */
export function ExpenseForm({ products }: { products: Product[] }) {
  const t = useT();
  const [kind, setKind] = useState<"cash" | "item">("cash");
  return (
    <div>
      <div className="my-3 inline-flex rounded-lg bg-tag p-1 text-sm">
        {(["cash", "item"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-md px-3 py-1.5 ${kind === k ? "bg-white font-bold text-tag-ink shadow-sm" : "text-muted"}`}
          >
            {k === "cash" ? t("sp.expenseCash") : t("sp.expenseItem")}
          </button>
        ))}
      </div>
      {kind === "cash" ? <CashForm /> : <ItemForm products={products} />}
    </div>
  );
}

function CashForm() {
  const t = useT();
  const [state, action] = useActionState(recordCashExpense, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref);
  return (
    <form action={action} ref={ref}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">{t("common.amount")}</label>
          <input name="amount" className="input" inputMode="decimal" required />
        </div>
        <div>
          <label className="field-label">{t("common.currency")}</label>
          <CurrencySelect />
        </div>
      </div>
      <div className="my-3">
        <label className="field-label">{t("common.reason")} *</label>
        <input name="reason" className="input" required minLength={3} />
      </div>
      <SubmitButton>{t("sp.saveExpense")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

function ItemForm({ products }: { products: Product[] }) {
  const t = useT();
  const [state, action] = useActionState(recordItemExpense, undefined);
  const [pid, setPid] = useState("");
  const [qty, setQty] = useState("1");
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref, () => {
    setPid("");
    setQty("1");
  });
  const p = products.find((x) => x.id === pid);
  return (
    <form action={action} ref={ref}>
      <div className="mb-3">
        <label className="field-label">{t("sp.product")}</label>
        <select name="product_id" className="input" value={pid} onChange={(e) => setPid(e.target.value)} required>
          <option value="">{t("sp.selectProduct")}</option>
          {products.map((x) => (
            <option key={x.id} value={x.id} disabled={x.stock_qty <= 0}>
              {x.name} ({fmtInt(x.stock_qty)})
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3">
        <label className="field-label">{t("common.quantity")}</label>
        <input name="quantity" className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))} required />
      </div>
      <div className="mb-3">
        <label className="field-label">{t("common.reason")} *</label>
        <input name="reason" className="input" required minLength={3} />
      </div>
      {p && <p className="muted mb-3">{t("sp.itemValue")}: <b>{fmtUsdPrecise(num(qty) * p.cost_usd)}</b></p>}
      <SubmitButton>{t("sp.saveExpense")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

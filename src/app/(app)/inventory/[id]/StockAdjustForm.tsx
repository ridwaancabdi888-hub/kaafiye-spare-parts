"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { adjustStock, setProductStatus } from "@/app/actions/admin";
import { useT } from "@/lib/i18n/client";
import { Icon } from "@/components/Icon";
import { FormMessage, SubmitButton, useResetOnSuccess } from "@/components/ui";

export function StockAdjustForm({ productId }: { productId: string }) {
  const t = useT();
  const [state, action] = useActionState(adjustStock, undefined);
  const [kind, setKind] = useState<"opening" | "purchase" | "adjustment">("purchase");
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref);
  return (
    <form action={action} ref={ref} className="card">
      <h2 className="section-title">{t("inv.adjust")}</h2>
      <p className="hint mt-1">{t("inv.adjustHint")}</p>
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="mt-4 grid gap-2">
        {(["purchase", "adjustment", "opening"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
            className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-left text-[14px] font-semibold transition ${kind === k ? "border-brand-500 bg-brand-50 text-brand-800" : "border-line text-ink-2"}`}>
            <span className={`h-4 w-4 rounded-full border-2 ${kind === k ? "border-brand-600 bg-brand-600 ring-2 ring-inset ring-white" : "border-slate-300"}`} />
            {t(`inv.kind.${k}`)}
          </button>
        ))}
      </div>
      <div className="field mt-4">
        <label className="label">{t("inv.qtyChange")}</label>
        <input name="qty_change" className="input num" inputMode={kind === "adjustment" ? "text" : "numeric"} placeholder={kind === "adjustment" ? "-2 / 3" : "10"} required />
      </div>
      {kind !== "adjustment" && (
        <div className="field">
          <label className="label">{t("inv.unitCostOptional")}</label>
          <input name="unit_cost_usd" className="input num" inputMode="decimal" />
        </div>
      )}
      <div className="field">
        <label className="label">{kind === "adjustment" ? t("common.reason") : t("common.note")}</label>
        <input name="note" className="input" required={kind === "adjustment"} minLength={kind === "adjustment" ? 3 : undefined} />
      </div>
      <SubmitButton className="btn btn-block mt-5">{t("common.save")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function ArchiveButton({ productId, status }: { productId: string; status: "active" | "archived" }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className={status === "active" ? "btn-secondary btn-sm" : "btn-soft btn-sm"}
      onClick={() => start(async () => void (await setProductStatus(productId, status === "active" ? "archived" : "active")))}>
      <Icon name={status === "active" ? "ban" : "history"} className="h-4 w-4" />
      {status === "active" ? t("inv.archive") : t("inv.restore")}
    </button>
  );
}

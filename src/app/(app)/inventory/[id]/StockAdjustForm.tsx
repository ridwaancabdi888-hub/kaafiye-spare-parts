"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { adjustStock, setProductStatus } from "@/app/actions/admin";
import { useT } from "@/lib/i18n/client";
import { FormMessage, SubmitButton, useResetOnSuccess } from "@/components/ui";

export function StockAdjustForm({ productId }: { productId: string }) {
  const t = useT();
  const [state, action] = useActionState(adjustStock, undefined);
  const [kind, setKind] = useState<"opening" | "purchase" | "adjustment">("purchase");
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref);
  return (
    <form action={action} ref={ref} className="card h-fit">
      <h2 className="mb-4 text-xl font-bold">{t("inv.adjust")}</h2>
      <input type="hidden" name="product_id" value={productId} />
      <label className="field-label">{t("exp.kind")}</label>
      <select name="kind" className="input mb-3" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
        <option value="opening">{t("inv.kind.opening")}</option>
        <option value="purchase">{t("inv.kind.purchase")}</option>
        <option value="adjustment">{t("inv.kind.adjustment")}</option>
      </select>
      <label className="field-label">{t("inv.qtyChange")}</label>
      <input name="qty_change" className="input mb-3" inputMode={kind === "adjustment" ? "text" : "numeric"} placeholder={kind === "adjustment" ? "-2 / +3" : "10"} required />
      {kind !== "adjustment" && (
        <>
          <label className="field-label">{t("inv.unitCostOptional")}</label>
          <input name="unit_cost_usd" className="input mb-3" inputMode="decimal" />
        </>
      )}
      <label className="field-label">{kind === "adjustment" ? `${t("common.reason")} *` : t("common.note")}</label>
      <input name="note" className="input mb-4" required={kind === "adjustment"} minLength={kind === "adjustment" ? 3 : undefined} />
      <SubmitButton>{t("common.save")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function ArchiveButton({ productId, status }: { productId: string; status: "active" | "archived" }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={status === "active" ? "btn-danger btn-sm" : "btn-light btn-sm"}
      onClick={() => start(async () => void (await setProductStatus(productId, status === "active" ? "archived" : "active")))}
    >
      {status === "active" ? t("inv.archive") : t("inv.restore")}
    </button>
  );
}

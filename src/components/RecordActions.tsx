"use client";
import { useActionState, useEffect, useState } from "react";
import { updateBanjarka, updateExpense, updateSale, voidRecord } from "@/app/actions/records";
import { useT } from "@/lib/i18n/client";
import { banjarkaSplit, editTimeLeft, fmtDuration, fmtMoney, num, type Currency } from "@/lib/format";
import { CurrencySelect, FormMessage, Modal, SubmitButton } from "./ui";
import type { BanjarkaRecord, Expense, Sale } from "@/lib/types";

type Props =
  | { table: "sales"; record: Sale }
  | { table: "expenses"; record: Expense }
  | { table: "banjarka_records"; record: BanjarkaRecord };

/**
 * Edit/void controls. Authors get exactly 5h from the original server timestamp; admins can
 * make reasoned corrections later. Postgres re-checks all of this — the UI only mirrors it.
 */
export function RecordActions({ isOwn, isAdmin, ...p }: Props & { isOwn: boolean; isAdmin: boolean }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  const [mode, setMode] = useState<null | "edit" | "void">(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  if (p.record.status === "voided") return <span className="text-xs font-bold text-bad">{t("common.voided")}</span>;

  const left = editTimeLeft(p.record.created_at, now);
  const authorWindow = isOwn && left > 0;
  const correction = !authorWindow && isAdmin;
  if (!authorWindow && !correction) return <span className="text-xs text-muted">🔒 {t("common.locked")}</span>;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" className="btn-light btn-sm" onClick={() => setMode("edit")}>
        ✎ {correction ? t("rep.correction") : t("common.edit")}
      </button>
      <button type="button" className="btn-danger btn-sm" onClick={() => setMode("void")}>
        {t("common.void")}
      </button>
      {authorWindow && <span className="text-[11px] text-muted">{t("common.editLeft", { t: fmtDuration(left) })}</span>}
      <Modal open={mode === "edit"} onClose={() => setMode(null)} title={correction ? t("rep.correction") : t("common.edit")}>
        {correction && <p className="muted mb-3">{t("rep.correctionHint")}</p>}
        <EditForm {...p} reasonRequired={correction} onDone={() => setMode(null)} />
      </Modal>
      <Modal open={mode === "void"} onClose={() => setMode(null)} title={t("common.void")}>
        <VoidForm table={p.table} id={p.record.id} onDone={() => setMode(null)} />
      </Modal>
    </div>
  );
}

function ReasonField({ required }: { required: boolean }) {
  const t = useT();
  return (
    <div className="mb-3">
      <label className="field-label">{required ? t("common.editReason") : t("common.editReasonOptional")}</label>
      <input name="edit_reason" className="input" required={required} minLength={required ? 3 : undefined} />
    </div>
  );
}

function useCloseOnOk(state: { ok?: boolean; at?: number } | undefined, onDone: () => void) {
  useEffect(() => {
    if (state?.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.at]);
}

function EditForm(p: Props & { reasonRequired: boolean; onDone: () => void }) {
  if (p.table === "sales") return <SaleEdit record={p.record} reasonRequired={p.reasonRequired} onDone={p.onDone} />;
  if (p.table === "expenses") return <ExpenseEdit record={p.record} reasonRequired={p.reasonRequired} onDone={p.onDone} />;
  return <BanjarkaEdit record={p.record} reasonRequired={p.reasonRequired} onDone={p.onDone} />;
}

function SaleEdit({ record, reasonRequired, onDone }: { record: Sale; reasonRequired: boolean; onDone: () => void }) {
  const t = useT();
  const [state, action] = useActionState(updateSale, undefined);
  const [qty, setQty] = useState(String(record.quantity));
  const [price, setPrice] = useState(String(num(record.unit_price)));
  const [cur, setCur] = useState<Currency>(record.currency);
  useCloseOnOk(state, onDone);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={record.id} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">{t("common.quantity")}</label>
          <input name="quantity" className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div>
          <label className="field-label">{t("sp.unitPrice")}</label>
          <input name="unit_price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
      <div className="my-3">
        <label className="field-label">{t("common.currency")}</label>
        <CurrencySelect value={cur} onChange={setCur} />
      </div>
      <input type="hidden" name="note" value={record.note ?? ""} />
      <p className="mb-3 font-bold">{t("sp.total")}: {fmtMoney(num(qty) * num(price.replace(/,/g, "")), cur)}</p>
      <ReasonField required={reasonRequired} />
      <SubmitButton className="btn w-full">{t("common.save")}</SubmitButton>
      <FormMessage state={state?.error ? state : undefined} />
    </form>
  );
}

function ExpenseEdit({ record, reasonRequired, onDone }: { record: Expense; reasonRequired: boolean; onDone: () => void }) {
  const t = useT();
  const [state, action] = useActionState(updateExpense, undefined);
  useCloseOnOk(state, onDone);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={record.id} />
      {record.kind === "cash" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t("common.amount")}</label>
            <input name="amount" className="input" inputMode="decimal" defaultValue={num(record.amount)} />
          </div>
          <div>
            <label className="field-label">{t("common.currency")}</label>
            <CurrencySelect defaultValue={record.currency} />
          </div>
        </div>
      ) : (
        <div>
          <label className="field-label">{t("common.quantity")}</label>
          <input name="quantity" className="input" inputMode="numeric" defaultValue={record.quantity ?? 1} />
        </div>
      )}
      <div className="my-3">
        <label className="field-label">{t("common.reason")}</label>
        <input name="reason" className="input" defaultValue={record.reason} required minLength={3} />
      </div>
      <ReasonField required={reasonRequired} />
      <SubmitButton className="btn w-full">{t("common.save")}</SubmitButton>
      <FormMessage state={state?.error ? state : undefined} />
    </form>
  );
}

function BanjarkaEdit({ record, reasonRequired, onDone }: { record: BanjarkaRecord; reasonRequired: boolean; onDone: () => void }) {
  const t = useT();
  const [state, action] = useActionState(updateBanjarka, undefined);
  const [gross, setGross] = useState(String(num(record.gross)));
  const [exp, setExp] = useState(String(num(record.expenses)));
  const [cur, setCur] = useState<Currency>(record.currency);
  const split = banjarkaSplit(num(gross.replace(/,/g, "")), num(exp.replace(/,/g, "")));
  useCloseOnOk(state, onDone);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={record.id} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">{t("bj.gross")}</label>
          <input name="gross" className="input" inputMode="decimal" value={gross} onChange={(e) => setGross(e.target.value)} />
        </div>
        <div>
          <label className="field-label">{t("bj.expenses")}</label>
          <input name="expenses" className="input" inputMode="decimal" value={exp} onChange={(e) => setExp(e.target.value)} />
        </div>
      </div>
      <div className="my-3">
        <label className="field-label">{t("bj.expenseReason")}</label>
        <input name="expense_reason" className="input" defaultValue={record.expense_reason ?? ""} />
      </div>
      <div className="mb-3">
        <label className="field-label">{t("common.currency")}</label>
        <CurrencySelect value={cur} onChange={setCur} />
      </div>
      <input type="hidden" name="note" value={record.note ?? ""} />
      {split.ok ? (
        <p className="mb-3 text-sm">
          {t("bj.net")}: <b>{fmtMoney(split.net, cur)}</b> • {t("bj.workerShare")}: <b className="text-ok">{fmtMoney(split.worker, cur)}</b>
        </p>
      ) : (
        <p className="mb-3 text-sm font-bold text-bad">{t("bj.exceeds")}</p>
      )}
      <ReasonField required={reasonRequired} />
      <SubmitButton className="btn w-full" disabled={!split.ok}>{t("common.save")}</SubmitButton>
      <FormMessage state={state?.error ? state : undefined} />
    </form>
  );
}

function VoidForm({ table, id, onDone }: { table: string; id: string; onDone: () => void }) {
  const t = useT();
  const [state, action] = useActionState(voidRecord, undefined);
  useCloseOnOk(state, onDone);
  return (
    <form action={action}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <ReasonField required />
      <SubmitButton className="btn-danger w-full">{t("common.void")}</SubmitButton>
      <FormMessage state={state?.error ? state : undefined} />
    </form>
  );
}

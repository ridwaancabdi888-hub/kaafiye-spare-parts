"use client";
import { useActionState, useEffect, useState } from "react";
import { updateBanjarka, updateExpense, updateSale, voidRecord } from "@/app/actions/records";
import { useLang, useT } from "@/lib/i18n/client";
import { banjarkaSplit, editTimeLeft, fmtDuration, fmtMoney, num, type Currency } from "@/lib/format";
import { CurrencyToggle, FormMessage, Modal, QtyStepper, SubmitButton } from "./ui";
import { Alert } from "./kit";
import { Icon } from "./Icon";
import type { BanjarkaRecord, Expense, Sale } from "@/lib/types";

type Props =
  | { table: "sales"; record: Sale }
  | { table: "expenses"; record: Expense }
  | { table: "banjarka_records"; record: BanjarkaRecord };

/**
 * Edit/void controls. Authors get exactly 5h from the original server timestamp; admins can make
 * reasoned corrections later. Postgres re-checks all of this — the UI only mirrors it.
 */
export function RecordActions({ isOwn, isAdmin, ...p }: Props & { isOwn: boolean; isAdmin: boolean }) {
  const t = useT();
  const lang = useLang();
  const [now, setNow] = useState(() => Date.now());
  const [mode, setMode] = useState<null | "edit" | "void">(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  if (p.record.status === "voided") return <span className="badge badge-red">{t("common.voided")}</span>;

  const left = editTimeLeft(p.record.created_at, now);
  const authorWindow = isOwn && left > 0;
  const correction = !authorWindow && isAdmin;
  if (!authorWindow && !correction) {
    return (
      <span className="badge badge-slate">
        <Icon name="lock" className="h-3 w-3" /> {t("common.locked")}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" className="btn-soft btn-sm" onClick={() => setMode("edit")}>
        <Icon name="pencil" className="h-3.5 w-3.5" /> {correction ? t("rep.correction") : t("common.edit")}
      </button>
      <button type="button" className="btn-danger btn-sm" onClick={() => setMode("void")}>
        <Icon name="ban" className="h-3.5 w-3.5" /> {t("common.void")}
      </button>
      {authorWindow && (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-muted">
          <Icon name="clock" className="h-3 w-3" /> {t("common.editLeft", { t: fmtDuration(left, lang) })}
        </span>
      )}
      <Modal open={mode === "edit"} onClose={() => setMode(null)} title={correction ? t("rep.correction") : t("common.edit")}>
        {correction && <Alert tone="info" className="mb-4">{t("rep.correctionHint")}</Alert>}
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
    <div className="field">
      <label className="label">{required ? t("common.editReason") : t("common.editReasonOptional")}</label>
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
      <input type="hidden" name="note" value={record.note ?? ""} />
      <div className="field">
        <label className="label">{t("common.quantity")}</label>
        <QtyStepper value={qty} onChange={setQty} />
      </div>
      <div className="field">
        <label className="label">{t("sp.unitPrice")}</label>
        <input name="unit_price" className="input num" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ""))} />
      </div>
      <div className="field">
        <label className="label">{t("common.currency")}</label>
        <CurrencyToggle value={cur} onChange={setCur} />
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-canvas px-4 py-3">
        <span className="text-[14px] text-muted">{t("sp.total")}</span>
        <span className="num text-lg font-extrabold">{fmtMoney(num(qty) * num(price.replace(/,/g, "")), cur)}</span>
      </div>
      <div className="mt-4"><ReasonField required={reasonRequired} /></div>
      <SubmitButton className="btn btn-block mt-5">{t("common.save")}</SubmitButton>
      <FormMessage state={state?.error ? state : undefined} />
    </form>
  );
}

function ExpenseEdit({ record, reasonRequired, onDone }: { record: Expense; reasonRequired: boolean; onDone: () => void }) {
  const t = useT();
  const [state, action] = useActionState(updateExpense, undefined);
  const [qty, setQty] = useState(String(record.quantity ?? 1));
  useCloseOnOk(state, onDone);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={record.id} />
      {record.kind === "cash" ? (
        <>
          <div className="field">
            <label className="label">{t("common.amount")}</label>
            <input name="amount" className="input num" inputMode="decimal" defaultValue={num(record.amount)} />
          </div>
          <div className="field">
            <label className="label">{t("common.currency")}</label>
            <CurrencyToggle defaultValue={record.currency} />
          </div>
        </>
      ) : (
        <div className="field">
          <label className="label">{t("common.quantity")}</label>
          <QtyStepper value={qty} onChange={setQty} />
        </div>
      )}
      <div className="field">
        <label className="label">{t("common.reason")}</label>
        <input name="reason" className="input" defaultValue={record.reason} required minLength={3} />
      </div>
      <div className="mt-4"><ReasonField required={reasonRequired} /></div>
      <SubmitButton className="btn btn-block mt-5">{t("common.save")}</SubmitButton>
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
      <input type="hidden" name="note" value={record.note ?? ""} />
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className="label">{t("bj.gross")}</label>
          <input name="gross" className="input num" inputMode="decimal" value={gross} onChange={(e) => setGross(e.target.value.replace(/[^0-9.,]/g, ""))} />
        </div>
        <div className="min-w-0">
          <label className="label">{t("bj.expenses")}</label>
          <input name="expenses" className="input num" inputMode="decimal" value={exp} onChange={(e) => setExp(e.target.value.replace(/[^0-9.,]/g, ""))} />
        </div>
      </div>
      <div className="field mt-4">
        <label className="label">{t("bj.expenseReason")}</label>
        <input name="expense_reason" className="input" defaultValue={record.expense_reason ?? ""} />
      </div>
      <div className="field">
        <label className="label">{t("common.currency")}</label>
        <CurrencyToggle value={cur} onChange={setCur} />
      </div>
      {split.ok ? (
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-canvas p-3"><div className="text-[12px] text-muted">{t("bj.net")}</div><div className="num font-extrabold">{fmtMoney(split.net, cur)}</div></div>
          <div className="rounded-xl bg-brand-50 p-3"><div className="text-[12px] text-brand-700">{t("bj.workerShare")}</div><div className="num font-extrabold text-brand-700">{fmtMoney(split.worker, cur)}</div></div>
        </div>
      ) : (
        <Alert tone="error" className="mt-4">{t("bj.exceeds")}</Alert>
      )}
      <div className="mt-4"><ReasonField required={reasonRequired} /></div>
      <SubmitButton className="btn btn-block mt-5" disabled={!split.ok}>{t("common.save")}</SubmitButton>
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
      <SubmitButton className="btn-danger btn-block mt-5">{t("common.void")}</SubmitButton>
      <FormMessage state={state?.error ? state : undefined} />
    </form>
  );
}

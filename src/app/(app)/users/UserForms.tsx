"use client";
import { useActionState, useRef, useState } from "react";
import { createStaff } from "@/app/actions/account";
import { recordReward, voidReward } from "@/app/actions/records";
import { useT } from "@/lib/i18n/client";
import { Icon } from "@/components/Icon";
import { NewAccountFields } from "@/components/AccountControls";
import { CurrencyToggle, FormMessage, Modal, SubmitButton, useResetOnSuccess } from "@/components/ui";

export function AddStaffButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}><Icon name="userPlus" /> {t("users.add")}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("users.add")}>
        <AddStaffForm />
      </Modal>
    </>
  );
}

// Lives inside the dialog, so its result message resets every time the dialog opens.
function AddStaffForm() {
  const t = useT();
  const [state, action] = useActionState(createStaff, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref);
  return (
    <form action={action} ref={ref}>
      <NewAccountFields />
      <SubmitButton className="btn btn-block mt-5">{t("users.create")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Admin notes a reward they decided to give. Nothing is paid or deducted automatically. */
export function RewardButton({ members, today }: { members: { user_id: string; full_name: string }[]; today: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-soft btn-sm" onClick={() => setOpen(true)}><Icon name="award" className="h-4 w-4" /> {t("perf.addReward")}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("perf.addReward")}>
        <RewardForm members={members} today={today} />
      </Modal>
    </>
  );
}

function RewardForm({ members, today }: { members: { user_id: string; full_name: string }[]; today: string }) {
  const t = useT();
  const [state, action] = useActionState(recordReward, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref);
  return (
    <form action={action} ref={ref}>
      <p className="hint mb-4">{t("perf.rewardHelp")}</p>
      <div className="field">
        <label className="label">{t("common.employee")}</label>
        <select name="user_id" className="input" required defaultValue="">
          <option value="" disabled>—</option>
          {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="label">{t("common.amount")}</label>
        <input name="amount" className="input num" inputMode="decimal" required autoComplete="off" />
      </div>
      <div className="field">
        <label className="label">{t("common.currency")}</label>
        <CurrencyToggle />
      </div>
      <div className="field">
        <label className="label">{t("common.date")}</label>
        <input type="date" name="reward_date" className="input" defaultValue={today} max={today} required />
      </div>
      <div className="field">
        <label className="label">{t("common.reason")}</label>
        <input name="reason" className="input" required minLength={3} autoComplete="off" />
      </div>
      <SubmitButton className="btn btn-block mt-5">{t("common.save")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function VoidRewardButton({ id }: { id: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(voidReward, undefined);
  return (
    <>
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>{t("common.void")}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("perf.voidReward")}>
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <label className="label">{t("common.reason")}</label>
          <input name="reason" className="input" required minLength={3} autoComplete="off" />
          <SubmitButton className="btn-danger btn-block mt-5">{t("common.void")}</SubmitButton>
          <FormMessage state={state} />
        </form>
      </Modal>
    </>
  );
}

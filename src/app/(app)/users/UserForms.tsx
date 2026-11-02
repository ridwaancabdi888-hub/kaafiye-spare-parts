"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { createStaff, resetStaffPassword, setStaffActive } from "@/app/actions/admin";
import { useT } from "@/lib/i18n/client";
import { FormMessage, Modal, SubmitButton, useResetOnSuccess } from "@/components/ui";

export function CreateStaffForm() {
  const t = useT();
  const [state, action] = useActionState(createStaff, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref);
  return (
    <form action={action} ref={ref} className="card h-fit">
      <h2 className="mb-4 text-xl font-bold">{t("users.add")}</h2>
      <label className="field-label">{t("users.fullName")}</label>
      <input name="full_name" className="input mb-3" required />
      <label className="field-label">{t("users.username")}</label>
      <input name="username" className="input mb-3" autoCapitalize="none" autoComplete="off" required pattern="[A-Za-z0-9._@+\-]{3,64}" />
      <label className="field-label">{t("users.password")}</label>
      <input name="password" type="password" className="input mb-3" minLength={8} autoComplete="new-password" required />
      <label className="field-label">{t("users.role")}</label>
      <select name="role" className="input mb-4" defaultValue="user">
        <option value="user">{t("role.user")}</option>
        <option value="admin">{t("role.admin")}</option>
      </select>
      <SubmitButton>{t("users.create")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function StaffRowActions({ userId, active }: { userId: string; active: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(resetStaffPassword, undefined);
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        disabled={pending}
        className={active ? "btn-danger btn-sm" : "btn-light btn-sm"}
        onClick={() => start(async () => void (await setStaffActive(userId, !active)))}
      >
        {active ? t("users.disable") : t("users.enable")}
      </button>
      <button type="button" className="btn-light btn-sm" onClick={() => setOpen(true)}>{t("users.resetPassword")}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("users.resetPassword")}>
        <form action={action}>
          <input type="hidden" name="user_id" value={userId} />
          <input name="password" type="password" className="input mb-3" minLength={8} autoComplete="new-password" required />
          <SubmitButton className="btn w-full">{t("common.save")}</SubmitButton>
          <FormMessage state={state} />
        </form>
      </Modal>
    </div>
  );
}

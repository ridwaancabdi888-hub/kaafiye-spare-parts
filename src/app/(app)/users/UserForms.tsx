"use client";
import { useActionState, useRef, useState } from "react";
import { createStaff } from "@/app/actions/account";
import { useT } from "@/lib/i18n/client";
import { Icon } from "@/components/Icon";
import { NewAccountFields } from "@/components/AccountControls";
import { FormMessage, Modal, SubmitButton, useResetOnSuccess } from "@/components/ui";

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

"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { addBusinessAdmin, createBusinessWithAdmin, setBusinessActive } from "@/app/actions/admin";
import { useT } from "@/lib/i18n/client";
import { FormMessage, Modal, SubmitButton, useResetOnSuccess } from "@/components/ui";

function AdminFields() {
  const t = useT();
  return (
    <>
      <label className="field-label">{t("super.adminName")}</label>
      <input name="admin_name" className="input mb-3" required />
      <label className="field-label">{t("super.adminLogin")}</label>
      <input name="admin_login" className="input mb-3" autoCapitalize="none" autoComplete="off" required />
      <label className="field-label">{t("super.adminPassword")}</label>
      <input name="admin_password" type="password" className="input mb-4" minLength={8} autoComplete="new-password" required />
    </>
  );
}

export function CreateBusinessForm() {
  const t = useT();
  const [state, action] = useActionState(createBusinessWithAdmin, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref);
  return (
    <form action={action} ref={ref} className="card h-fit">
      <h2 className="mb-4 text-xl font-bold">{t("super.create")}</h2>
      <label className="field-label">{t("super.name")}</label>
      <input name="name" className="input mb-3" required />
      <label className="field-label">{t("super.slug")}</label>
      <input name="slug" className="input mb-3" pattern="[a-z0-9\-]{2,40}" autoCapitalize="none" required />
      <AdminFields />
      <SubmitButton>{t("super.create")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function AddAdminButton({ businessId }: { businessId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(addBusinessAdmin, undefined);
  return (
    <>
      <button type="button" className="btn-light btn-sm" onClick={() => setOpen(true)}>+ {t("role.admin")}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={`+ ${t("role.admin")}`}>
        <form action={action}>
          <input type="hidden" name="business_id" value={businessId} />
          <AdminFields />
          <SubmitButton className="btn w-full">{t("users.create")}</SubmitButton>
          <FormMessage state={state} />
        </form>
      </Modal>
    </>
  );
}

export function BusinessToggle({ businessId, active }: { businessId: string; active: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={active ? "btn-danger btn-sm" : "btn-light btn-sm"}
      onClick={() => start(async () => void (await setBusinessActive(businessId, !active)))}
    >
      {active ? t("users.disable") : t("users.enable")}
    </button>
  );
}

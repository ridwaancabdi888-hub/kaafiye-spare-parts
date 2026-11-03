"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { addBusinessAdmin, createBusinessWithAdmin, setBusinessActive } from "@/app/actions/account";
import { useT } from "@/lib/i18n/client";
import { Icon } from "@/components/Icon";
import { NewAccountFields } from "@/components/AccountControls";
import { FormMessage, Modal, SubmitButton, useResetOnSuccess } from "@/components/ui";

// Forms live inside their dialog so the result message resets each time the dialog opens.

export function CreateBusinessButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}><Icon name="plus" /> {t("super.create")}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("super.create")}>
        <CreateBusinessForm />
      </Modal>
    </>
  );
}

function CreateBusinessForm() {
  const t = useT();
  const [state, action] = useActionState(createBusinessWithAdmin, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref);
  return (
    <form action={action} ref={ref}>
      <div className="field">
        <label className="label">{t("super.name")}</label>
        <input name="name" className="input" required />
      </div>
      <div className="field">
        <label className="label">{t("super.slug")}</label>
        <input name="slug" className="input" pattern="[a-z0-9\-]{2,40}" autoCapitalize="none" required />
        <p className="hint mt-1.5">{t("super.slugHelp")}</p>
      </div>
      <div className="my-5 h-px bg-line" />
      <NewAccountFields nameLabel={t("super.adminName")} usernameLabel={t("super.adminUsername")} passwordLabel={t("super.adminPassword")} />
      <SubmitButton className="btn btn-block mt-5">{t("super.create")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function AddAdminButton({ businessId }: { businessId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-soft btn-sm" onClick={() => setOpen(true)}><Icon name="userPlus" className="h-4 w-4" /> {t("super.addAdmin")}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("super.addAdmin")}>
        <AddAdminForm businessId={businessId} />
      </Modal>
    </>
  );
}

function AddAdminForm({ businessId }: { businessId: string }) {
  const t = useT();
  const [state, action] = useActionState(addBusinessAdmin, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref);
  return (
    <form action={action} ref={ref}>
      <input type="hidden" name="business_id" value={businessId} />
      <NewAccountFields nameLabel={t("super.adminName")} usernameLabel={t("super.adminUsername")} passwordLabel={t("super.adminPassword")} />
      <SubmitButton className="btn btn-block mt-5">{t("users.create")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function BusinessToggle({ businessId, active }: { businessId: string; active: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className={active ? "btn-secondary btn-sm" : "btn-soft btn-sm"}
      onClick={() => start(async () => void (await setBusinessActive(businessId, !active)))}>
      <Icon name={active ? "ban" : "checkCircle"} className="h-4 w-4" /> {active ? t("users.disable") : t("users.enable")}
    </button>
  );
}

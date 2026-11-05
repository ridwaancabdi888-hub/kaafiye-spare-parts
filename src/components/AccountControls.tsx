"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { archiveAccount, resetPassword, restoreAccount, setAccountActive, setUsername } from "@/app/actions/account";
import { useT } from "@/lib/i18n/client";
import { Icon } from "./Icon";
import { Alert } from "./kit";
import { FormMessage, Modal, PasswordInput, SubmitButton } from "./ui";

/** Reset password / set username / enable–disable for one account (server re-checks permission). */
export function AccountControls({ userId, name, username, active, canRemove = false }: {
  userId: string; name: string; username: string | null; active: boolean; canRemove?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState<null | "password" | "username" | "remove">(null);
  const [pending, start] = useTransition();
  const [toggleError, setToggleError] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-soft btn-sm" onClick={() => setOpen("password")}><Icon name="key" className="h-4 w-4" /> {t("users.resetPassword")}</button>
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen("username")}><Icon name="at" className="h-4 w-4" /> {t("users.setUsername")}</button>
      <button type="button" disabled={pending} className={active ? "btn-danger btn-sm" : "btn-soft btn-sm"}
        onClick={() => start(async () => setToggleError(Boolean((await setAccountActive(userId, !active))?.error)))}>
        <Icon name={active ? "ban" : "checkCircle"} className="h-4 w-4" /> {active ? t("users.disable") : t("users.enable")}
      </button>
      {canRemove && (
        <button type="button" className="btn-danger btn-sm" onClick={() => setOpen("remove")}>
          <Icon name="trash" className="h-4 w-4" /> {t("users.remove")}
        </button>
      )}
      {toggleError && <Alert tone="error" className="w-full">{t("err.generic")}</Alert>}
      <Modal open={open === "remove"} onClose={() => setOpen(null)} title={`${t("users.remove")} — ${name}`}>
        <RemoveConfirm userId={userId} name={name} onDone={() => setOpen(null)} />
      </Modal>
      <Modal open={open === "password"} onClose={() => setOpen(null)} title={`${t("users.resetPassword")} — ${name}`}>
        <ResetForm userId={userId} onDone={() => setOpen(null)} />
      </Modal>
      <Modal open={open === "username"} onClose={() => setOpen(null)} title={`${t("users.setUsername")} — ${name}`}>
        <UsernameForm userId={userId} current={username} onDone={() => setOpen(null)} />
      </Modal>
    </div>
  );
}

/** Archive, never delete: sign-in is blocked but every past record and log entry is kept. */
function RemoveConfirm({ userId, name, onDone }: { userId: string; name: string; onDone: () => void }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const [typed, setTyped] = useState("");
  return (
    <div>
      <p className="text-[14px] text-ink-2">{t("users.removeHelp", { name })}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-[13.5px] text-ink-2">
        <li>{t("users.removeKeeps")}</li>
        <li>{t("users.removeBlocks")}</li>
        <li>{t("users.removeUndo")}</li>
      </ul>
      <label className="label mt-4">{t("users.removeType", { name })}</label>
      <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" onClick={onDone}>{t("common.cancel")}</button>
        <button type="button" className="btn-danger" disabled={pending || typed.trim() !== name.trim()}
          onClick={() => start(async () => {
            const r = await archiveAccount(userId);
            if (r?.error) setError(true);
            else onDone();
          })}>
          <Icon name="trash" className="h-4 w-4" /> {t("users.removeConfirm")}
        </button>
      </div>
      {error && <Alert tone="error" className="mt-3">{t("err.generic")}</Alert>}
    </div>
  );
}

export function RestoreButton({ userId }: { userId: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  return (
    <>
      <button type="button" disabled={pending} className="btn-soft btn-sm"
        onClick={() => start(async () => setError(Boolean((await restoreAccount(userId))?.error)))}>
        <Icon name="checkCircle" className="h-4 w-4" /> {t("users.restore")}
      </button>
      {error && <Alert tone="error" className="mt-2">{t("err.generic")}</Alert>}
    </>
  );
}

function useCloseOnOk(state: { ok?: boolean; at?: number } | undefined, onDone: () => void) {
  useEffect(() => {
    if (!state?.ok) return;
    const id = setTimeout(onDone, 1200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.at]);
}

function ResetForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const t = useT();
  const [state, action] = useActionState(resetPassword, undefined);
  useCloseOnOk(state, onDone);
  return (
    <form action={action}>
      <input type="hidden" name="user_id" value={userId} />
      <p className="hint mb-4">{t("users.resetHelp")}</p>
      <label className="label">{t("users.password")}</label>
      <PasswordInput name="password" autoComplete="new-password" minLength={8} />
      <SubmitButton className="btn btn-block mt-5">{t("common.save")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

function UsernameForm({ userId, current, onDone }: { userId: string; current: string | null; onDone: () => void }) {
  const t = useT();
  const [state, action] = useActionState(setUsername, undefined);
  useCloseOnOk(state, onDone);
  return (
    <form action={action}>
      <input type="hidden" name="user_id" value={userId} />
      <label className="label">{t("users.username")}</label>
      <input name="username" className="input" defaultValue={current ?? ""} autoCapitalize="none" autoCorrect="off" spellCheck={false}
        pattern="[A-Za-z0-9._\-]{3,32}" required placeholder="kaafiye01" />
      <p className="hint mt-1.5">{t("users.usernameHelp")}</p>
      <SubmitButton className="btn btn-block mt-5">{t("common.save")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Create-account form fields shared by "add staff" and "add admin". */
export function NewAccountFields({ nameLabel, usernameLabel, passwordLabel }: { nameLabel?: string; usernameLabel?: string; passwordLabel?: string }) {
  const t = useT();
  return (
    <>
      <div className="field">
        <label className="label">{nameLabel ?? t("users.fullName")}</label>
        <input name="full_name" className="input" required autoComplete="off" />
      </div>
      <div className="field">
        <label className="label">{usernameLabel ?? t("users.username")}</label>
        <input name="username" className="input" required autoCapitalize="none" autoCorrect="off" spellCheck={false}
          pattern="[A-Za-z0-9._\-]{3,32}" placeholder="kaafiye01" autoComplete="off" />
        <p className="hint mt-1.5">{t("users.usernameHelp")}</p>
      </div>
      <div className="field">
        <label className="label">{passwordLabel ?? t("users.password")}</label>
        <PasswordInput name="password" autoComplete="new-password" minLength={8} />
        <p className="hint mt-1.5">{t("users.passwordHelp")}</p>
      </div>
    </>
  );
}

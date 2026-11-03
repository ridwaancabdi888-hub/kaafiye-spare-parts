"use client";
import { useActionState, useRef } from "react";
import { changeOwnPassword } from "@/app/actions/account";
import { useT } from "@/lib/i18n/client";
import { FormMessage, PasswordInput, SubmitButton, useResetOnSuccess } from "./ui";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const t = useT();
  const [state, action] = useActionState(changeOwnPassword, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref);
  return (
    <form action={action} ref={ref}>
      {!forced && (
        <div className="field">
          <label className="label">{t("pw.current")}</label>
          <PasswordInput name="current" autoComplete="current-password" />
        </div>
      )}
      <div className="field">
        <label className="label">{t("pw.new")}</label>
        <PasswordInput name="password" autoComplete="new-password" minLength={8} />
      </div>
      <div className="field">
        <label className="label">{t("pw.confirm")}</label>
        <PasswordInput name="confirm" autoComplete="new-password" minLength={8} />
      </div>
      <p className="hint mt-2">{t("pw.rules")}</p>
      <SubmitButton className="btn btn-block mt-5">{t("pw.submit")}</SubmitButton>
      <FormMessage state={state} success={t("pw.changed")} />
    </form>
  );
}

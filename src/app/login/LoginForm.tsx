"use client";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { useT } from "@/lib/i18n/client";
import { SubmitButton } from "@/components/ui";

export function LoginForm() {
  const t = useT();
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action}>
      <label className="field-label" htmlFor="identifier">{t("login.identifier")}</label>
      <input id="identifier" name="identifier" className="input mb-4" autoComplete="username" autoCapitalize="none" required />
      <label className="field-label" htmlFor="password">{t("login.password")}</label>
      <input id="password" name="password" type="password" className="input mb-2" autoComplete="current-password" required />
      {state?.error && <p role="alert" className="mb-2 text-sm font-bold text-bad">{t(state.error)}</p>}
      <SubmitButton className="btn mt-3 w-full">{t("login.submit")}</SubmitButton>
    </form>
  );
}

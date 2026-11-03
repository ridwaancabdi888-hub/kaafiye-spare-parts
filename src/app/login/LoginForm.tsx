"use client";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { useT } from "@/lib/i18n/client";
import { Icon } from "@/components/Icon";
import { Alert } from "@/components/kit";
import { PasswordInput, SubmitButton } from "@/components/ui";

export function LoginForm() {
  const t = useT();
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="mt-6">
      <div className="field">
        <label className="label" htmlFor="identifier">{t("login.identifier")}</label>
        <div className="relative">
          <Icon name="at" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input id="identifier" name="identifier" className="input pl-12" autoComplete="username" autoCapitalize="none"
            autoCorrect="off" spellCheck={false} placeholder="kaafiye01" required />
        </div>
        <p className="hint mt-1.5">{t("login.identifierHint")}</p>
      </div>
      <div className="field">
        <label className="label" htmlFor="password">{t("login.password")}</label>
        <PasswordInput id="password" name="password" />
      </div>
      {state?.error && <Alert tone="error" className="mt-4">{t(state.error, state.vars)}</Alert>}
      <SubmitButton className="btn btn-block mt-6">
        {t("login.submit")} <Icon name="chevronRight" className="h-5 w-5" />
      </SubmitButton>
    </form>
  );
}

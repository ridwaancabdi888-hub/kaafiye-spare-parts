"use client";
import { useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/lib/i18n/client";
import type { ActionState } from "@/lib/errors";
import type { Currency } from "@/lib/format";
import { Icon } from "./Icon";
import { Alert } from "./kit";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function SubmitButton({ children, className = "btn", disabled }: { children: React.ReactNode; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending}>
      {pending ? (
        <>
          <Spinner /> {t("common.saving")}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Success/error feedback for a form action. Success messages fade after a few seconds. */
export function FormMessage({ state, success }: { state: ActionState; success?: string }) {
  const t = useT();
  const [hidden, setHidden] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!state?.ok) return;
    const id = setTimeout(() => setHidden(state.at), 5000);
    return () => clearTimeout(id);
  }, [state?.ok, state?.at]);
  if (!state) return null;
  if (state.error) return <Alert tone="error" className="mt-3">{t(state.error, state.vars)}</Alert>;
  if (state.ok && hidden !== state.at) return <Alert tone="success" className="mt-3">{success ?? t("common.saved")}</Alert>;
  return null;
}

/** Two-option segmented control (USD | SlSh) backed by a hidden input for forms. */
export function CurrencyToggle({ name = "currency", value, onChange, defaultValue = "USD" }: {
  name?: string;
  value?: Currency;
  onChange?: (v: Currency) => void;
  defaultValue?: Currency;
}) {
  const t = useT();
  const [inner, setInner] = useState<Currency>(defaultValue);
  const v = value ?? inner;
  const set = (c: Currency) => {
    setInner(c);
    onChange?.(c);
  };
  return (
    <div role="radiogroup" aria-label={t("common.currency")} className="grid h-12 grid-cols-2 rounded-xl bg-slate-100 p-1">
      <input type="hidden" name={name} value={v} />
      {(["USD", "SLSH"] as const).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={v === c}
          onClick={() => set(c)}
          className={`rounded-lg text-[15px] font-semibold transition ${v === c ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {c === "USD" ? "$ USD" : "SlSh"}
        </button>
      ))}
    </div>
  );
}

export function QtyStepper({ id, name = "quantity", value, onChange, max }: {
  id?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
}) {
  const t = useT();
  const n = Number(value) || 0;
  return (
    <div className="flex h-12 items-stretch overflow-hidden rounded-xl border border-line-strong bg-white focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15">
      <button type="button" aria-label={t("sp.qtyMinus")} className="w-12 shrink-0 text-ink-2 hover:bg-canvas disabled:opacity-40"
        disabled={n <= 1} onClick={() => onChange(String(Math.max(1, n - 1)))}>
        <Icon name="minus" className="mx-auto h-5 w-5" />
      </button>
      <input
        id={id}
        name={name}
        inputMode="numeric"
        aria-label={t("common.quantity")}
        className="num w-full min-w-0 border-x border-line text-center text-lg font-bold outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        required
      />
      <button type="button" aria-label={t("sp.qtyPlus")} className="w-12 shrink-0 text-ink-2 hover:bg-canvas disabled:opacity-40"
        disabled={max !== undefined && n >= max} onClick={() => onChange(String(n + 1))}>
        <Icon name="plus" className="mx-auto h-5 w-5" />
      </button>
    </div>
  );
}

export function PasswordInput({ name, autoComplete = "current-password", id, required = true, minLength }: {
  name: string;
  autoComplete?: string;
  id?: string;
  required?: boolean;
  minLength?: number;
}) {
  const t = useT();
  const [show, setShow] = useState(false);
  const fallback = useId();
  return (
    <div className="relative">
      <input id={id ?? fallback} name={name} type={show ? "text" : "password"} className="input pr-14" autoComplete={autoComplete}
        required={required} minLength={minLength} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? t("common.hide") : t("common.show")} aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-ink">
        <Icon name={show ? "eyeOff" : "eye"} />
      </button>
    </div>
  );
}

/** Resets a form after a successful action. */
export function useResetOnSuccess(state: ActionState, ref: React.RefObject<HTMLFormElement | null>, after?: () => void) {
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      after?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.at]);
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="anim-sheet safe-bottom max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-[var(--shadow-pop)] sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <h3 className="text-[17px] font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="icon-btn -mr-2" aria-label={t("common.close")}>
            <Icon name="x" />
          </button>
        </div>
        <div className="px-5 pb-6 pt-4">{children}</div>
      </div>
    </div>
  );
}

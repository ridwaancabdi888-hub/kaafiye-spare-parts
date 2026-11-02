"use client";
import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/lib/i18n/client";
import type { ActionState } from "@/lib/errors";

export function SubmitButton({ children, className = "btn", disabled }: { children: React.ReactNode; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? "…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  const t = useT();
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" className="mt-3 rounded-lg bg-[#fbeaea] px-3 py-2 text-sm font-bold text-bad">
        {t(state.error)}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="mt-3 rounded-lg bg-pill px-3 py-2 text-sm font-bold text-ok">
        {t("common.saved")}
      </p>
    );
  return null;
}

export function CurrencySelect({ name = "currency", value, onChange, defaultValue }: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: "USD" | "SLSH") => void;
}) {
  const controlled = value !== undefined;
  return (
    <select
      name={name}
      className="input"
      {...(controlled ? { value } : { defaultValue: defaultValue ?? "USD" })}
      onChange={(e) => onChange?.(e.target.value as "USD" | "SLSH")}
    >
      <option value="USD">USD ($)</option>
      <option value="SLSH">SlSh (Shilin)</option>
    </select>
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

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-ink shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-muted hover:bg-canvas" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

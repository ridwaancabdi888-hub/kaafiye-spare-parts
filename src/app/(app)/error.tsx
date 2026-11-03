"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { Icon } from "@/components/Icon";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => console.error(error), [error]);
  return (
    <div className="mx-auto mt-10 max-w-md text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600"><Icon name="alert" className="h-7 w-7" /></span>
      <h1 className="mt-4 text-xl font-extrabold text-navy-900">{t("common.errorTitle")}</h1>
      <p className="mt-2 text-[14px] text-muted">{t("common.errorText")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="btn"><Icon name="history" /> {t("common.retry")}</button>
        <Link href="/dashboard" className="btn-secondary">{t("common.goHome")}</Link>
      </div>
    </div>
  );
}

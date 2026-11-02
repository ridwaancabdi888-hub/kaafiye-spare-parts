"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Uses the browser's real install prompt where available (Chromium). Elsewhere it shows
 * honest manual steps — there is no APK and nothing is force-installed.
 */
export function InstallButton({ className = "" }: { className?: string }) {
  const t = useT();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState<null | "ios" | "other">(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <div className={`flex items-center justify-center rounded-[10px] bg-brand-soft p-3 text-sm text-[#12665d] ${className}`}>
        {t("install.installed")}
      </div>
    );
  }

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setHelp(ios ? "ios" : "other");
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center justify-center gap-2.5 rounded-[10px] bg-[#eef6f5] p-[13px] text-[#12665d] transition hover:bg-pill ${className}`}
      >
        <span aria-hidden>⬇</span> {t("install.button")}
        {t("install.button") !== "Install App" && " / Install App"}
      </button>
      {help && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={() => setHelp(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-ink" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold">{help === "ios" ? t("install.iosTitle") : t("install.otherTitle")}</h3>
            <p className="text-sm text-label">{help === "ios" ? t("install.iosSteps") : t("install.otherSteps")}</p>
            <button type="button" className="btn mt-5 w-full" onClick={() => setHelp(null)}>
              {t("install.close")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

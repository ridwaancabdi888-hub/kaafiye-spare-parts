"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Icon } from "./Icon";
import { Modal } from "./ui";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Uses the browser's real install prompt where available (Chrome/Edge). Elsewhere it shows
 * honest manual steps — there is no APK and nothing is force-installed.
 */
export function InstallButton({ variant = "card" }: { variant?: "card" | "button" }) {
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

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      if ((await deferred.userChoice).outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setHelp(ios ? "ios" : "other");
  };

  if (installed) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-[14px] font-semibold text-brand-700">
        <Icon name="checkCircle" className="h-5 w-5" /> {t("install.installed")}
      </div>
    );
  }

  return (
    <>
      {variant === "card" ? (
        <button type="button" onClick={onClick}
          className="group flex w-full items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/70 p-3.5 text-left transition hover:border-brand-400 hover:bg-brand-50">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
            <Icon name="download" className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-brand-800">{t("install.button")}</span>
            <span className="block text-[13px] leading-snug text-brand-800/70">{t("install.text")}</span>
          </span>
          <Icon name="chevronRight" className="ml-auto h-5 w-5 shrink-0 text-brand-600 transition group-hover:translate-x-0.5" />
        </button>
      ) : (
        <button type="button" onClick={onClick} className="btn-soft btn-block">
          <Icon name="download" /> {t("install.button")}
        </button>
      )}
      <Modal open={help !== null} onClose={() => setHelp(null)} title={help === "ios" ? t("install.iosTitle") : t("install.otherTitle")}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Icon name="phone" />
          </span>
          <p className="text-[15px] leading-relaxed text-ink-2">{help === "ios" ? t("install.iosSteps") : t("install.otherSteps")}</p>
        </div>
        <button type="button" className="btn btn-block mt-5" onClick={() => setHelp(null)}>{t("common.close")}</button>
      </Modal>
    </>
  );
}

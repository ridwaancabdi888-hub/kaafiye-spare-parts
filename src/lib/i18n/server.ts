import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DISPLAY_CURRENCY_COOKIE, type Currency } from "../format";
import { DEFAULT_LANG, LANG_COOKIE, dictionaries, translate, type DictKey, type Lang } from "./dict";

export const getLang = cache(async (): Promise<Lang> => {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return v === "en" || v === "so" ? v : DEFAULT_LANG;
});

export async function getT() {
  const lang = await getLang();
  const dict = dictionaries[lang];
  return (key: DictKey, vars?: Record<string, string | number>) => translate(dict, key, vars);
}

/** The viewer's display currency for totals (remembered per device). Stored amounts never change. */
export const getDisplayCurrency = cache(async (): Promise<Currency> =>
  (await cookies()).get(DISPLAY_CURRENCY_COOKIE)?.value === "SLSH" ? "SLSH" : "USD");

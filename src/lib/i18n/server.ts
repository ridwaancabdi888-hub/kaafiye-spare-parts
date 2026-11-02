import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
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

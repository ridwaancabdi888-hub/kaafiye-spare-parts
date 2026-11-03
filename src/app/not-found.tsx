import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { Icon } from "@/components/Icon";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Icon name="search" className="h-7 w-7" /></span>
        <h1 className="mt-4 text-xl font-extrabold text-navy-900">{t("common.notFoundTitle")}</h1>
        <p className="mt-2 text-[14px] text-muted">{t("common.notFoundText")}</p>
        <Link href="/" className="btn mt-6">{t("common.goHome")}</Link>
      </div>
    </div>
  );
}

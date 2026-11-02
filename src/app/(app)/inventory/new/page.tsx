import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { ProductForm } from "../ProductForm";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const s = await requireAdmin();
  const t = await getT();
  return (
    <>
      <PageHeader title={t("inv.add").replace("+ ", "")} />
      <Link href="/inventory" className="muted mb-4 inline-block hover:underline">{t("common.back")}</Link>
      <ProductForm businessId={s.business.id} />
    </>
  );
}

import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/kit";
import { ProductForm } from "../ProductForm";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const s = await requireAdmin();
  const t = await getT();
  return (
    <>
      <PageHeader title={t("inv.addTitle")} back={{ href: "/inventory", label: t("inv.title") }} />
      <ProductForm businessId={s.business.id} />
    </>
  );
}

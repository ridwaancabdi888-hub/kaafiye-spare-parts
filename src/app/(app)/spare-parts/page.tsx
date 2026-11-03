import { getFx, getStaffNames, requireMember } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { listProducts, signedImageUrls } from "@/lib/data";
import type { Expense, Sale } from "@/lib/types";
import { FxWidget } from "@/components/FxWidget";
import { Alert, PageHeader, SectionHeader } from "@/components/kit";
import { ExpensesList, SalesList } from "@/components/lists";
import { Workspace } from "./Workspace";

export const metadata = { title: "Spare Parts" };

export default async function SparePartsPage() {
  const s = await requireMember();
  const t = await getT();
  const [fx, products, staff, sales, expenses] = await Promise.all([
    getFx(s.business.id),
    listProducts(s.supabase, s.business.id),
    getStaffNames(s.business.id),
    s.supabase.from("sales").select("*").eq("business_id", s.business.id).order("created_at", { ascending: false }).limit(40),
    s.supabase.from("expenses").select("*").eq("business_id", s.business.id).eq("created_by", s.user.id)
      .order("created_at", { ascending: false }).limit(20),
  ]);
  const images = await signedImageUrls(s.supabase, products.map((p) => p.image_path));
  const names = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const ctx = { userId: s.user.id, isAdmin: s.isAdmin, names: staff.names };

  return (
    <>
      <PageHeader title={t("sp.title")} subtitle={t("sp.subtitle")} />
      <FxWidget rate={fx?.rate ?? null} staleHours={fx?.staleHours ?? 24} canChange={s.isAdmin} />
      <Workspace products={products} images={images} rate={fx?.rate?.slsh_per_usd ?? null} />

      <SectionHeader title={t("sp.recentSales")} />
      <Alert tone="info" className="mb-3">{t("sp.editRule")}</Alert>
      <SalesList rows={(sales.data ?? []) as Sale[]} products={names} ctx={ctx} />

      <SectionHeader title={t("sp.myExpenses")} />
      <ExpensesList rows={(expenses.data ?? []) as Expense[]} products={names} ctx={ctx} />
    </>
  );
}

import { getFx, getStaffNames, requireMember } from "@/lib/session";
import { getLang, getT } from "@/lib/i18n/server";
import { listProducts, signedImageUrls } from "@/lib/data";
import { fmtDateTime, fmtMoney, fmtUsd, fmtUsdPrecise } from "@/lib/format";
import { FxWidget } from "@/components/FxWidget";
import { PageHeader } from "@/components/PageHeader";
import { RecordActions } from "@/components/RecordActions";
import type { Expense, Sale } from "@/lib/types";
import { SalePanel } from "./SalePanel";
import { ExpenseForm } from "./ExpenseForm";

export const metadata = { title: "Spare Parts" };

export default async function SparePartsPage() {
  const s = await requireMember();
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const [fx, products, staff, sales, expenses] = await Promise.all([
    getFx(s.business.id),
    listProducts(s.supabase, s.business.id),
    getStaffNames(s.business.id),
    s.supabase.from("sales").select("*").eq("business_id", s.business.id).order("created_at", { ascending: false }).limit(50),
    s.supabase.from("expenses").select("*").eq("business_id", s.business.id).eq("created_by", s.user.id)
      .order("created_at", { ascending: false }).limit(30),
  ]);
  const images = await signedImageUrls(s.supabase, products.map((p) => p.image_path));
  const productName = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const rate = fx?.rate?.slsh_per_usd ?? null;

  return (
    <>
      <PageHeader title={t("sp.title")} />
      <FxWidget rate={fx?.rate ?? null} staleHours={fx?.staleHours ?? 24} canChange={s.isAdmin} />

      <SalePanel products={products} images={images} rate={rate} />

      <div className="mt-5 grid grid-cols-1 gap-[18px] lg:grid-cols-[1.15fr_.85fr]">
        <section className="card order-2 lg:order-1">
          <h2 className="mb-3 text-xl font-bold">{t("sp.myExpenses")}</h2>
          <ul>
            {((expenses.data ?? []) as Expense[]).map((e) => (
              <li key={e.id} className="row-item flex-wrap">
                <div className="min-w-0">
                  <div className={`font-bold ${e.status === "voided" ? "line-through opacity-60" : ""}`}>
                    {e.kind === "cash" ? fmtMoney(e.amount, e.currency) : `${e.quantity} × ${productName[e.product_id!] ?? "—"} (${fmtUsdPrecise(e.amount_usd)})`}
                  </div>
                  <div className="muted">{e.reason} • {fmtDateTime(e.created_at, lang)}{e.edit_count > 0 && ` • ${t("common.edited")}`}</div>
                </div>
                <RecordActions table="expenses" record={e} isOwn={e.created_by === s.user.id} isAdmin={s.isAdmin} />
              </li>
            ))}
            {!expenses.data?.length && <li className="muted">{t("common.none")}</li>}
          </ul>
        </section>
        <section className="card order-1 lg:order-2">
          <h2 className="mb-1 text-xl font-bold">{t("sp.expenseTitle")}</h2>
          <ExpenseForm products={products} />
        </section>
      </div>

      <div className="section-head">
        <h2>{t("sp.recentSales")}</h2>
        <span className="tag">{t("sp.editRule")}</span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t("sp.product")}</th>
              <th>{t("common.quantity")}</th>
              <th>{t("common.total")}</th>
              <th>{t("common.employee")}</th>
              <th>{t("common.date")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {((sales.data ?? []) as Sale[]).map((r) => (
              <tr key={r.id} className={r.status === "voided" ? "opacity-60" : ""}>
                <td className={r.status === "voided" ? "line-through" : ""}>{productName[r.product_id] ?? "—"}</td>
                <td>{r.quantity}</td>
                <td>
                  <b>{fmtMoney(r.total, r.currency)}</b>
                  {r.currency === "SLSH" && <div className="muted">≈ {fmtUsd(r.total_usd)}</div>}
                </td>
                <td>{staff.names[r.created_by] ?? "—"}</td>
                <td className="whitespace-nowrap">
                  {fmtDateTime(r.created_at, lang)}
                  {r.edit_count > 0 && <div className="text-[11px] text-warn">✎ {t("common.edited")}</div>}
                </td>
                <td>
                  <RecordActions table="sales" record={r} isOwn={r.created_by === s.user.id} isAdmin={s.isAdmin} />
                </td>
              </tr>
            ))}
            {!sales.data?.length && (
              <tr>
                <td colSpan={6} className="text-center text-muted">{t("common.none")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

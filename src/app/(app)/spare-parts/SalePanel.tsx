"use client";
import { useActionState, useMemo, useRef, useState } from "react";
import { recordSale } from "@/app/actions/records";
import { useT } from "@/lib/i18n/client";
import { fmtInt, fmtMoney, fmtSlsh, fmtUsd, num, type Currency } from "@/lib/format";
import { CurrencySelect, FormMessage, SubmitButton, useResetOnSuccess } from "@/components/ui";
import { ProductThumb } from "@/components/ProductIcon";
import type { Product } from "@/lib/types";

export function SalePanel({ products, images, rate }: { products: Product[]; images: Record<string, string>; rate: number | null }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [cur, setCur] = useState<Currency>("USD");
  const [state, action] = useActionState(recordSale, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, formRef, () => {
    setProductId("");
    setQty("1");
    setPrice("");
  });

  const selected = products.find((p) => p.id === productId);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? products.filter((p) => [p.name, p.name_en, p.sku, p.tyre_size].some((v) => v?.toLowerCase().includes(s))) : products;
  }, [products, q]);

  const suggested = (p: Product | undefined, c: Currency) => {
    if (!p || p.sell_price_usd === null) return "";
    if (c === "USD") return String(p.sell_price_usd);
    return rate ? String(Math.round(p.sell_price_usd * rate)) : "";
  };
  const pick = (id: string) => {
    setProductId(id);
    setPrice(suggested(products.find((p) => p.id === id), cur));
  };
  const changeCurrency = (c: Currency) => {
    setCur(c);
    const s = suggested(selected, c);
    if (s) setPrice(s);
  };

  const total = num(qty) * num(price.replace(/,/g, ""));
  const overStock = selected ? num(qty) > selected.stock_qty : false;

  return (
    <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.15fr_.85fr]">
      <section className="card">
        <h2 className="mb-4 mt-2 text-[22px] font-bold">{t("sp.pickProduct")}</h2>
        <label className="field-label" htmlFor="sp-search">{t("common.search")}</label>
        <input id="sp-search" className="input" placeholder={`🔍  ${t("sp.searchPlaceholder")}`} value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-2 max-h-[420px] overflow-y-auto">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => pick(p.id)}
                disabled={p.stock_qty <= 0}
                className={`row-item w-full rounded-lg px-2 text-left transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50 ${
                  p.id === productId ? "bg-brand-soft" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <ProductThumb product={p} url={p.image_path ? images[p.image_path] : undefined} />
                  <span className="truncate">{p.name}</span>
                </span>
                <strong className={p.stock_qty <= p.low_stock_threshold ? "text-warn" : ""}>{fmtInt(p.stock_qty)} {p.unit}</strong>
              </button>
            </li>
          ))}
          {!filtered.length && <li className="muted py-4">{t("common.none")}</li>}
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-2 mt-2 text-[22px] font-bold">{t("sp.newSale")} / New Sale</h2>
        <form action={action} ref={formRef}>
          <div className="my-4">
            <label className="field-label">{t("sp.product")}</label>
            <select name="product_id" className="input" value={productId} onChange={(e) => pick(e.target.value)} required>
              <option value="">{t("sp.selectProduct")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id} disabled={p.stock_qty <= 0}>
                  {p.name} ({fmtInt(p.stock_qty)} {t("sp.inStockLabel")})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t("common.quantity")}</label>
              <input name="quantity" className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))} required />
            </div>
            <div>
              <label className="field-label">{t("common.currency")}</label>
              <CurrencySelect value={cur} onChange={changeCurrency} />
            </div>
          </div>
          <div className="my-4">
            <label className="field-label">{t("sp.unitPrice")}</label>
            <input name="unit_price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ""))} required />
            {selected && (
              <p className="muted mt-1.5">
                {selected.sell_price_usd === null
                  ? `⚠ ${t("sp.noPrice")}`
                  : `${t("sp.suggested")}: ${fmtUsd(selected.sell_price_usd)}${rate ? ` ≈ ${fmtSlsh(Math.round(selected.sell_price_usd * rate))}` : ""}`}
              </p>
            )}
          </div>
          {overStock && <p className="mb-2 text-sm font-bold text-bad">{t("err.INSUFFICIENT_STOCK")}</p>}
          <h3 className="mb-4 text-[22px] font-bold">{t("sp.total")}: {fmtMoney(total, cur)}</h3>
          <SubmitButton disabled={!productId || overStock}>{t("sp.saveSale")}</SubmitButton>
          <FormMessage state={state} />
          <p className="muted mt-3">{t("sp.editRule")}</p>
        </form>
      </section>
    </div>
  );
}

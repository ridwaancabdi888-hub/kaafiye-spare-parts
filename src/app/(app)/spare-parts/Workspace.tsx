"use client";
import { useActionState, useMemo, useRef, useState } from "react";
import { recordCashExpense, recordItemExpense, recordSale } from "@/app/actions/records";
import { useT } from "@/lib/i18n/client";
import { fmtInt, fmtMoney, fmtSlsh, fmtUsd, fmtUsdPrecise, num, type Currency } from "@/lib/format";
import type { Product } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { Alert, EmptyState } from "@/components/kit";
import { ProductThumb } from "@/components/ProductIcon";
import { CurrencyToggle, FormMessage, QtyStepper, SubmitButton, useResetOnSuccess } from "@/components/ui";

type Tab = "sale" | "expense";

export function Workspace({ products, images, rate }: { products: Product[]; images: Record<string, string>; rate: number | null }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("sale");
  return (
    <section>
      <div role="tablist" className="grid h-12 grid-cols-2 rounded-2xl bg-slate-200/60 p-1 sm:max-w-sm">
        {(["sale", "expense"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)}
            className={`flex items-center justify-center gap-2 rounded-xl text-[15px] font-bold transition ${tab === k ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
            <Icon name={k === "sale" ? "cart" : "wallet"} className="h-[18px] w-[18px]" />
            {k === "sale" ? t("sp.tabSale") : t("sp.tabExpense")}
          </button>
        ))}
      </div>
      <div className="mt-4">{tab === "sale" ? <SalePanel products={products} images={images} rate={rate} /> : <ExpensePanel products={products} />}</div>
    </section>
  );
}

function ProductPicker({ products, images, selected, onPick }: {
  products: Product[]; images: Record<string, string>; selected: string; onPick: (id: string) => void;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? products.filter((p) => [p.name, p.name_en, p.sku, p.tyre_size].some((v) => v?.toLowerCase().includes(s))) : products;
  }, [products, q]);
  return (
    <div className="card p-3 sm:p-4">
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input type="search" className="input pl-12" placeholder={t("sp.searchPlaceholder")} aria-label={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {rows.length ? (
        <ul className="mt-2 max-h-[26rem] overflow-y-auto">
          {rows.map((p) => {
            const out = p.stock_qty <= 0;
            const low = !out && p.stock_qty <= p.low_stock_threshold;
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onPick(p.id)} disabled={out}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-45 ${p.id === selected ? "bg-brand-50 ring-1 ring-brand-300" : ""}`}>
                  <ProductThumb product={p} url={p.image_path ? images[p.image_path] : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className={`block text-[12.5px] ${out ? "text-rose-600" : low ? "text-amber-700" : "text-muted"}`}>
                      {out ? t("common.outOfStock") : t("sp.inStock", { n: fmtInt(p.stock_qty) })}
                    </span>
                  </span>
                  <span className="num shrink-0 text-[14px] font-bold text-brand-700">{p.sell_price_usd !== null ? fmtUsd(p.sell_price_usd) : "—"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-3"><EmptyState text={t("empty.products")} /></div>
      )}
    </div>
  );
}

function SalePanel({ products, images, rate }: { products: Product[]; images: Record<string, string>; rate: number | null }) {
  const t = useT();
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
  const suggested = (p: Product | undefined, c: Currency) =>
    !p || p.sell_price_usd === null ? "" : c === "USD" ? String(p.sell_price_usd) : rate ? String(Math.round(p.sell_price_usd * rate)) : "";
  const pick = (id: string) => {
    setProductId(id);
    setPrice(suggested(products.find((p) => p.id === id), cur));
    setQty("1");
  };
  const changeCurrency = (c: Currency) => {
    setCur(c);
    const s = suggested(selected, c);
    if (s) setPrice(s);
  };
  const total = num(qty) * num(price.replace(/,/g, ""));
  const overStock = selected ? num(qty) > selected.stock_qty : false;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
      {/* On phones the picker hides once a product is chosen, so the form is right there. */}
      <div className={selected ? "hidden lg:block" : ""}>
        <h2 className="mb-2 text-[14px] font-bold text-ink-2">{t("sp.pickProduct")}</h2>
        <ProductPicker products={products} images={images} selected={productId} onPick={pick} />
      </div>

      <div className={`card ${selected ? "" : "hidden lg:block"} lg:sticky lg:top-20`}>
        {state?.ok && !selected && <FormMessage state={state} />}
        {selected ? (
          <form action={action} ref={formRef}>
            <input type="hidden" name="product_id" value={productId} />
            <div className="flex items-center gap-3 rounded-xl bg-canvas p-2.5">
              <ProductThumb product={selected} url={selected.image_path ? images[selected.image_path] : undefined} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{selected.name}</div>
                <div className="text-[12.5px] text-muted">{t("sp.inStock", { n: fmtInt(selected.stock_qty) })}</div>
              </div>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setProductId("")}>{t("sp.changeProduct")}</button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="label">{t("common.quantity")}</label>
                <QtyStepper value={qty} onChange={setQty} max={selected.stock_qty} />
              </div>
              <div className="min-w-0">
                <label className="label">{t("common.currency")}</label>
                <CurrencyToggle value={cur} onChange={changeCurrency} />
              </div>
            </div>
            <div className="field mt-4">
              <label className="label" htmlFor="unit_price">{t("sp.unitPrice")}</label>
              <div className="relative">
                <input id="unit_price" name="unit_price" className="input num pr-16" inputMode="decimal" value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ""))} required />
                <span className="absolute inset-y-0 right-4 flex items-center text-[13px] font-bold text-muted">{cur === "USD" ? "USD" : "SlSh"}</span>
              </div>
              <p className="hint mt-1.5">
                {selected.sell_price_usd === null
                  ? t("sp.noPrice")
                  : t("sp.suggested", { p: `${fmtUsd(selected.sell_price_usd)}${rate ? ` ≈ ${fmtSlsh(Math.round(selected.sell_price_usd * rate))}` : ""}` })}
              </p>
            </div>
            {overStock && <Alert tone="error" className="mt-3">{t("sp.overStock")}</Alert>}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-navy-900 px-4 py-3.5 text-white">
              <span className="text-[14px] text-white/75">{t("sp.total")}</span>
              <span className="num text-[24px] font-extrabold">{fmtMoney(total, cur)}</span>
            </div>
            <SubmitButton className="btn btn-block mt-4 h-14 text-[16px]" disabled={overStock || !total}>
              <Icon name="check" /> {t("sp.saveSale")}
            </SubmitButton>
            <FormMessage state={state} />
          </form>
        ) : (
          <EmptyState icon="cart" text={t("sp.pickProduct")} />
        )}
      </div>
    </div>
  );
}

export function ExpensePanel({ products }: { products: Product[] }) {
  const t = useT();
  const [kind, setKind] = useState<"cash" | "item">("cash");
  return (
    <div className="card max-w-xl">
      <div className="grid grid-cols-2 gap-2">
        {(["cash", "item"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
            className={`flex min-h-[3.5rem] items-center gap-2 rounded-xl border px-3 text-left text-[14px] font-semibold transition ${kind === k ? "border-brand-500 bg-brand-50 text-brand-800" : "border-line text-ink-2 hover:border-brand-300"}`}>
            <Icon name={k === "cash" ? "wallet" : "package"} className="h-5 w-5 shrink-0" />
            <span className="leading-tight">{k === "cash" ? t("sp.expenseCash") : t("sp.expenseItem")}</span>
          </button>
        ))}
      </div>
      <div className="mt-4">{kind === "cash" ? <CashForm /> : <ItemForm products={products} />}</div>
    </div>
  );
}

function CashForm() {
  const t = useT();
  const [state, action] = useActionState(recordCashExpense, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref);
  return (
    <form action={action} ref={ref}>
      <div className="field">
        <label className="label">{t("common.amount")}</label>
        <input name="amount" className="input input-lg num" inputMode="decimal" placeholder="0" required />
      </div>
      <div className="field">
        <label className="label">{t("common.currency")}</label>
        <CurrencyToggle />
      </div>
      <div className="field">
        <label className="label">{t("common.reason")}</label>
        <input name="reason" className="input" required minLength={3} />
      </div>
      <SubmitButton className="btn btn-block mt-5">{t("sp.saveExpense")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

function ItemForm({ products }: { products: Product[] }) {
  const t = useT();
  const [state, action] = useActionState(recordItemExpense, undefined);
  const [pid, setPid] = useState("");
  const [qty, setQty] = useState("1");
  const ref = useRef<HTMLFormElement>(null);
  useResetOnSuccess(state, ref, () => {
    setPid("");
    setQty("1");
  });
  const p = products.find((x) => x.id === pid);
  return (
    <form action={action} ref={ref}>
      <div className="field">
        <label className="label">{t("sp.pickProduct")}</label>
        <select name="product_id" className="input" value={pid} onChange={(e) => setPid(e.target.value)} required>
          <option value="">—</option>
          {products.map((x) => (
            <option key={x.id} value={x.id} disabled={x.stock_qty <= 0}>{x.name} ({fmtInt(x.stock_qty)})</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="label">{t("common.quantity")}</label>
        <QtyStepper value={qty} onChange={setQty} max={p?.stock_qty} />
      </div>
      <div className="field">
        <label className="label">{t("common.reason")}</label>
        <input name="reason" className="input" required minLength={3} />
      </div>
      {p && <p className="hint mt-3">{t("sp.itemValue", { v: fmtUsdPrecise(num(qty) * p.cost_usd) })}</p>}
      <SubmitButton className="btn btn-block mt-5">{t("sp.saveExpense")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

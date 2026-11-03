"use client";
/* eslint-disable @next/next/no-img-element -- local object-URL / signed-URL previews */
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct, setProductImage, updateProduct } from "@/app/actions/admin";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useT } from "@/lib/i18n/client";
import type { ActionState } from "@/lib/errors";
import type { Product } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { Alert } from "@/components/kit";
import { FormMessage, Spinner, SubmitButton } from "@/components/ui";

const BUCKET = "product-images";

/** Downscale phone photos before upload (keeps uploads fast on mobile data). */
async function compress(file: File, max = 1280): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.82));
  } catch {
    return file;
  }
}

export function ProductForm({ product, imageUrl, businessId }: { product?: Product; imageUrl?: string; businessId: string }) {
  const t = useT();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | undefined>(imageUrl);
  const [uploadError, setUploadError] = useState(false);
  const [uploading, startUpload] = useTransition();
  const [state, action] = useActionState<ActionState, FormData>(product ? updateProduct : createProduct, undefined);
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state?.ok || !state.id || handled.current === state.at) return;
    handled.current = state.at;
    const id = state.id;
    startUpload(async () => {
      if (file) {
        const blob = await compress(file);
        const path = `${businessId}/${id}/${Date.now()}.jpg`;
        const { error } = await createBrowserSupabase().storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
        const r = error ? null : await setProductImage(id, path);
        if (error || r?.error) setUploadError(true);
        setFile(null);
      }
      if (!product) router.push(`/inventory/${id}`);
      else router.refresh();
    });
  }, [state, file, businessId, product, router]);

  const onFile = (f: File | null) => {
    setFile(f);
    setUploadError(false);
    if (f) setPreview(URL.createObjectURL(f));
  };

  return (
    <form action={action} className="grid gap-4 md:grid-cols-[240px_1fr] md:items-start">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="card">
        <span className="label">{t("inv.photo")}</span>
        <label className="group relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-line-strong bg-slate-50 text-center transition hover:border-brand-400">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 p-4 text-[13px] font-semibold text-muted">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon name="camera" className="h-6 w-6" /></span>
              {t("inv.takePhoto")}
            </span>
          )}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </label>
        {preview && <p className="hint mt-2 text-center">{t("inv.changePhoto")}</p>}
        {uploadError && <Alert tone="warning" className="mt-3">{t("err.IMAGE_UPLOAD")}</Alert>}
      </div>

      <div className="space-y-4">
        <div className="card">
          <h2 className="section-title mb-4">{t("inv.sectionDetails")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("inv.name")} name="name" defaultValue={product?.name} required className="sm:col-span-2" />
            <Field label={t("inv.nameEn")} name="name_en" defaultValue={product?.name_en} optional={t("common.optional")} />
            <Field label={t("inv.category")} name="category" defaultValue={product?.category} optional={t("common.optional")} />
            <Field label={t("inv.tyreSize")} name="tyre_size" defaultValue={product?.tyre_size} placeholder="195/65/R15" optional={t("common.optional")} />
            <div className="min-w-0">
              <label className="label">{t("inv.condition")} <span className="font-normal text-muted">({t("common.optional")})</span></label>
              <select name="condition" className="input" defaultValue={product?.condition ?? ""}>
                <option value="">—</option>
                <option value="new">{t("inv.new")}</option>
                <option value="used">{t("inv.used")}</option>
              </select>
            </div>
            <Field label={t("inv.sku")} name="sku" defaultValue={product?.sku} optional={t("common.optional")} />
            <Field label={t("inv.supplier")} name="supplier" defaultValue={product?.supplier} optional={t("common.optional")} />
          </div>
        </div>
        <div className="card">
          <h2 className="section-title mb-4">{t("inv.sectionPricing")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("inv.sellUsd")} name="sell_price_usd" defaultValue={product?.sell_price_usd != null ? String(product.sell_price_usd) : ""} inputMode="decimal" />
            <Field label={t("inv.costUsd")} name="cost_usd" defaultValue={product && product.cost_usd > 0 ? String(product.cost_usd) : ""} inputMode="decimal" placeholder="0" />
            <Field label={t("inv.lowThreshold")} name="low_stock_threshold" defaultValue={String(product?.low_stock_threshold ?? 3)} inputMode="numeric" />
            <Field label={t("inv.unit")} name="unit" defaultValue={product?.unit ?? "PCS"} />
            {!product && <Field label={t("inv.openingStock")} name="opening_stock" defaultValue="" inputMode="numeric" placeholder="0" />}
          </div>
        </div>
        <SubmitButton className="btn btn-block sm:w-auto" disabled={uploading}>
          {uploading ? <><Spinner /> {t("common.saving")}</> : <><Icon name="check" /> {t("inv.saveProduct")}</>}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function Field({ label, name, defaultValue, optional, className = "", ...rest }: {
  label: string; name: string; defaultValue?: string | null; optional?: string; className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "className">) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className="label" htmlFor={`f-${name}`}>{label}{optional && <span className="font-normal text-muted"> ({optional})</span>}</label>
      <input id={`f-${name}`} name={name} className="input" defaultValue={defaultValue ?? ""} {...rest} />
    </div>
  );
}

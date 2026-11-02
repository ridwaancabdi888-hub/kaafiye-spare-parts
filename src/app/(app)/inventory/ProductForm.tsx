"use client";
/* eslint-disable @next/next/no-img-element -- local object-URL / signed-URL previews */
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct, setProductImage, updateProduct } from "@/app/actions/admin";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useT } from "@/lib/i18n/client";
import { FormMessage, SubmitButton } from "@/components/ui";
import type { ActionState } from "@/lib/errors";
import type { Product } from "@/lib/types";

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
    <form action={action} className="card">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr]">
        <div>
          <label className="field-label">{t("inv.photo")}</label>
          <label className="grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-field-line bg-[linear-gradient(135deg,#dce7e8,#b4c8c9)] text-center text-sm text-label">
            {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span className="p-4">📷<br />{t("inv.takePhoto")}</span>}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </label>
          {preview && <p className="muted mt-2 text-center">{t("inv.takePhoto")} ↑</p>}
          {uploadError && <p className="mt-2 text-sm font-bold text-bad">{t("err.IMAGE_UPLOAD")}</p>}
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field label={`${t("inv.name")} *`} name="name" defaultValue={product?.name} required />
          <Field label={t("inv.nameEn")} name="name_en" defaultValue={product?.name_en} />
          <Field label={t("inv.category")} name="category" defaultValue={product?.category} placeholder="Tires, Fluids, Accessories…" />
          <Field label={t("inv.sku")} name="sku" defaultValue={product?.sku} />
          <Field label={t("inv.tyreSize")} name="tyre_size" defaultValue={product?.tyre_size} placeholder="195/65/R15" />
          <div>
            <label className="field-label">{t("inv.condition")}</label>
            <select name="condition" className="input" defaultValue={product?.condition ?? ""}>
              <option value="">—</option>
              <option value="new">{t("inv.new")}</option>
              <option value="used">{t("inv.used")}</option>
            </select>
          </div>
          <Field label={t("inv.unit")} name="unit" defaultValue={product?.unit ?? "PCS"} />
          <Field label={t("inv.supplier")} name="supplier" defaultValue={product?.supplier} />
          <Field label={t("inv.costUsd")} name="cost_usd" defaultValue={product ? String(product.cost_usd) : ""} inputMode="decimal" />
          <Field label={t("inv.sellUsd")} name="sell_price_usd" defaultValue={product?.sell_price_usd != null ? String(product.sell_price_usd) : ""} inputMode="decimal" />
          <Field label={t("inv.lowThreshold")} name="low_stock_threshold" defaultValue={String(product?.low_stock_threshold ?? 3)} inputMode="numeric" />
          {!product && <Field label={t("inv.openingStock")} name="opening_stock" defaultValue="" inputMode="numeric" placeholder="0" />}
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <SubmitButton disabled={uploading}>{uploading ? "…" : t("inv.saveProduct")}</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

function Field({ label, name, defaultValue, ...rest }: { label: string; name: string; defaultValue?: string | null } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  return (
    <div>
      <label className="field-label" htmlFor={`f-${name}`}>{label}</label>
      <input id={`f-${name}`} name={name} className="input" defaultValue={defaultValue ?? ""} {...rest} />
    </div>
  );
}

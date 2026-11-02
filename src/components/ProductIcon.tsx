/* eslint-disable @next/next/no-img-element -- signed, short-lived storage URLs; next/image optimisation not useful here */
import type { Product } from "@/lib/types";

export function productEmoji(p: Pick<Product, "name" | "category" | "tyre_size">) {
  const s = `${p.name} ${p.category ?? ""}`.toLowerCase();
  if (p.tyre_size || /tire|tyre|taayir/.test(s)) return "🛞";
  if (/fluid|oil|saliid|liquid|brake/.test(s)) return "🧴";
  if (/glue|xabag/.test(s)) return "🧪";
  if (/valve|waal/.test(s)) return "🔩";
  return "🧰";
}

export function ProductThumb({ product, url, size = "sm" }: { product: Product; url?: string; size?: "sm" | "lg" }) {
  if (size === "lg") {
    return (
      <div className="grid h-[125px] place-items-center overflow-hidden bg-[linear-gradient(135deg,#dce7e8,#b4c8c9)] text-[62px]">
        {url ? <img src={url} alt={product.name} className="h-full w-full object-cover" loading="lazy" /> : <span aria-hidden>{productEmoji(product)}</span>}
      </div>
    );
  }
  return url ? (
    <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" loading="lazy" />
  ) : (
    <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center">{productEmoji(product)}</span>
  );
}

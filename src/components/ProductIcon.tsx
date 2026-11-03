/* eslint-disable @next/next/no-img-element -- short-lived signed storage URLs; next/image optimisation not useful here */
import type { Product } from "@/lib/types";
import { Icon, type IconName } from "./Icon";

/** Placeholder icon chosen from the (Somali or English) product name. */
export function productIcon(p: Pick<Product, "name" | "category" | "tyre_size">): IconName {
  const s = `${p.name} ${p.category ?? ""}`.toLowerCase();
  if (p.tyre_size || /tire|tyre|taayir/.test(s)) return "tyre";
  if (/fluid|oil|saliid|brake|biriig|xaydh|grease/.test(s)) return "droplet";
  if (/filter/.test(s)) return "filter";
  if (/puncture|proof|xabag|glue|waal|valve/.test(s)) return "shield";
  return "package";
}

export function ProductThumb({ product, url, size = "sm" }: { product: Product; url?: string; size?: "sm" | "md" | "lg" }) {
  if (size === "lg") {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
        {url ? (
          <img src={url} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center text-slate-400">
            <Icon name={productIcon(product)} className="h-12 w-12" strokeWidth={1.5} />
          </div>
        )}
      </div>
    );
  }
  const box = size === "md" ? "h-14 w-14 rounded-xl" : "h-11 w-11 rounded-lg";
  return url ? (
    <img src={url} alt="" className={`${box} shrink-0 object-cover`} loading="lazy" />
  ) : (
    <span aria-hidden className={`${box} grid shrink-0 place-items-center bg-slate-100 text-slate-500`}>
      <Icon name={productIcon(product)} className="h-[55%] w-[55%]" strokeWidth={1.7} />
    </span>
  );
}

import { Icon } from "./Icon";

export function BrandMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-lg shadow-brand-900/30 ${className}`}>
      <Icon name="tyre" className="h-[58%] w-[58%]" strokeWidth={2.2} />
    </span>
  );
}

export function Brand({ tagline, light = true, compact = false }: { tagline?: string; light?: boolean; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BrandMark className={compact ? "h-9 w-9" : "h-10 w-10"} />
      <div className="min-w-0">
        <div className={`font-extrabold tracking-[.14em] ${compact ? "text-[15px]" : "text-[17px]"} ${light ? "text-white" : "text-navy-900"}`}>KAAFIYE</div>
        {tagline && <div className={`truncate text-[11px] font-medium ${light ? "text-brand-200/80" : "text-muted"}`}>{tagline}</div>}
      </div>
    </div>
  );
}

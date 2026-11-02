export function Brand({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  return (
    <div className={dark ? "text-[#0a5454]" : "text-[#eaf5f4]"}>
      <div className={`${compact ? "text-lg" : "text-[21px]"} font-extrabold tracking-[.5px]`}>⚙ KAAFIYE</div>
      {!compact && <div className="mt-1.5 text-[10px] tracking-[2px] text-mint">SPARE PARTS SYSTEM</div>}
    </div>
  );
}

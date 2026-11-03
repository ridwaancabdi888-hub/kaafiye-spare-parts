// Presentational building blocks. No hooks: usable from server and client components.
import Link from "next/link";
import { Icon, type IconName } from "./Icon";

export function PageHeader({ title, subtitle, actions, back }: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-5 sm:mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-ink">
          <Icon name="arrowLeft" className="h-4 w-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-tight text-navy-900 sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function SectionHeader({ title, action, className = "" }: { title: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-3 mt-7 flex items-center justify-between gap-3 ${className}`}>
      <h2 className="section-title">{title}</h2>
      {action}
    </div>
  );
}

const TONES = {
  green: "bg-brand-50 text-brand-700",
  navy: "bg-navy-800/8 text-navy-800",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-600",
} as const;

export function StatCard({ label, value, hint, icon, tone = "green" }: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: IconName;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="card flex min-w-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-semibold leading-snug text-muted sm:text-[13px]">{label}</span>
        {icon && (
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TONES[tone]}`}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="num truncate text-[20px] font-extrabold tracking-tight text-navy-900 sm:text-[26px]">{value}</div>
      {hint && <div className="-mt-1 text-[12px] text-muted">{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon = "package", text, action }: { icon?: IconName; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong bg-white/60 px-6 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="text-[14px] text-muted">{text}</p>
      {action}
    </div>
  );
}

const ALERT = {
  error: { cls: "border-rose-200 bg-rose-50 text-rose-800", icon: "alert" },
  success: { cls: "border-brand-200 bg-brand-50 text-brand-800", icon: "checkCircle" },
  warning: { cls: "border-amber-200 bg-amber-50 text-amber-800", icon: "alert" },
  info: { cls: "border-navy-700/15 bg-navy-700/5 text-navy-800", icon: "info" },
} as const;

export function Alert({ tone, children, className = "" }: { tone: keyof typeof ALERT; children: React.ReactNode; className?: string }) {
  const a = ALERT[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[14px] font-medium ${a.cls} ${className}`}>
      <Icon name={a.icon} className="mt-0.5 h-[18px] w-[18px] shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export type Column<T> = { header: React.ReactNode; cell: (row: T) => React.ReactNode; className?: string };

/** Table on tablets/desktop, stacked cards on phones (no horizontal scrolling). */
export function DataTable<T>({ rows, columns, rowKey, card, empty, rowClassName }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  card: (row: T) => React.ReactNode;
  empty: React.ReactNode;
  rowClassName?: (row: T) => string;
}) {
  if (!rows.length) return <>{empty}</>;
  return (
    <>
      <div className="card-tight hidden overflow-hidden md:block">
        <table className="tbl">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} className={c.className}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className={rowClassName?.(r)}>
                {columns.map((c, i) => (
                  <td key={i} className={c.className}>{c.cell(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2.5 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className={`card-tight p-4 ${rowClassName?.(r) ?? ""}`}>{card(r)}</li>
        ))}
      </ul>
    </>
  );
}

export function Initials({ name, className = "h-10 w-10 text-[14px]" }: { name: string; className?: string }) {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/);
  const ini = ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
  return <span className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-navy-700 font-bold text-white ${className}`}>{ini}</span>;
}

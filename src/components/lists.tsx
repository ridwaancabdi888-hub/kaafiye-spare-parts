// Record lists shared by several pages. Server components: table on desktop, cards on phones.
import { getLang, getT } from "@/lib/i18n/server";
import { fmtDateTime, fmtMoney, fmtUsd, fmtUsdPrecise, fmtWorkDate } from "@/lib/format";
import type { BanjarkaRecord, Expense, Sale } from "@/lib/types";
import { DataTable, EmptyState } from "./kit";
import { Icon } from "./Icon";
import { RecordActions } from "./RecordActions";

type Ctx = { userId: string; isAdmin: boolean; names: Record<string, string> };

function Edited({ show, label }: { show: boolean; label: string }) {
  return show ? <span className="badge badge-amber"><Icon name="pencil" className="h-3 w-3" />{label}</span> : null;
}

export async function SalesList({ rows, products, ctx, actions = true }: { rows: Sale[]; products: Record<string, string>; ctx: Ctx; actions?: boolean }) {
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const money = (r: Sale) => (
    <div className="num">
      <div className={`font-bold ${r.status === "voided" ? "text-muted line-through" : "text-ink"}`}>{fmtMoney(r.total, r.currency)}</div>
      {r.currency === "SLSH" && <div className="text-[12px] text-muted">≈ {fmtUsd(r.total_usd)}</div>}
    </div>
  );
  const act = (r: Sale) => (actions ? <RecordActions table="sales" record={r} isOwn={r.created_by === ctx.userId} isAdmin={ctx.isAdmin} /> : null);
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      rowClassName={(r) => (r.status === "voided" ? "opacity-60" : "")}
      empty={<EmptyState icon="receipt" text={t("empty.sales")} />}
      columns={[
        { header: t("common.product"), cell: (r) => <div className="min-w-0"><div className="font-semibold">{products[r.product_id] ?? "—"}</div><div className="num text-[12px] text-muted">{r.quantity} × {fmtMoney(r.unit_price, r.currency)}</div></div> },
        { header: t("common.total"), cell: money },
        { header: t("common.employee"), cell: (r) => ctx.names[r.created_by] ?? "—" },
        { header: t("common.date"), cell: (r) => <div className="whitespace-nowrap text-[13px] text-muted">{fmtDateTime(r.created_at, lang)} <Edited show={r.edit_count > 0} label={t("common.edited")} /></div> },
        ...(actions ? [{ header: "", cell: act }] : []),
      ]}
      card={(r) => (
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-bold">{products[r.product_id] ?? "—"}</div>
              <div className="num text-[13px] text-muted">{r.quantity} × {fmtMoney(r.unit_price, r.currency)}</div>
            </div>
            <div className="shrink-0 text-right">{money(r)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
            <span>{ctx.names[r.created_by] ?? "—"}</span>·<span>{fmtDateTime(r.created_at, lang)}</span>
            <Edited show={r.edit_count > 0} label={t("common.edited")} />
          </div>
          {actions && <div>{act(r)}</div>}
        </div>
      )}
    />
  );
}

export async function ExpensesList({ rows, products, ctx }: { rows: Expense[]; products: Record<string, string>; ctx: Ctx }) {
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const what = (e: Expense) => (e.kind === "cash" ? t("exp.cash") : `${e.quantity} × ${products[e.product_id!] ?? "—"}`);
  const money = (e: Expense) => (
    <div className="num">
      <div className={`font-bold ${e.status === "voided" ? "text-muted line-through" : ""}`}>{e.kind === "cash" ? fmtMoney(e.amount, e.currency) : fmtUsdPrecise(e.amount_usd)}</div>
      {e.kind === "cash" && e.currency === "SLSH" && <div className="text-[12px] text-muted">≈ {fmtUsd(e.amount_usd)}</div>}
    </div>
  );
  const act = (e: Expense) => <RecordActions table="expenses" record={e} isOwn={e.created_by === ctx.userId} isAdmin={ctx.isAdmin} />;
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      rowClassName={(r) => (r.status === "voided" ? "opacity-60" : "")}
      empty={<EmptyState icon="wallet" text={t("empty.expenses")} />}
      columns={[
        { header: t("exp.kind"), cell: (e) => <span className={`badge ${e.kind === "cash" ? "badge-navy" : "badge-amber"}`}>{what(e)}</span> },
        { header: t("common.amount"), cell: money },
        { header: t("common.reason"), cell: (e) => <div className="max-w-xs"><div>{e.reason}</div>{e.void_reason && <div className="text-[12px] text-rose-700">{t("common.voided")}: {e.void_reason}</div>}</div> },
        { header: t("common.employee"), cell: (e) => ctx.names[e.created_by] ?? "—" },
        { header: t("common.date"), cell: (e) => <div className="whitespace-nowrap text-[13px] text-muted">{fmtDateTime(e.created_at, lang)} <Edited show={e.edit_count > 0} label={t("common.edited")} /></div> },
        { header: "", cell: act },
      ]}
      card={(e) => (
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className={`badge ${e.kind === "cash" ? "badge-navy" : "badge-amber"} max-w-full truncate`}>{what(e)}</span>
              <div className="mt-1.5 text-[14px]">{e.reason}</div>
            </div>
            <div className="shrink-0 text-right">{money(e)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
            <span>{ctx.names[e.created_by] ?? "—"}</span>·<span>{fmtDateTime(e.created_at, lang)}</span>
            <Edited show={e.edit_count > 0} label={t("common.edited")} />
          </div>
          <div>{act(e)}</div>
        </div>
      )}
    />
  );
}

export async function BanjarkaList({ rows, ctx }: { rows: BanjarkaRecord[]; ctx: Ctx }) {
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const act = (r: BanjarkaRecord) => <RecordActions table="banjarka_records" record={r} isOwn={r.created_by === ctx.userId} isAdmin={ctx.isAdmin} />;
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      rowClassName={(r) => (r.status === "voided" ? "opacity-60" : "")}
      empty={<EmptyState icon="wrench" text={t("empty.banjarka")} />}
      columns={[
        { header: t("bj.workDate"), cell: (r) => <div className="whitespace-nowrap">{fmtWorkDate(r.work_date, lang)} <Edited show={r.edit_count > 0} label={t("common.edited")} /></div> },
        { header: t("common.employee"), cell: (r) => ctx.names[r.created_by] ?? "—" },
        { header: t("bj.gross"), cell: (r) => <span className="num">{fmtMoney(r.gross, r.currency)}</span> },
        { header: t("bj.expenses"), cell: (r) => <div className="num">{fmtMoney(r.expenses, r.currency)}{r.expense_reason && <div className="text-[12px] text-muted">{r.expense_reason}</div>}</div> },
        { header: t("bj.net"), cell: (r) => <div className="num font-bold">{fmtMoney(r.net, r.currency)}{r.currency === "SLSH" && <div className="text-[12px] font-normal text-muted">≈ {fmtUsd(r.net_usd)}</div>}</div> },
        { header: t("bj.workerShare"), cell: (r) => <span className="num font-bold text-brand-700">{fmtMoney(r.worker_share, r.currency)}</span> },
        { header: t("bj.shopShare"), cell: (r) => <span className="num font-bold text-navy-800">{fmtMoney(r.shop_share, r.currency)}</span> },
        { header: "", cell: act },
      ]}
      card={(r) => (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold">{fmtWorkDate(r.work_date, lang)}</div>
              <div className="truncate text-[12.5px] text-muted">{ctx.names[r.created_by] ?? "—"}</div>
            </div>
            <Edited show={r.edit_count > 0} label={t("common.edited")} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-canvas p-2"><div className="text-[11px] text-muted">{t("bj.net")}</div><div className="num text-[14px] font-bold">{fmtMoney(r.net, r.currency)}</div></div>
            <div className="rounded-xl bg-brand-50 p-2"><div className="text-[11px] text-brand-700">{t("bj.workerShare")}</div><div className="num text-[14px] font-bold text-brand-700">{fmtMoney(r.worker_share, r.currency)}</div></div>
            <div className="rounded-xl bg-navy-800/5 p-2"><div className="text-[11px] text-navy-700">{t("bj.shopShare")}</div><div className="num text-[14px] font-bold text-navy-800">{fmtMoney(r.shop_share, r.currency)}</div></div>
          </div>
          <div className="num text-[12.5px] text-muted">{t("bj.gross")}: {fmtMoney(r.gross, r.currency)} · {t("bj.expenses")}: {fmtMoney(r.expenses, r.currency)}{r.expense_reason ? ` (${r.expense_reason})` : ""}</div>
          <div>{act(r)}</div>
        </div>
      )}
    />
  );
}

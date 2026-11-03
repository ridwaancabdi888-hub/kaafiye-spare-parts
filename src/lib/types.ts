import type { Currency } from "./format";

export type Role = "admin" | "user";

export interface Membership {
  id: string;
  business_id: string;
  user_id: string;
  role: Role;
  full_name: string;
  username: string | null;
  active: boolean;
  must_change_password?: boolean;
  created_at: string;
}

export interface FxRate {
  id: string;
  slsh_per_usd: number;
  source: string;
  note: string | null;
  is_example: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  name_en: string | null;
  category: string | null;
  sku: string | null;
  tyre_size: string | null;
  condition: "new" | "used" | null;
  unit: string;
  stock_qty: number;
  cost_usd: number;
  sell_price_usd: number | null;
  supplier: string | null;
  low_stock_threshold: number;
  status: "active" | "archived";
  image_path: string | null;
  created_at: string;
  updated_at: string;
}

interface RecordBase {
  id: string;
  business_id: string;
  status: "active" | "voided";
  void_reason: string | null;
  edit_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  fx_slsh_per_usd: number;
}

export interface Sale extends RecordBase {
  product_id: string;
  quantity: number;
  unit_price: number;
  currency: Currency;
  total: number;
  total_usd: number;
  unit_cost_usd: number;
  cost_usd: number;
  profit_usd: number;
  note: string | null;
}

export interface Expense extends RecordBase {
  kind: "cash" | "item";
  amount: number | null;
  currency: Currency;
  amount_usd: number;
  product_id: string | null;
  quantity: number | null;
  unit_cost_usd: number | null;
  reason: string;
}

export interface BanjarkaRecord extends RecordBase {
  work_date: string;
  currency: Currency;
  gross: number;
  expenses: number;
  expense_reason: string | null;
  net: number;
  worker_share: number;
  shop_share: number;
  gross_usd: number;
  expenses_usd: number;
  net_usd: number;
  worker_share_usd: number;
  shop_share_usd: number;
  note: string | null;
}

export interface Revision {
  id: number;
  table_name: "sales" | "expenses" | "banjarka_records";
  record_id: string;
  action: "create" | "edit" | "correction" | "void";
  actor: string | null;
  actor_role: string | null;
  reason: string | null;
  changed_fields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  created_at: string;
}

export interface ReportSummary {
  sales_count: number;
  units_sold: number;
  sales_usd: number;
  cogs_usd: number;
  gross_profit_usd: number;
  cash_expenses_usd: number;
  item_usage_cost_usd: number;
  spare_parts_net_usd: number;
  banjarka_count: number;
  banjarka_gross_usd: number;
  banjarka_expenses_usd: number;
  banjarka_net_usd: number;
  banjarka_worker_usd: number;
  banjarka_shop_usd: number;
  shop_net_usd: number;
  sales_by_currency: Partial<Record<Currency, number>>;
  cash_expenses_by_currency: Partial<Record<Currency, number>>;
  banjarka_gross_by_currency: Partial<Record<Currency, number>>;
  edited_count: number;
}

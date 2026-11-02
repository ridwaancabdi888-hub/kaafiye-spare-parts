-- Kaafiye Spare Parts — core schema, RLS and business logic.
-- All money-moving writes go through SECURITY DEFINER RPCs below; clients only get
-- SELECT through RLS on financial tables. Error messages are stable codes the app translates.

-- ───────────────────────── Types ─────────────────────────
create type public.member_role as enum ('admin', 'user');
create type public.currency_code as enum ('USD', 'SLSH');
create type public.record_status as enum ('active', 'voided');

-- ───────────────────────── Tables ─────────────────────────
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.super_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Roles live here (not in user-editable auth metadata). One business per staff account.
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role public.member_role not null default 'user',
  full_name text not null check (length(trim(full_name)) > 0),
  username text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index memberships_business_idx on public.memberships (business_id);

create table public.business_settings (
  business_id uuid primary key references public.businesses (id),
  users_see_all_banjarka boolean not null default false,
  fx_stale_hours integer not null default 24 check (fx_stale_hours between 1 and 720),
  default_low_stock integer not null default 3 check (default_low_stock >= 0),
  updated_at timestamptz not null default now()
);

-- Admin-managed exchange rate history. Latest row = current rate. Never edited, only appended.
create table public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  slsh_per_usd numeric(14, 4) not null check (slsh_per_usd > 0),
  source text not null default 'manual',
  note text,
  is_example boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default clock_timestamp()
);
create index fx_rates_business_idx on public.fx_rates (business_id, created_at desc);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  name text not null check (length(trim(name)) > 0),
  name_en text,
  category text,
  sku text,
  tyre_size text,
  condition text check (condition in ('new', 'used')),
  unit text not null default 'PCS',
  stock_qty integer not null default 0 check (stock_qty >= 0),
  cost_usd numeric(14, 4) not null default 0 check (cost_usd >= 0),
  sell_price_usd numeric(14, 4) check (sell_price_usd >= 0),
  supplier text,
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, sku)
);
create index products_business_idx on public.products (business_id, status, name);

-- Historical purchase receipts. Recorded for reference; they do NOT change stock by themselves.
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  supplier text not null,
  invoice_ref text,
  purchased_on date,
  currency public.currency_code not null default 'USD',
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  total numeric(14, 2) not null check (total >= 0),
  note text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id),
  business_id uuid not null references public.businesses (id),
  product_id uuid references public.products (id),
  description text not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(14, 2) not null check (line_total >= 0),
  unit_cost numeric(14, 4) generated always as (round(line_total / quantity, 4)) stored
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);

-- Append-only inventory ledger. products.stock_qty is the running balance of this ledger.
create table public.stock_movements (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id),
  product_id uuid not null references public.products (id),
  qty_change integer not null check (qty_change <> 0),
  balance_after integer not null check (balance_after >= 0),
  kind text not null check (kind in ('opening', 'purchase', 'adjustment', 'sale', 'sale_edit', 'sale_void',
                                     'usage', 'usage_edit', 'usage_void')),
  unit_cost_usd numeric(14, 4),
  ref_table text,
  ref_id uuid,
  note text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, id desc);
create index stock_movements_business_idx on public.stock_movements (business_id, created_at desc);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(16, 2) not null check (unit_price >= 0),
  currency public.currency_code not null,
  total numeric(16, 2) not null check (total >= 0),             -- in original currency
  fx_rate_id uuid references public.fx_rates (id),
  fx_slsh_per_usd numeric(14, 4) not null check (fx_slsh_per_usd > 0), -- immutable snapshot
  total_usd numeric(16, 4) not null,
  unit_cost_usd numeric(14, 4) not null,                         -- cost snapshot at sale time
  cost_usd numeric(16, 4) not null,
  profit_usd numeric(16, 4) not null,
  note text,
  status public.record_status not null default 'active',
  void_reason text,
  edit_count integer not null default 0,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sales_business_idx on public.sales (business_id, created_at desc);
create index sales_creator_idx on public.sales (created_by, created_at desc);

-- kind 'cash' = money spent; kind 'item' = stock used/damaged, valued at cost snapshot.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  kind text not null check (kind in ('cash', 'item')),
  amount numeric(16, 2) check (amount >= 0),
  currency public.currency_code not null default 'USD',
  fx_rate_id uuid references public.fx_rates (id),
  fx_slsh_per_usd numeric(14, 4) not null check (fx_slsh_per_usd > 0),
  amount_usd numeric(16, 4) not null check (amount_usd >= 0),
  product_id uuid references public.products (id),
  quantity integer check (quantity > 0),
  unit_cost_usd numeric(14, 4),
  reason text not null check (length(trim(reason)) >= 3),
  status public.record_status not null default 'active',
  void_reason text,
  edit_count integer not null default 0,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'cash' and amount is not null and product_id is null and quantity is null)
      or (kind = 'item' and product_id is not null and quantity is not null and unit_cost_usd is not null))
);
create index expenses_business_idx on public.expenses (business_id, created_at desc);
create index expenses_creator_idx on public.expenses (created_by, created_at desc);

create table public.banjarka_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  work_date date not null,
  currency public.currency_code not null,
  gross numeric(16, 2) not null check (gross >= 0),
  expenses numeric(16, 2) not null default 0 check (expenses >= 0),
  expense_reason text,
  net numeric(16, 2) not null,
  worker_share numeric(16, 2) not null,
  shop_share numeric(16, 2) not null,
  fx_rate_id uuid references public.fx_rates (id),
  fx_slsh_per_usd numeric(14, 4) not null check (fx_slsh_per_usd > 0),
  gross_usd numeric(16, 4) not null,
  expenses_usd numeric(16, 4) not null,
  net_usd numeric(16, 4) not null,
  worker_share_usd numeric(16, 4) not null,
  shop_share_usd numeric(16, 4) not null,
  note text,
  status public.record_status not null default 'active',
  void_reason text,
  edit_count integer not null default 0,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expenses <= gross),
  check (net = gross - expenses and worker_share + shop_share = net),
  check (expenses = 0 or length(trim(coalesce(expense_reason, ''))) >= 3)
);
create index banjarka_business_idx on public.banjarka_records (business_id, work_date desc);
-- One end-of-work total per worker per day (void the old one to re-enter).
create unique index banjarka_one_per_day on public.banjarka_records (created_by, work_date) where status = 'active';

-- Append-only audit trail: original + every before/after.
create table public.record_revisions (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id),
  table_name text not null check (table_name in ('sales', 'expenses', 'banjarka_records')),
  record_id uuid not null,
  action text not null check (action in ('create', 'edit', 'correction', 'void')),
  actor uuid references auth.users (id),
  actor_role text,
  reason text,
  changed_fields text[] not null default '{}',
  before jsonb,
  after jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create index record_revisions_record_idx on public.record_revisions (table_name, record_id, id);
create index record_revisions_business_idx on public.record_revisions (business_id, created_at desc);

-- ───────────────────────── Guards ─────────────────────────
create function public._forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'APPEND_ONLY' using errcode = '42501';
end $$;

create trigger record_revisions_append_only before update or delete on public.record_revisions
  for each row execute function public._forbid_mutation();
create trigger stock_movements_append_only before update or delete on public.stock_movements
  for each row execute function public._forbid_mutation();
create trigger fx_rates_append_only before update or delete on public.fx_rates
  for each row execute function public._forbid_mutation();
create trigger sales_no_delete before delete on public.sales
  for each row execute function public._forbid_mutation();
create trigger expenses_no_delete before delete on public.expenses
  for each row execute function public._forbid_mutation();
create trigger banjarka_no_delete before delete on public.banjarka_records
  for each row execute function public._forbid_mutation();

-- Authorship and creation time are immutable, so the 5h window can never be reset.
create function public._freeze_record_identity() returns trigger language plpgsql as $$
begin
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.business_id := old.business_id;
  new.updated_at := now();
  return new;
end $$;
create trigger sales_freeze before update on public.sales
  for each row execute function public._freeze_record_identity();
create trigger expenses_freeze before update on public.expenses
  for each row execute function public._freeze_record_identity();
create trigger banjarka_freeze before update on public.banjarka_records
  for each row execute function public._freeze_record_identity();

-- Admins may edit product details directly, but stock only moves through the ledger RPCs.
-- Not SECURITY DEFINER on purpose: current_user is the caller's role here.
create function public._products_guard() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.stock_qty := 0;
    else
      if new.stock_qty is distinct from old.stock_qty then
        raise exception 'STOCK_CHANGE_VIA_RPC_ONLY' using errcode = '42501';
      end if;
      new.business_id := old.business_id;
      new.created_at := old.created_at;
    end if;
  end if;
  if new.image_path is not null and new.image_path not like new.business_id::text || '/%' then
    raise exception 'INVALID_IMAGE_PATH';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger products_guard before insert or update on public.products
  for each row execute function public._products_guard();

-- ───────────────────────── Auth helpers (used by RLS) ─────────────────────────
create function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid());
$$;

create function public.my_business_id() returns uuid
language sql stable security definer set search_path = public as $$
  select m.business_id from public.memberships m
  join public.businesses b on b.id = m.business_id
  where m.user_id = auth.uid() and m.active and b.active;
$$;

create function public.is_member_of(p_business_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_business_id is not null and p_business_id = public.my_business_id();
$$;

create function public.is_admin_of(p_business_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m join public.businesses b on b.id = m.business_id
    where m.user_id = auth.uid() and m.active and b.active
      and m.role = 'admin' and m.business_id = p_business_id);
$$;

create function public.try_uuid(p text) returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- ───────────────────────── Internal helpers ─────────────────────────
create function public._me() returns public.memberships
language plpgsql stable security definer set search_path = public as $$
declare
  r public.memberships;
begin
  select m.* into r from public.memberships m
  join public.businesses b on b.id = m.business_id
  where m.user_id = auth.uid() and m.active and b.active;
  if r.id is null then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;
  return r;
end $$;

create function public._current_fx(p_business_id uuid) returns public.fx_rates
language plpgsql stable security definer set search_path = public as $$
declare
  r public.fx_rates;
begin
  select * into r from public.fx_rates where business_id = p_business_id
  order by created_at desc, id desc limit 1;
  if r.id is null then
    raise exception 'NO_FX_RATE';
  end if;
  return r;
end $$;

create function public._to_usd(p_amount numeric, p_currency public.currency_code, p_rate numeric)
returns numeric language sql immutable as $$
  select case when p_currency = 'USD' then p_amount else round(p_amount / p_rate, 4) end;
$$;

create function public._require_reason(p_reason text) returns void language plpgsql immutable as $$
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;
end $$;

-- Who may change an existing record: the author within exactly 5h of the server-side
-- created_at ('edit'), or a business admin at any time with a reason ('correction').
create function public._edit_mode(p_me public.memberships, p_created_by uuid, p_created_at timestamptz, p_reason text)
returns text language plpgsql stable as $$
begin
  if p_created_by = p_me.user_id and now() < p_created_at + interval '5 hours' then
    return 'edit';
  elsif p_me.role = 'admin' then
    perform public._require_reason(p_reason);
    return 'correction';
  elsif p_created_by <> p_me.user_id then
    raise exception 'NOT_AUTHOR' using errcode = '42501';
  else
    raise exception 'EDIT_WINDOW_CLOSED' using errcode = '42501';
  end if;
end $$;

create function public._move_stock(p_business_id uuid, p_product_id uuid, p_delta integer, p_kind text,
                                   p_ref_table text, p_ref_id uuid, p_unit_cost numeric, p_note text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_balance integer;
begin
  update public.products set stock_qty = stock_qty + p_delta
  where id = p_product_id and business_id = p_business_id and stock_qty + p_delta >= 0
  returning stock_qty into v_balance;
  if v_balance is null then
    if exists (select 1 from public.products where id = p_product_id and business_id = p_business_id) then
      raise exception 'INSUFFICIENT_STOCK';
    end if;
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  insert into public.stock_movements (business_id, product_id, qty_change, balance_after, kind,
                                      unit_cost_usd, ref_table, ref_id, note, created_by)
  values (p_business_id, p_product_id, p_delta, v_balance, p_kind, p_unit_cost, p_ref_table, p_ref_id, p_note, auth.uid());
  return v_balance;
end $$;

create function public._log_revision(p_business_id uuid, p_table text, p_record_id uuid, p_action text,
                                     p_reason text, p_before jsonb, p_after jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_fields text[] := '{}';
begin
  if p_before is not null then
    select coalesce(array_agg(k order by k), '{}') into v_fields
    from jsonb_object_keys(p_after) as k
    where k not in ('updated_at', 'edit_count') and (p_before -> k) is distinct from (p_after -> k);
    if p_action = 'edit' or p_action = 'correction' then
      if cardinality(v_fields) = 0 then
        raise exception 'NO_CHANGES';
      end if;
    end if;
  end if;
  insert into public.record_revisions (business_id, table_name, record_id, action, actor, actor_role,
                                       reason, changed_fields, before, after)
  values (p_business_id, p_table, p_record_id, p_action, auth.uid(),
          (select role::text from public.memberships where user_id = auth.uid()),
          nullif(trim(coalesce(p_reason, '')), ''), v_fields, p_before, p_after);
end $$;

create function public._today() returns date language sql stable as $$
  select (now() at time zone 'Africa/Mogadishu')::date;
$$;

-- ───────────────────────── Spare Parts: sales ─────────────────────────
create function public.record_sale(p_product_id uuid, p_quantity integer, p_unit_price numeric,
                                   p_currency public.currency_code, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_p public.products;
  v_fx public.fx_rates;
  v_id uuid;
  v_total numeric;
  v_total_usd numeric;
  v_cost numeric;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;
  if p_unit_price is null or p_unit_price < 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_currency is null then raise exception 'INVALID_CURRENCY'; end if;

  select * into v_p from public.products
  where id = p_product_id and business_id = v_me.business_id for update;
  if v_p.id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if v_p.status <> 'active' then raise exception 'PRODUCT_ARCHIVED'; end if;

  v_fx := public._current_fx(v_me.business_id);
  v_total := round(p_quantity * p_unit_price, 2);
  v_total_usd := public._to_usd(v_total, p_currency, v_fx.slsh_per_usd);
  v_cost := round(p_quantity * v_p.cost_usd, 4);

  insert into public.sales (business_id, product_id, quantity, unit_price, currency, total, fx_rate_id,
                            fx_slsh_per_usd, total_usd, unit_cost_usd, cost_usd, profit_usd, note, created_by)
  values (v_me.business_id, v_p.id, p_quantity, p_unit_price, p_currency, v_total, v_fx.id,
          v_fx.slsh_per_usd, v_total_usd, v_p.cost_usd, v_cost, v_total_usd - v_cost,
          nullif(trim(coalesce(p_note, '')), ''), v_me.user_id)
  returning id into v_id;

  perform public._move_stock(v_me.business_id, v_p.id, -p_quantity, 'sale', 'sales', v_id, v_p.cost_usd, null);
  perform public._log_revision(v_me.business_id, 'sales', v_id, 'create', null, null,
                               (select to_jsonb(s) from public.sales s where s.id = v_id));
  return v_id;
end $$;

create function public.update_sale(p_id uuid, p_quantity integer, p_unit_price numeric,
                                   p_currency public.currency_code, p_note text default null,
                                   p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_s public.sales;
  v_mode text;
  v_delta integer;
  v_total numeric;
  v_total_usd numeric;
  v_cost numeric;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;
  if p_unit_price is null or p_unit_price < 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_currency is null then raise exception 'INVALID_CURRENCY'; end if;

  select * into v_s from public.sales where id = p_id and business_id = v_me.business_id for update;
  if v_s.id is null then raise exception 'RECORD_NOT_FOUND'; end if;
  if v_s.status <> 'active' then raise exception 'RECORD_VOIDED'; end if;
  v_mode := public._edit_mode(v_me, v_s.created_by, v_s.created_at, p_reason);

  v_delta := p_quantity - v_s.quantity;
  if v_delta <> 0 then
    perform public._move_stock(v_me.business_id, v_s.product_id, -v_delta, 'sale_edit', 'sales', v_s.id,
                               v_s.unit_cost_usd, p_reason);
  end if;

  -- Keep the original FX and cost snapshots; only the entered values change.
  v_total := round(p_quantity * p_unit_price, 2);
  v_total_usd := public._to_usd(v_total, p_currency, v_s.fx_slsh_per_usd);
  v_cost := round(p_quantity * v_s.unit_cost_usd, 4);

  update public.sales set quantity = p_quantity, unit_price = p_unit_price, currency = p_currency,
         total = v_total, total_usd = v_total_usd, cost_usd = v_cost, profit_usd = v_total_usd - v_cost,
         note = nullif(trim(coalesce(p_note, '')), ''), edit_count = edit_count + 1
  where id = v_s.id;

  perform public._log_revision(v_me.business_id, 'sales', v_s.id, v_mode, p_reason, to_jsonb(v_s),
                               (select to_jsonb(s) from public.sales s where s.id = v_s.id));
end $$;

create function public.void_sale(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_s public.sales;
begin
  perform public._require_reason(p_reason);
  select * into v_s from public.sales where id = p_id and business_id = v_me.business_id for update;
  if v_s.id is null then raise exception 'RECORD_NOT_FOUND'; end if;
  if v_s.status <> 'active' then raise exception 'RECORD_VOIDED'; end if;
  perform public._edit_mode(v_me, v_s.created_by, v_s.created_at, p_reason);

  perform public._move_stock(v_me.business_id, v_s.product_id, v_s.quantity, 'sale_void', 'sales', v_s.id,
                             v_s.unit_cost_usd, p_reason);
  update public.sales set status = 'voided', void_reason = trim(p_reason), edit_count = edit_count + 1
  where id = v_s.id;
  perform public._log_revision(v_me.business_id, 'sales', v_s.id, 'void', p_reason, to_jsonb(v_s),
                               (select to_jsonb(s) from public.sales s where s.id = v_s.id));
end $$;

-- ───────────────────────── Spare Parts: expenses ─────────────────────────
create function public.record_cash_expense(p_amount numeric, p_currency public.currency_code, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_fx public.fx_rates;
  v_id uuid;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_currency is null then raise exception 'INVALID_CURRENCY'; end if;
  perform public._require_reason(p_reason);
  v_fx := public._current_fx(v_me.business_id);

  insert into public.expenses (business_id, kind, amount, currency, fx_rate_id, fx_slsh_per_usd, amount_usd,
                               reason, created_by)
  values (v_me.business_id, 'cash', round(p_amount, 2), p_currency, v_fx.id, v_fx.slsh_per_usd,
          public._to_usd(round(p_amount, 2), p_currency, v_fx.slsh_per_usd), trim(p_reason), v_me.user_id)
  returning id into v_id;
  perform public._log_revision(v_me.business_id, 'expenses', v_id, 'create', null, null,
                               (select to_jsonb(e) from public.expenses e where e.id = v_id));
  return v_id;
end $$;

-- Stock used or damaged: decrements stock and is valued at the product's cost snapshot.
create function public.record_item_expense(p_product_id uuid, p_quantity integer, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_p public.products;
  v_fx public.fx_rates;
  v_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;
  perform public._require_reason(p_reason);
  select * into v_p from public.products
  where id = p_product_id and business_id = v_me.business_id for update;
  if v_p.id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  v_fx := public._current_fx(v_me.business_id);

  insert into public.expenses (business_id, kind, currency, fx_rate_id, fx_slsh_per_usd, amount_usd,
                               product_id, quantity, unit_cost_usd, reason, created_by)
  values (v_me.business_id, 'item', 'USD', v_fx.id, v_fx.slsh_per_usd, round(p_quantity * v_p.cost_usd, 4),
          v_p.id, p_quantity, v_p.cost_usd, trim(p_reason), v_me.user_id)
  returning id into v_id;
  perform public._move_stock(v_me.business_id, v_p.id, -p_quantity, 'usage', 'expenses', v_id, v_p.cost_usd, p_reason);
  perform public._log_revision(v_me.business_id, 'expenses', v_id, 'create', null, null,
                               (select to_jsonb(e) from public.expenses e where e.id = v_id));
  return v_id;
end $$;

-- For cash expenses p_amount/p_currency apply; for item expenses p_quantity applies.
create function public.update_expense(p_id uuid, p_amount numeric, p_currency public.currency_code,
                                      p_quantity integer, p_expense_reason text, p_edit_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_e public.expenses;
  v_mode text;
  v_delta integer;
begin
  perform public._require_reason(p_expense_reason);
  select * into v_e from public.expenses where id = p_id and business_id = v_me.business_id for update;
  if v_e.id is null then raise exception 'RECORD_NOT_FOUND'; end if;
  if v_e.status <> 'active' then raise exception 'RECORD_VOIDED'; end if;
  v_mode := public._edit_mode(v_me, v_e.created_by, v_e.created_at, p_edit_reason);

  if v_e.kind = 'cash' then
    if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
    if p_currency is null then raise exception 'INVALID_CURRENCY'; end if;
    update public.expenses set amount = round(p_amount, 2), currency = p_currency,
           amount_usd = public._to_usd(round(p_amount, 2), p_currency, v_e.fx_slsh_per_usd),
           reason = trim(p_expense_reason), edit_count = edit_count + 1
    where id = v_e.id;
  else
    if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;
    v_delta := p_quantity - v_e.quantity;
    if v_delta <> 0 then
      perform public._move_stock(v_me.business_id, v_e.product_id, -v_delta, 'usage_edit', 'expenses', v_e.id,
                                 v_e.unit_cost_usd, p_edit_reason);
    end if;
    update public.expenses set quantity = p_quantity, amount_usd = round(p_quantity * v_e.unit_cost_usd, 4),
           reason = trim(p_expense_reason), edit_count = edit_count + 1
    where id = v_e.id;
  end if;

  perform public._log_revision(v_me.business_id, 'expenses', v_e.id, v_mode, p_edit_reason, to_jsonb(v_e),
                               (select to_jsonb(e) from public.expenses e where e.id = v_e.id));
end $$;

create function public.void_expense(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_e public.expenses;
begin
  perform public._require_reason(p_reason);
  select * into v_e from public.expenses where id = p_id and business_id = v_me.business_id for update;
  if v_e.id is null then raise exception 'RECORD_NOT_FOUND'; end if;
  if v_e.status <> 'active' then raise exception 'RECORD_VOIDED'; end if;
  perform public._edit_mode(v_me, v_e.created_by, v_e.created_at, p_reason);

  if v_e.kind = 'item' then
    perform public._move_stock(v_me.business_id, v_e.product_id, v_e.quantity, 'usage_void', 'expenses', v_e.id,
                               v_e.unit_cost_usd, p_reason);
  end if;
  update public.expenses set status = 'voided', void_reason = trim(p_reason), edit_count = edit_count + 1
  where id = v_e.id;
  perform public._log_revision(v_me.business_id, 'expenses', v_e.id, 'void', p_reason, to_jsonb(v_e),
                               (select to_jsonb(e) from public.expenses e where e.id = v_e.id));
end $$;

-- ───────────────────────── Banjarka ─────────────────────────
-- net = gross − expenses; worker gets half (rounded to cents), shop gets the exact remainder.
create function public._banjarka_values(p_gross numeric, p_expenses numeric, p_currency public.currency_code,
                                        p_rate numeric, p_reason text)
returns table (gross numeric, expenses numeric, net numeric, worker numeric, shop numeric,
               gross_usd numeric, expenses_usd numeric, net_usd numeric, worker_usd numeric, shop_usd numeric)
language plpgsql immutable as $$
declare
  g numeric := round(p_gross, 2);
  e numeric := round(coalesce(p_expenses, 0), 2);
  n numeric;
  w numeric;
  gu numeric;
  eu numeric;
  wu numeric;
begin
  if p_gross is null or p_gross < 0 or e < 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_currency is null then raise exception 'INVALID_CURRENCY'; end if;
  if e > g then raise exception 'EXPENSES_EXCEED_GROSS'; end if;
  if e > 0 then perform public._require_reason(p_reason); end if;
  n := g - e;
  w := round(n / 2, 2);
  gu := public._to_usd(g, p_currency, p_rate);
  eu := public._to_usd(e, p_currency, p_rate);
  wu := round((gu - eu) / 2, 4);
  return query select g, e, n, w, n - w, gu, eu, gu - eu, wu, (gu - eu) - wu;
end $$;

create function public.record_banjarka(p_gross numeric, p_expenses numeric, p_currency public.currency_code,
                                       p_expense_reason text default null, p_work_date date default null,
                                       p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_fx public.fx_rates;
  v record;
  v_date date := coalesce(p_work_date, public._today());
  v_id uuid;
begin
  if v_date > public._today() or v_date < public._today() - 7 then raise exception 'INVALID_WORK_DATE'; end if;
  v_fx := public._current_fx(v_me.business_id);
  select * into v from public._banjarka_values(p_gross, p_expenses, p_currency, v_fx.slsh_per_usd, p_expense_reason);
  if exists (select 1 from public.banjarka_records where created_by = v_me.user_id and work_date = v_date
             and status = 'active') then
    raise exception 'DUPLICATE_BANJARKA_DAY';
  end if;

  insert into public.banjarka_records (business_id, work_date, currency, gross, expenses, expense_reason, net,
         worker_share, shop_share, fx_rate_id, fx_slsh_per_usd, gross_usd, expenses_usd, net_usd,
         worker_share_usd, shop_share_usd, note, created_by)
  values (v_me.business_id, v_date, p_currency, v.gross, v.expenses,
          case when v.expenses > 0 then trim(p_expense_reason) end, v.net, v.worker, v.shop, v_fx.id,
          v_fx.slsh_per_usd, v.gross_usd, v.expenses_usd, v.net_usd, v.worker_usd, v.shop_usd,
          nullif(trim(coalesce(p_note, '')), ''), v_me.user_id)
  returning id into v_id;
  perform public._log_revision(v_me.business_id, 'banjarka_records', v_id, 'create', null, null,
                               (select to_jsonb(b) from public.banjarka_records b where b.id = v_id));
  return v_id;
end $$;

create function public.update_banjarka(p_id uuid, p_gross numeric, p_expenses numeric,
                                       p_currency public.currency_code, p_expense_reason text default null,
                                       p_note text default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_b public.banjarka_records;
  v record;
  v_mode text;
begin
  select * into v_b from public.banjarka_records where id = p_id and business_id = v_me.business_id for update;
  if v_b.id is null then raise exception 'RECORD_NOT_FOUND'; end if;
  if v_b.status <> 'active' then raise exception 'RECORD_VOIDED'; end if;
  v_mode := public._edit_mode(v_me, v_b.created_by, v_b.created_at, p_reason);
  select * into v from public._banjarka_values(p_gross, p_expenses, p_currency, v_b.fx_slsh_per_usd, p_expense_reason);

  update public.banjarka_records set currency = p_currency, gross = v.gross, expenses = v.expenses,
         expense_reason = case when v.expenses > 0 then trim(p_expense_reason) end,
         net = v.net, worker_share = v.worker, shop_share = v.shop, gross_usd = v.gross_usd,
         expenses_usd = v.expenses_usd, net_usd = v.net_usd, worker_share_usd = v.worker_usd,
         shop_share_usd = v.shop_usd, note = nullif(trim(coalesce(p_note, '')), ''), edit_count = edit_count + 1
  where id = v_b.id;
  perform public._log_revision(v_me.business_id, 'banjarka_records', v_b.id, v_mode, p_reason, to_jsonb(v_b),
                               (select to_jsonb(b) from public.banjarka_records b where b.id = v_b.id));
end $$;

create function public.void_banjarka(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_b public.banjarka_records;
begin
  perform public._require_reason(p_reason);
  select * into v_b from public.banjarka_records where id = p_id and business_id = v_me.business_id for update;
  if v_b.id is null then raise exception 'RECORD_NOT_FOUND'; end if;
  if v_b.status <> 'active' then raise exception 'RECORD_VOIDED'; end if;
  perform public._edit_mode(v_me, v_b.created_by, v_b.created_at, p_reason);
  update public.banjarka_records set status = 'voided', void_reason = trim(p_reason), edit_count = edit_count + 1
  where id = v_b.id;
  perform public._log_revision(v_me.business_id, 'banjarka_records', v_b.id, 'void', p_reason, to_jsonb(v_b),
                               (select to_jsonb(b) from public.banjarka_records b where b.id = v_b.id));
end $$;

-- ───────────────────────── Admin: inventory + FX ─────────────────────────
-- 'opening'/'purchase' add stock; 'adjustment' is a signed correction (count, loss found, etc.).
-- 'purchase' with a unit cost re-weights the product's average cost; old sales keep their snapshot.
create function public.adjust_stock(p_product_id uuid, p_qty_change integer, p_kind text, p_note text default null,
                                    p_unit_cost_usd numeric default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_p public.products;
  v_balance integer;
begin
  if v_me.role <> 'admin' then raise exception 'ADMIN_ONLY' using errcode = '42501'; end if;
  if p_kind not in ('opening', 'purchase', 'adjustment') then raise exception 'INVALID_KIND'; end if;
  if p_qty_change is null or p_qty_change = 0 then raise exception 'INVALID_QUANTITY'; end if;
  if p_kind in ('opening', 'purchase') and p_qty_change < 0 then raise exception 'INVALID_QUANTITY'; end if;
  if p_kind = 'adjustment' then perform public._require_reason(p_note); end if;
  if p_unit_cost_usd is not null and p_unit_cost_usd < 0 then raise exception 'INVALID_AMOUNT'; end if;

  select * into v_p from public.products
  where id = p_product_id and business_id = v_me.business_id for update;
  if v_p.id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;

  if p_unit_cost_usd is not null and p_kind in ('opening', 'purchase') then
    update public.products set cost_usd = round(
      (v_p.stock_qty * v_p.cost_usd + p_qty_change * p_unit_cost_usd) / (v_p.stock_qty + p_qty_change), 4)
    where id = v_p.id;
  end if;
  v_balance := public._move_stock(v_me.business_id, v_p.id, p_qty_change, p_kind, null, null,
                                  coalesce(p_unit_cost_usd, v_p.cost_usd), nullif(trim(coalesce(p_note, '')), ''));
  return v_balance;
end $$;

create function public.set_fx_rate(p_slsh_per_usd numeric, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_id uuid;
begin
  if v_me.role <> 'admin' then raise exception 'ADMIN_ONLY' using errcode = '42501'; end if;
  if p_slsh_per_usd is null or p_slsh_per_usd < 100 or p_slsh_per_usd > 1000000 then
    raise exception 'INVALID_RATE';
  end if;
  insert into public.fx_rates (business_id, slsh_per_usd, source, note, created_by)
  values (v_me.business_id, p_slsh_per_usd, 'manual', nullif(trim(coalesce(p_note, '')), ''), v_me.user_id)
  returning id into v_id;
  return v_id;
end $$;

-- ───────────────────────── Super Admin ─────────────────────────
create function public.create_business(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_super_admin() then raise exception 'SUPER_ADMIN_ONLY' using errcode = '42501'; end if;
  insert into public.businesses (name, slug) values (trim(p_name), lower(trim(p_slug))) returning id into v_id;
  insert into public.business_settings (business_id) values (v_id);
  -- Starting example only; the UI flags is_example rates until an admin sets a real one.
  insert into public.fx_rates (business_id, slsh_per_usd, source, note, is_example, created_by)
  values (v_id, 11800, 'example', 'Starting example only — not a live market rate', true, auth.uid());
  return v_id;
end $$;

-- ───────────────────────── Reports ─────────────────────────
-- Period is inclusive dates in Africa/Mogadishu (Hargeisa) time; null = unbounded.
-- Money is summed only in USD-normalised columns; original-currency totals are grouped per currency.
create function public.report_summary(p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_from timestamptz := case when p_from is null then '-infinity'::timestamptz
                             else p_from::timestamp at time zone 'Africa/Mogadishu' end;
  v_to timestamptz := case when p_to is null then 'infinity'::timestamptz
                           else (p_to + 1)::timestamp at time zone 'Africa/Mogadishu' end;
  r jsonb;
begin
  if v_me.role <> 'admin' then raise exception 'ADMIN_ONLY' using errcode = '42501'; end if;
  with s as (
    select * from public.sales where business_id = v_me.business_id and status = 'active'
      and created_at >= v_from and created_at < v_to),
  e as (
    select * from public.expenses where business_id = v_me.business_id and status = 'active'
      and created_at >= v_from and created_at < v_to),
  b as (
    select * from public.banjarka_records where business_id = v_me.business_id and status = 'active'
      and (p_from is null or work_date >= p_from) and (p_to is null or work_date <= p_to)),
  totals as (
    select
      (select count(*) from s) as sales_count,
      (select coalesce(sum(quantity), 0) from s) as units_sold,
      round((select coalesce(sum(total_usd), 0) from s), 2) as sales_usd,
      round((select coalesce(sum(cost_usd), 0) from s), 2) as cogs_usd,
      round((select coalesce(sum(amount_usd), 0) from e where kind = 'cash'), 2) as cash_exp_usd,
      round((select coalesce(sum(amount_usd), 0) from e where kind = 'item'), 2) as item_exp_usd,
      (select count(*) from b) as banjarka_count,
      round((select coalesce(sum(gross_usd), 0) from b), 2) as bj_gross,
      round((select coalesce(sum(expenses_usd), 0) from b), 2) as bj_exp,
      round((select coalesce(sum(net_usd), 0) from b), 2) as bj_net,
      round((select coalesce(sum(worker_share_usd), 0) from b), 2) as bj_worker)
  select jsonb_build_object(
    'sales_count', t.sales_count,
    'units_sold', t.units_sold,
    'sales_usd', round(t.sales_usd, 2),
    'cogs_usd', round(t.cogs_usd, 2),
    'gross_profit_usd', round(t.sales_usd - t.cogs_usd, 2),
    'cash_expenses_usd', round(t.cash_exp_usd, 2),
    'item_usage_cost_usd', round(t.item_exp_usd, 2),
    'spare_parts_net_usd', round(t.sales_usd - t.cogs_usd - t.cash_exp_usd - t.item_exp_usd, 2),
    'banjarka_count', t.banjarka_count,
    'banjarka_gross_usd', round(t.bj_gross, 2),
    'banjarka_expenses_usd', round(t.bj_exp, 2),
    'banjarka_net_usd', round(t.bj_net, 2),
    'banjarka_worker_usd', round(t.bj_worker, 2),
    'banjarka_shop_usd', t.bj_net - t.bj_worker,
    'shop_net_usd', round(t.sales_usd - t.cogs_usd - t.cash_exp_usd - t.item_exp_usd + (t.bj_net - t.bj_worker), 2),
    'sales_by_currency', (select coalesce(jsonb_object_agg(currency, amt), '{}') from
                            (select currency, sum(total) as amt from s group by currency) x),
    'cash_expenses_by_currency', (select coalesce(jsonb_object_agg(currency, amt), '{}') from
                            (select currency, sum(amount) as amt from e where kind = 'cash' group by currency) x),
    'banjarka_gross_by_currency', (select coalesce(jsonb_object_agg(currency, amt), '{}') from
                            (select currency, sum(gross) as amt from b group by currency) x),
    'edited_count', (select count(*) from s where edit_count > 0)
                  + (select count(*) from e where edit_count > 0)
                  + (select count(*) from b where edit_count > 0))
  into r from totals t;
  return r;
end $$;

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.businesses enable row level security;
alter table public.super_admins enable row level security;
alter table public.memberships enable row level security;
alter table public.business_settings enable row level security;
alter table public.fx_rates enable row level security;
alter table public.products enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.banjarka_records enable row level security;
alter table public.record_revisions enable row level security;

create policy businesses_read on public.businesses for select to authenticated
  using ((select public.is_super_admin()) or id = (select public.my_business_id()));
create policy businesses_super_update on public.businesses for update to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

create policy super_admins_self on public.super_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- Coworker names are visible so records can show who entered them. Writes go via server actions.
create policy memberships_read on public.memberships for select to authenticated
  using ((select public.is_super_admin()) or business_id = (select public.my_business_id()));

create policy settings_read on public.business_settings for select to authenticated
  using (business_id = (select public.my_business_id()));
create policy settings_admin_update on public.business_settings for update to authenticated
  using ((select public.is_admin_of(business_id))) with check ((select public.is_admin_of(business_id)));

create policy fx_read on public.fx_rates for select to authenticated
  using (business_id = (select public.my_business_id()));

create policy products_read on public.products for select to authenticated
  using (business_id = (select public.my_business_id()));
create policy products_admin_insert on public.products for insert to authenticated
  with check ((select public.is_admin_of(business_id)));
create policy products_admin_update on public.products for update to authenticated
  using ((select public.is_admin_of(business_id))) with check ((select public.is_admin_of(business_id)));

create policy purchases_admin_read on public.purchases for select to authenticated
  using ((select public.is_admin_of(business_id)));
create policy purchases_admin_insert on public.purchases for insert to authenticated
  with check ((select public.is_admin_of(business_id)));
create policy purchase_items_admin_read on public.purchase_items for select to authenticated
  using ((select public.is_admin_of(business_id)));
create policy purchase_items_admin_insert on public.purchase_items for insert to authenticated
  with check ((select public.is_admin_of(business_id))
              and exists (select 1 from public.purchases p where p.id = purchase_id and p.business_id = purchase_items.business_id));

create policy movements_admin_read on public.stock_movements for select to authenticated
  using ((select public.is_admin_of(business_id)));

-- Users see every coworker's sales (read-only); writes only via RPCs.
create policy sales_read on public.sales for select to authenticated
  using (business_id = (select public.my_business_id()));

create policy expenses_read on public.expenses for select to authenticated
  using ((select public.is_admin_of(business_id))
         or (created_by = (select auth.uid()) and business_id = (select public.my_business_id())));

create policy banjarka_read on public.banjarka_records for select to authenticated
  using ((select public.is_admin_of(business_id))
         or (business_id = (select public.my_business_id())
             and (created_by = (select auth.uid())
                  or exists (select 1 from public.business_settings bs
                             where bs.business_id = banjarka_records.business_id and bs.users_see_all_banjarka))));

create policy revisions_read on public.record_revisions for select to authenticated
  using ((select public.is_admin_of(business_id))
         or (actor = (select auth.uid()) and business_id = (select public.my_business_id())));

-- Defence in depth: no direct writes to ledgers/financial tables from API roles.
revoke insert, update, delete, truncate on public.sales, public.expenses, public.banjarka_records,
  public.record_revisions, public.stock_movements, public.fx_rates, public.super_admins,
  public.memberships, public.businesses from anon, authenticated;
grant update on public.businesses to authenticated;
revoke all on all tables in schema public from anon;
revoke delete, truncate on public.products, public.purchases, public.purchase_items, public.business_settings
  from authenticated;

-- Functions: nothing for anon; internals not callable from the API.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public._me(), public._current_fx(uuid), public._move_stock(uuid, uuid, integer, text, text, uuid, numeric, text),
  public._log_revision(uuid, text, uuid, text, text, jsonb, jsonb),
  public._edit_mode(public.memberships, uuid, timestamptz, text) from authenticated;

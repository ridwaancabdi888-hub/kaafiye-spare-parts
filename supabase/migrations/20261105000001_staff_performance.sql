-- Display currency (SlSh figures from each record's own rate snapshot), employee archive,
-- employee performance and optional admin-recorded rewards. Stored amounts are never rewritten.

-- ───────── SlSh equivalent of a stored record ─────────
-- SlSh records keep their entered amount; USD records use the rate saved on that record.
create function public._as_slsh(p_native numeric, p_currency public.currency_code, p_usd numeric, p_rate numeric)
returns numeric language sql immutable as $$
  select case when p_currency = 'SLSH' then p_native else p_usd * p_rate end;
$$;

-- ───────── Unconfirmed purchase costs ─────────
-- A cost the owner has not confirmed yet is flagged, so profit built on it is shown as uncertain.
alter table public.products add column cost_confirmed boolean not null default true;

-- ───────── Employee archive (removed from active employment; history is kept) ─────────
alter table public.memberships add column archived_at timestamptz;
alter table public.memberships add column archived_by uuid;
alter table public.memberships add constraint memberships_archived_inactive check (archived_at is null or not active);

alter table public.account_events drop constraint account_events_event_check;
alter table public.account_events add constraint account_events_event_check check (event in (
  'account_created', 'password_reset', 'password_changed', 'disabled', 'enabled', 'username_set',
  'archived', 'restored', 'reward_recorded', 'reward_voided'));

-- ───────── Optional rewards: a record of what the admin decided, never an automatic payment ─────────
create table public.employee_rewards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  user_id uuid not null references auth.users (id),
  amount numeric(16, 2) not null check (amount > 0),
  currency public.currency_code not null,
  fx_rate_id uuid references public.fx_rates (id),
  fx_slsh_per_usd numeric(14, 4) not null check (fx_slsh_per_usd > 0),
  amount_usd numeric(16, 4) not null,
  reward_date date not null,
  reason text not null check (length(trim(reason)) >= 3),
  status public.record_status not null default 'active',
  void_reason text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employee_rewards_business_idx on public.employee_rewards (business_id, reward_date desc);
create trigger employee_rewards_no_delete before delete on public.employee_rewards
  for each row execute function public._forbid_mutation();
create trigger employee_rewards_freeze before update on public.employee_rewards
  for each row execute function public._freeze_record_identity();
alter table public.employee_rewards enable row level security;
create policy employee_rewards_read on public.employee_rewards for select to authenticated
  using ((select public.is_admin_of(business_id))
         or (user_id = (select auth.uid()) and business_id = (select public.my_business_id())));
revoke insert, update, delete, truncate on public.employee_rewards from anon, authenticated;
revoke all on public.employee_rewards from anon;

create function public.record_reward(p_user_id uuid, p_amount numeric, p_currency public.currency_code,
                                     p_reward_date date, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_target public.memberships;
  v_fx public.fx_rates;
  v_id uuid;
begin
  if v_me.role <> 'admin' then raise exception 'ADMIN_ONLY' using errcode = '42501'; end if;
  select * into v_target from public.memberships where user_id = p_user_id and business_id = v_me.business_id;
  if v_target.id is null then raise exception 'RECORD_NOT_FOUND'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_currency is null then raise exception 'INVALID_CURRENCY'; end if;
  if p_reward_date is null or p_reward_date > public._today() then raise exception 'INVALID_WORK_DATE'; end if;
  perform public._require_reason(p_reason);
  v_fx := public._current_fx(v_me.business_id);
  insert into public.employee_rewards (business_id, user_id, amount, currency, fx_rate_id, fx_slsh_per_usd, amount_usd,
                                       reward_date, reason, created_by)
  values (v_me.business_id, p_user_id, round(p_amount, 2), p_currency, v_fx.id, v_fx.slsh_per_usd,
          public._to_usd(round(p_amount, 2), p_currency, v_fx.slsh_per_usd), p_reward_date, trim(p_reason), v_me.user_id)
  returning id into v_id;
  insert into public.account_events (business_id, target_user, target_name, actor, actor_name, event, detail)
  values (v_me.business_id, p_user_id, v_target.full_name, v_me.user_id, v_me.full_name, 'reward_recorded',
          jsonb_build_object('reward_id', v_id, 'amount', round(p_amount, 2), 'currency', p_currency, 'date', p_reward_date));
  return v_id;
end $$;

create function public.void_reward(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me public.memberships := public._me();
  v_r public.employee_rewards;
begin
  if v_me.role <> 'admin' then raise exception 'ADMIN_ONLY' using errcode = '42501'; end if;
  select * into v_r from public.employee_rewards where id = p_id and business_id = v_me.business_id for update;
  if v_r.id is null then raise exception 'RECORD_NOT_FOUND'; end if;
  if v_r.status <> 'active' then raise exception 'RECORD_VOIDED'; end if;
  perform public._require_reason(p_reason);
  update public.employee_rewards set status = 'voided', void_reason = trim(p_reason) where id = p_id;
  insert into public.account_events (business_id, target_user, target_name, actor, actor_name, event, detail)
  select v_me.business_id, v_r.user_id, m.full_name, v_me.user_id, v_me.full_name, 'reward_voided',
         jsonb_build_object('reward_id', p_id, 'reason', trim(p_reason))
  from public.memberships m where m.user_id = v_r.user_id;
end $$;

-- ───────── Reports: USD and SlSh totals side by side ─────────
create or replace function public.report_summary(p_from date default null, p_to date default null)
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
      round((select coalesce(sum(worker_share_usd), 0) from b), 2) as bj_worker,
      round((select coalesce(sum(public._as_slsh(total, currency, total_usd, fx_slsh_per_usd)), 0) from s), 2) as sales_slsh,
      round((select coalesce(sum(cost_usd * fx_slsh_per_usd), 0) from s), 2) as cogs_slsh,
      round((select coalesce(sum(public._as_slsh(amount, currency, amount_usd, fx_slsh_per_usd)), 0) from e where kind = 'cash'), 2) as cash_exp_slsh,
      round((select coalesce(sum(amount_usd * fx_slsh_per_usd), 0) from e where kind = 'item'), 2) as item_exp_slsh,
      round((select coalesce(sum(public._as_slsh(gross, currency, gross_usd, fx_slsh_per_usd)), 0) from b), 2) as bj_gross_slsh,
      round((select coalesce(sum(public._as_slsh(expenses, currency, expenses_usd, fx_slsh_per_usd)), 0) from b), 2) as bj_exp_slsh,
      round((select coalesce(sum(public._as_slsh(net, currency, net_usd, fx_slsh_per_usd)), 0) from b), 2) as bj_net_slsh,
      round((select coalesce(sum(public._as_slsh(worker_share, currency, worker_share_usd, fx_slsh_per_usd)), 0) from b), 2) as bj_worker_slsh)
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
    'sales_slsh', t.sales_slsh,
    'cogs_slsh', t.cogs_slsh,
    'gross_profit_slsh', t.sales_slsh - t.cogs_slsh,
    'cash_expenses_slsh', t.cash_exp_slsh,
    'item_usage_cost_slsh', t.item_exp_slsh,
    'spare_parts_net_slsh', t.sales_slsh - t.cogs_slsh - t.cash_exp_slsh - t.item_exp_slsh,
    'banjarka_gross_slsh', t.bj_gross_slsh,
    'banjarka_expenses_slsh', t.bj_exp_slsh,
    'banjarka_net_slsh', t.bj_net_slsh,
    'banjarka_worker_slsh', t.bj_worker_slsh,
    'banjarka_shop_slsh', t.bj_net_slsh - t.bj_worker_slsh,
    'shop_net_slsh', t.sales_slsh - t.cogs_slsh - t.cash_exp_slsh - t.item_exp_slsh + (t.bj_net_slsh - t.bj_worker_slsh),
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

-- ───────── Employee performance ─────────
-- Only active (non-voided) records count; edits change a record in place, so nothing is counted twice.
-- "business_*" is money the business earned through the employee, not the employee's own pay.
create function public.staff_performance(p_from date default null, p_to date default null)
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
    select created_by, count(*) as n, sum(total_usd) as usd,
           sum(public._as_slsh(total, currency, total_usd, fx_slsh_per_usd)) as slsh
    from public.sales where business_id = v_me.business_id and status = 'active'
      and created_at >= v_from and created_at < v_to
    group by created_by),
  b as (
    select created_by, count(*) as n,
           sum(gross_usd) as gross_usd, sum(expenses_usd) as exp_usd, sum(net_usd) as net_usd,
           sum(worker_share_usd) as worker_usd, sum(shop_share_usd) as shop_usd,
           sum(public._as_slsh(gross, currency, gross_usd, fx_slsh_per_usd)) as gross_slsh,
           sum(public._as_slsh(expenses, currency, expenses_usd, fx_slsh_per_usd)) as exp_slsh,
           sum(public._as_slsh(net, currency, net_usd, fx_slsh_per_usd)) as net_slsh,
           sum(public._as_slsh(worker_share, currency, worker_share_usd, fx_slsh_per_usd)) as worker_slsh,
           sum(public._as_slsh(shop_share, currency, shop_share_usd, fx_slsh_per_usd)) as shop_slsh
    from public.banjarka_records where business_id = v_me.business_id and status = 'active'
      and (p_from is null or work_date >= p_from) and (p_to is null or work_date <= p_to)
    group by created_by)
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', m.user_id,
    'full_name', m.full_name,
    'role', m.role,
    'active', m.active,
    'archived', m.archived_at is not null,
    'sales_count', coalesce(s.n, 0),
    'sales_usd', round(coalesce(s.usd, 0), 2),
    'sales_slsh', round(coalesce(s.slsh, 0), 2),
    'bj_count', coalesce(b.n, 0),
    'bj_gross_usd', round(coalesce(b.gross_usd, 0), 2),
    'bj_gross_slsh', round(coalesce(b.gross_slsh, 0), 2),
    'bj_expenses_usd', round(coalesce(b.exp_usd, 0), 2),
    'bj_expenses_slsh', round(coalesce(b.exp_slsh, 0), 2),
    'bj_net_usd', round(coalesce(b.net_usd, 0), 2),
    'bj_net_slsh', round(coalesce(b.net_slsh, 0), 2),
    'bj_worker_usd', round(coalesce(b.worker_usd, 0), 2),
    'bj_worker_slsh', round(coalesce(b.worker_slsh, 0), 2),
    'bj_shop_usd', round(coalesce(b.shop_usd, 0), 2),
    'bj_shop_slsh', round(coalesce(b.shop_slsh, 0), 2),
    'business_usd', round(coalesce(s.usd, 0) + coalesce(b.shop_usd, 0), 2),
    'business_slsh', round(coalesce(s.slsh, 0) + coalesce(b.shop_slsh, 0), 2)
  ) order by m.created_at), '[]'::jsonb)
  into r
  from public.memberships m
  left join s on s.created_by = m.user_id
  left join b on b.created_by = m.user_id
  where m.business_id = v_me.business_id;
  return r;
end $$;

-- New functions: nothing for anon; internals not callable from the API.
revoke execute on function public._as_slsh(numeric, public.currency_code, numeric, numeric),
  public.record_reward(uuid, numeric, public.currency_code, date, text), public.void_reward(uuid, text),
  public.staff_performance(date, date) from public, anon;
grant execute on function public.record_reward(uuid, numeric, public.currency_code, date, text),
  public.void_reward(uuid, text), public.staff_performance(date, date) to authenticated;
revoke execute on function public._as_slsh(numeric, public.currency_code, numeric, numeric) from authenticated;

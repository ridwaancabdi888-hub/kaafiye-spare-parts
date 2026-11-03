-- Pre-handover cleanup, approved by the project owner on 3 Nov 2026.
-- Permanently removes the 7 records the owner confirmed as test data (by exact ID only),
-- their audit revisions and their stock movements, then rebuilds stock from the remaining
-- ledger (the owner-approved opening baseline). Backup taken beforehand (backups/, not in git).
-- Atomic: any unexpected data or a baseline mismatch aborts and changes nothing.
begin;

create temp table cleanup_ids (id uuid primary key, tbl text) on commit drop;
insert into cleanup_ids values
  ('873b6e22-64a4-4b74-b6ba-858d25b9abae', 'banjarka_records'), -- 2 Nov 11:54, 200,000−10,000 SlSh
  ('78c20467-2d6e-4e8c-8a73-900a8ca5bd99', 'banjarka_records'), -- 3 Nov 12:46, 150,000 SlSh
  ('fde7418e-485a-4d26-9af1-b4aa2295d32d', 'sales'),            -- Puncture Proof ×1 @ 35,000 SlSh
  ('d970bd80-f7c8-4c9c-b8b8-65b50c4ffef1', 'sales'),            -- Filter ×1 @ 23,000 SlSh
  ('7d368cf4-f0fd-4f50-b48a-59058335d20a', 'sales'),            -- Waal Tubeless ×1 @ $0.50
  ('03c3eb18-7b57-42dc-91ba-0ae6ae90c68e', 'sales'),            -- Xaydh Yar ×2 @ 23,600 SlSh
  ('083e4d82-792d-448f-9b8c-e6dab827d736', 'sales');            -- Puncture Proof ×1 @ 30,000 SlSh

do $$
declare
  v_bid constant uuid := '4349332f-0a2f-424d-a542-f88c9b039d8c';
  n integer;
begin
  -- Every listed record must exist in Kaafiye, and nothing unlisted may exist.
  select count(*) into n from public.sales where business_id = v_bid and id not in (select id from cleanup_ids);
  if n > 0 then raise exception 'ABORT: % unlisted sale(s) exist', n; end if;
  select count(*) into n from public.banjarka_records where business_id = v_bid and id not in (select id from cleanup_ids);
  if n > 0 then raise exception 'ABORT: % unlisted Banjarka record(s) exist', n; end if;
  select count(*) into n from public.expenses where business_id = v_bid;
  if n > 0 then raise exception 'ABORT: % expense(s) exist', n; end if;
  select count(*) into n from public.stock_movements where business_id = v_bid and kind <> 'opening'
    and ref_id not in (select id from cleanup_ids);
  if n > 0 then raise exception 'ABORT: % unrelated stock movement(s) exist', n; end if;
end $$;

alter table public.record_revisions disable trigger record_revisions_append_only;
alter table public.stock_movements disable trigger stock_movements_append_only;
alter table public.sales disable trigger sales_no_delete;
alter table public.banjarka_records disable trigger banjarka_no_delete;

delete from public.record_revisions where record_id in (select id from cleanup_ids)
  and business_id = '4349332f-0a2f-424d-a542-f88c9b039d8c';
delete from public.stock_movements where ref_id in (select id from cleanup_ids where tbl = 'sales')
  and business_id = '4349332f-0a2f-424d-a542-f88c9b039d8c';
delete from public.sales where id in (select id from cleanup_ids where tbl = 'sales')
  and business_id = '4349332f-0a2f-424d-a542-f88c9b039d8c';
delete from public.banjarka_records where id in (select id from cleanup_ids where tbl = 'banjarka_records')
  and business_id = '4349332f-0a2f-424d-a542-f88c9b039d8c';

alter table public.record_revisions enable trigger record_revisions_append_only;
alter table public.stock_movements enable trigger stock_movements_append_only;
alter table public.sales enable trigger sales_no_delete;
alter table public.banjarka_records enable trigger banjarka_no_delete;

-- Stock = what the remaining ledger says (the opening baseline).
update public.products p set stock_qty = coalesce((select sum(m.qty_change) from public.stock_movements m where m.product_id = p.id), 0)
where p.business_id = '4349332f-0a2f-424d-a542-f88c9b039d8c';

do $$
declare
  v_bid constant uuid := '4349332f-0a2f-424d-a542-f88c9b039d8c';
  r record;
  v_units integer;
begin
  for r in select * from (values ('Saliid Biriig', 30), ('Xaydh Weyn', 11), ('Xaydh Yar', 14), ('Filter', 18), ('Taayir R18', 2),
      ('Taayir R15', 9), ('Taayir R14', 5), ('Waal Tubeless', 100), ('Xabag Tubeless', 20), ('Puncture Proof', 24)) as x(name, qty)
  loop
    if not exists (select 1 from public.products where business_id = v_bid and name = r.name and stock_qty = r.qty and status = 'active') then
      raise exception 'ABORT: % is not at its baseline of %', r.name, r.qty;
    end if;
  end loop;
  select sum(stock_qty) into v_units from public.products where business_id = v_bid;
  if v_units <> 233 or (select count(*) from public.products where business_id = v_bid) <> 10 then
    raise exception 'ABORT: totals are % units', v_units;
  end if;
  if exists (select 1 from public.sales where business_id = v_bid) or exists (select 1 from public.banjarka_records where business_id = v_bid)
     or exists (select 1 from public.record_revisions where business_id = v_bid) then
    raise exception 'ABORT: records remain';
  end if;
end $$;

commit;

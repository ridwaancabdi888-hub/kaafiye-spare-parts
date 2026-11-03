-- Owner-approved initial stock baseline for the Kaafiye business (approved 2 Nov 2026).
-- 10 products, 233 units, $575.00 potential retail value.
--
-- Safe to re-run: one atomic block. Products are matched by name (case-insensitive), the stock
-- is recorded once as an 'opening' ledger movement tagged with the marker below, and the whole
-- block aborts (changing nothing) if a product already has other stock movements to reconcile.
--
-- Purchase costs: taken from the known Geelle Trading / Tawakal receipts only where the product
-- clearly matches. Unknown costs stay 0 and the app shows them as "cost not set".
-- Historical receipts are NOT imported as extra stock.
do $$
declare
  v_bid constant uuid := '4349332f-0a2f-424d-a542-f88c9b039d8c';  -- "Kaafiye spare part"
  v_marker constant text := 'Owner-approved initial stock baseline (2026-11-02)';
  r record;
  v_pid uuid;
  v_units integer;
  v_value numeric;
  v_count integer;
begin
  if not exists (select 1 from public.businesses where id = v_bid and active) then
    raise exception 'Kaafiye business % not found or inactive', v_bid;
  end if;

  for r in select * from (values
      -- name,            qty, sell $, cost $, tyre size, supplier
      ('Saliid Biriig',     30,  1.00, 0.625, null, 'Geelle Trading'),            -- brake fluid: receipt 24 pcs / $15
      ('Xaydh Weyn',        11,  4.00, 0,     null, null),
      ('Xaydh Yar',         14,  2.00, 0,     null, null),
      ('Filter',            18,  2.00, 0,     null, null),
      ('Taayir R18',         2, 22.00, 0,     'R18', null),
      ('Taayir R15',         9, 19.00, 16.00, 'R15', 'Tawakal Auto Spare Parts'), -- receipt 195/65/R15 @ $16
      ('Taayir R14',         5, 18.00, 15.00, 'R14', 'Tawakal Auto Spare Parts'), -- receipt 175/65/R14 @ $15
      ('Waal Tubeless',    100,  0.50, 0.20,  null, 'Geelle Trading'),            -- receipt 100 pcs / $20
      ('Xabag Tubeless',    20,  0.50, 0.175, null, 'Geelle Trading'),            -- receipt 20 pcs / $3.50
      ('Puncture Proof',    24,  3.00, 1.25,  null, 'Geelle Trading')             -- receipt 24 pcs / $30
    ) as x(name, qty, price, cost, tyre_size, supplier)
  loop
    select id into v_pid from public.products where business_id = v_bid and lower(name) = lower(r.name);
    if v_pid is null then
      insert into public.products (business_id, name, tyre_size, unit, cost_usd, sell_price_usd, supplier, low_stock_threshold)
      values (v_bid, r.name, r.tyre_size, 'PCS', r.cost, r.price, r.supplier, 3)
      returning id into v_pid;
    end if;

    if exists (select 1 from public.stock_movements where product_id = v_pid and kind = 'opening' and note = v_marker) then
      continue; -- already imported
    end if;
    if exists (select 1 from public.stock_movements where product_id = v_pid) then
      raise exception 'Product "%" already has stock movements — reconcile manually, nothing was changed', r.name;
    end if;

    update public.products set sell_price_usd = r.price,
           cost_usd = case when cost_usd = 0 then r.cost else cost_usd end
    where id = v_pid;
    perform public._move_stock(v_bid, v_pid, r.qty, 'opening', null, null, r.cost, v_marker);
  end loop;

  select count(*), sum(stock_qty), sum(stock_qty * sell_price_usd) into v_count, v_units, v_value
  from public.products where business_id = v_bid and status = 'active';
  if v_count <> 10 or v_units <> 233 or v_value <> 575 then
    raise exception 'Verification failed: % products, % units, $% retail (expected 10 / 233 / $575)', v_count, v_units, v_value;
  end if;
end $$;

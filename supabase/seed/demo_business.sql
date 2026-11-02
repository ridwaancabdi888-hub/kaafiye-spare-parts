-- DEMO / STAGING ONLY — do not run on the production project.
-- Creates a clearly-labelled demo business with example products and stock so the UI can be
-- tried. No sales/expenses/Banjarka are inserted: records need a real signed-in user.
do $$
declare
  v_bid uuid;
  v_p uuid;
  r record;
begin
  if exists (select 1 from public.businesses where slug = 'demo') then
    raise notice 'Demo business exists'; return;
  end if;
  insert into public.businesses (name, slug) values ('DEMO — Tusaale / Example', 'demo') returning id into v_bid;
  insert into public.business_settings (business_id) values (v_bid);
  insert into public.fx_rates (business_id, slsh_per_usd, source, note, is_example)
  values (v_bid, 11800, 'example', 'Starting example only — not a live market rate', true);

  for r in select * from (values
      ('(DEMO) Used Tires 195/65/R15', 'Tires', '195/65/R15', 'used', 16.00, 25.00, 5),
      ('(DEMO) Brake Fluid 250ML', 'Fluids', null, null, 0.625, 1.00, 24),
      ('(DEMO) Tubeless Glue', 'Accessories', null, null, 0.175, 0.50, 2)
    ) as x(name, category, tyre_size, condition, cost, price, qty)
  loop
    insert into public.products (business_id, name, category, tyre_size, condition, cost_usd, sell_price_usd, low_stock_threshold)
    values (v_bid, r.name, r.category, r.tyre_size, r.condition, r.cost, r.price, 3) returning id into v_p;
    perform public._move_stock(v_bid, v_p, r.qty, 'opening', null, null, r.cost, 'DEMO opening stock');
  end loop;
end $$;

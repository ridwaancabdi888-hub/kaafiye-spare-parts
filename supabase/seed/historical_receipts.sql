-- OPTIONAL. Records the two known purchase receipts for the Kaafiye business and creates the
-- matching products with ZERO stock and NO selling price.
--
-- These are historical purchases, NOT confirmed current stock. After running this, the admin
-- must enter the CURRENT on-hand count per product (Inventory → product → Stock change →
-- "Opening count") and the real selling price. Nothing here is a sale or a transaction.
--
-- Run in the Supabase SQL editor AFTER the business exists. Set the slug below.
do $$
declare
  v_slug text := 'kaafiye';              -- ← business short code
  v_bid uuid;
  v_p uuid;
  r record;
begin
  select id into v_bid from public.businesses where slug = v_slug;
  if v_bid is null then raise exception 'Business % not found — create it first', v_slug; end if;
  if exists (select 1 from public.purchases where business_id = v_bid and supplier in ('Geelle Trading', 'Tawakal Auto Spare Parts')) then
    raise notice 'Receipts already recorded — nothing to do';
    return;
  end if;

  -- Geelle Trading: items $68.50, $0.50 discount → $68.00 paid. Date not supplied.
  insert into public.purchases (business_id, supplier, purchased_on, currency, discount, total, note)
  values (v_bid, 'Geelle Trading', null, 'USD', 0.50, 68.00, 'Historical receipt — date not supplied. Not proof of current stock.')
  returning id into v_p;
  insert into public.purchase_items (purchase_id, business_id, description, quantity, line_total) values
    (v_p, v_bid, 'Brake Fluid 250ML', 24, 15.00),
    (v_p, v_bid, 'Waal Tubeless (tubeless valve)', 100, 20.00),
    (v_p, v_bid, 'Xabag Tubeless (tubeless glue)', 20, 3.50),
    (v_p, v_bid, 'Puncture Proof', 24, 30.00);

  -- Tawakal Auto Spare Parts, 2 Nov 2026: $155.00.
  insert into public.purchases (business_id, supplier, purchased_on, currency, discount, total, note)
  values (v_bid, 'Tawakal Auto Spare Parts', date '2026-11-02', 'USD', 0, 155.00, 'Historical receipt. Not proof of current stock.')
  returning id into v_p;
  insert into public.purchase_items (purchase_id, business_id, description, quantity, line_total) values
    (v_p, v_bid, 'Used Tires 195/65/R15', 5, 80.00),
    (v_p, v_bid, 'Used Tires 175/65/R14', 5, 75.00);

  -- Products: cost = receipt unit cost (before the $0.50 invoice discount), stock 0, price unset.
  for r in select * from (values
      ('Brake Fluid 250ML', 'Fluids', null::text, null::text, 0.625, 'Geelle Trading'),
      ('Waal Tubeless', 'Accessories', null, null, 0.20, 'Geelle Trading'),
      ('Xabag Tubeless (Tubeless Glue)', 'Accessories', null, null, 0.175, 'Geelle Trading'),
      ('Puncture Proof', 'Accessories', null, null, 1.25, 'Geelle Trading'),
      ('Used Tires 195/65/R15', 'Tires', '195/65/R15', 'used', 16.00, 'Tawakal Auto Spare Parts'),
      ('Used Tires 175/65/R14', 'Tires', '175/65/R14', 'used', 15.00, 'Tawakal Auto Spare Parts')
    ) as x(name, category, tyre_size, condition, cost, supplier)
  loop
    if not exists (select 1 from public.products where business_id = v_bid and name = r.name) then
      insert into public.products (business_id, name, category, tyre_size, condition, cost_usd, supplier, low_stock_threshold)
      values (v_bid, r.name, r.category, r.tyre_size, r.condition, r.cost, r.supplier, 3);
    end if;
  end loop;

  -- Link receipt lines to products for reference.
  update public.purchase_items pi set product_id = p.id
  from public.products p
  where pi.business_id = v_bid and p.business_id = v_bid and pi.product_id is null
    and split_part(pi.description, ' (', 1) = split_part(p.name, ' (', 1);
end $$;

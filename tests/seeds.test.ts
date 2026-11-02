import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDb } from "./db-harness";

const seed = (f: string) => readFileSync(join(__dirname, "..", "supabase", "seed", f), "utf8");

describe("seed scripts", () => {
  it("historical receipts: $223 / 178 items recorded, but no stock and no prices invented", async () => {
    const db = await createDb();
    await db.exec("insert into businesses (name, slug) values ('Kaafiye', 'kaafiye')");
    await db.exec(seed("historical_receipts.sql"));
    await db.exec(seed("historical_receipts.sql")); // idempotent

    const totals = await db.query<{ paid: string; items: string; lines: string }>(
      "select (select sum(total) from purchases) as paid, (select sum(quantity) from purchase_items) as items, (select sum(line_total) from purchase_items) as lines");
    expect(Number(totals.rows[0].paid)).toBe(223);
    expect(Number(totals.rows[0].items)).toBe(178);
    expect(Number(totals.rows[0].lines)).toBe(223.5); // before the $0.50 Geelle discount

    const products = await db.query<{ stock_qty: number; sell_price_usd: string | null }>("select stock_qty, sell_price_usd from products");
    expect(products.rows).toHaveLength(6);
    expect(products.rows.every((p) => p.stock_qty === 0 && p.sell_price_usd === null)).toBe(true);
    const unlinked = await db.query("select * from purchase_items where product_id is null");
    expect(unlinked.rows).toHaveLength(0);
    const tx = await db.query("select (select count(*) from sales) + (select count(*) from stock_movements) as n");
    expect(Number((tx.rows[0] as { n: string }).n)).toBe(0);
  });

  it("demo business is labelled and has stock via the ledger", async () => {
    const db = await createDb();
    await db.exec(seed("demo_business.sql"));
    const p = await db.query<{ name: string; stock_qty: number }>("select name, stock_qty from products order by name");
    expect(p.rows.every((r) => r.name.startsWith("(DEMO)"))).toBe(true);
    const mv = await db.query("select * from stock_movements");
    expect(mv.rows).toHaveLength(3);
  });
});

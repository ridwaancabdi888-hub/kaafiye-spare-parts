import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createAuthUser, createDb, type Db } from "./db-harness";

let db: Db;
let superId: string;
let bizA: string;
let bizB: string;
let adminA: string;
let userA1: string;
let userA2: string;
let adminB: string;
let productA: string; // 24 pcs, cost $0.625
let productB: string;

const one = async <T>(p: Promise<{ rows: T[] }>) => (await p).rows[0];

async function stockOf(id: string) {
  const r = await db.query<{ stock_qty: number }>("select stock_qty from products where id = $1", [id]);
  return r.rows[0].stock_qty;
}

/** Superuser-only test helper: pretend a record was created `hours` ago. */
async function age(table: string, id: string, hours: number) {
  const trg = table === "banjarka_records" ? "banjarka_freeze" : `${table}_freeze`;
  await db.exec(`alter table ${table} disable trigger ${trg}`);
  await db.query(`update ${table} set created_at = now() - $2::float8 * interval '1 hour' where id = $1`, [id, hours]);
  await db.exec(`alter table ${table} enable trigger ${trg}`);
}

async function addMember(userId: string, businessId: string, role: "admin" | "user", name: string) {
  await db.query("insert into memberships (business_id, user_id, role, full_name) values ($1, $2, $3, $4)", [
    businessId, userId, role, name,
  ]);
}

beforeAll(async () => {
  db = await createDb();
  superId = await createAuthUser(db, "super@test");
  await db.query("insert into super_admins (user_id) values ($1)", [superId]);
  bizA = (await asUser(db, superId, (q) => one(q<{ id: string }>("select create_business('Kaafiye', 'kaafiye') as id")))).id;
  bizB = (await asUser(db, superId, (q) => one(q<{ id: string }>("select create_business('Other', 'other') as id")))).id;

  adminA = await createAuthUser(db, "admin@a");
  userA1 = await createAuthUser(db, "u1@a");
  userA2 = await createAuthUser(db, "u2@a");
  adminB = await createAuthUser(db, "admin@b");
  await addMember(adminA, bizA, "admin", "Admin A");
  await addMember(userA1, bizA, "user", "User 01");
  await addMember(userA2, bizA, "user", "User 02");
  await addMember(adminB, bizB, "admin", "Admin B");

  productA = await asUser(db, adminA, async (q) => {
    const p = await one(q<{ id: string }>(
      "insert into products (business_id, name, cost_usd, stock_qty) values ($1, 'Brake Fluid 250ML', 0.625, 999) returning id",
      [bizA],
    ));
    await q("select adjust_stock($1, 24, 'opening', 'count')", [p.id]);
    return p.id;
  });
  productB = await asUser(db, adminB, async (q) => {
    const p = await one(q<{ id: string }>("insert into products (business_id, name, cost_usd) values ($1, 'B item', 1) returning id", [bizB]));
    await q("select adjust_stock($1, 10, 'opening', null)", [p.id]);
    return p.id;
  });
});

describe("setup + inventory guards", () => {
  it("new business gets the 11,800 example rate flagged as example", async () => {
    const r = await db.query<{ slsh_per_usd: string; is_example: boolean }>("select * from fx_rates where business_id = $1", [bizA]);
    expect(Number(r.rows[0].slsh_per_usd)).toBe(11800);
    expect(r.rows[0].is_example).toBe(true);
  });

  it("product insert ignores client stock; stock only via ledger", async () => {
    expect(await stockOf(productA)).toBe(24);
    await expect(
      asUser(db, adminA, (q) => q("update products set stock_qty = 500 where id = $1", [productA])),
    ).rejects.toThrow(/STOCK_CHANGE_VIA_RPC_ONLY/);
  });

  it("regular users cannot create products or adjust stock", async () => {
    await expect(
      asUser(db, userA1, (q) => q("insert into products (business_id, name) values ($1, 'x')", [bizA])),
    ).rejects.toThrow(/row-level security/);
    await expect(asUser(db, userA1, (q) => q("select adjust_stock($1, 5, 'purchase', null)", [productA]))).rejects.toThrow(/ADMIN_ONLY/);
  });

  it("purchase re-weights average cost", async () => {
    const p = await asUser(db, adminA, async (q) => {
      const r = await one(q<{ id: string }>("insert into products (business_id, name, cost_usd) values ($1, 'Avg', 10) returning id", [bizA]));
      await q("select adjust_stock($1, 10, 'opening', null, 10)", [r.id]);
      await q("select adjust_stock($1, 10, 'purchase', null, 20)", [r.id]);
      return r.id;
    });
    const r = await db.query<{ cost_usd: string; stock_qty: number }>("select cost_usd, stock_qty from products where id = $1", [p]);
    expect(Number(r.rows[0].cost_usd)).toBe(15);
    expect(r.rows[0].stock_qty).toBe(20);
  });
});

describe("tenant isolation", () => {
  it("users cannot see or sell another business's products", async () => {
    const rows = await asUser(db, userA1, (q) => q("select id from products where id = $1", [productB]));
    expect(rows.rows).toHaveLength(0);
    await expect(
      asUser(db, userA1, (q) => q("select record_sale($1, 1, 5, 'USD')", [productB])),
    ).rejects.toThrow(/PRODUCT_NOT_FOUND/);
    expect(await stockOf(productB)).toBe(10);
  });

  it("users cannot write financial tables directly", async () => {
    await expect(
      asUser(db, userA1, (q) =>
        q(`insert into sales (business_id, product_id, quantity, unit_price, currency, total, fx_slsh_per_usd,
           total_usd, unit_cost_usd, cost_usd, profit_usd, created_by) values ($1,$2,1,1,'USD',1,1,1,1,1,0,$3)`,
          [bizA, productA, userA1])),
    ).rejects.toThrow(/permission denied/);
  });

  it("internal SECURITY DEFINER helpers are not callable by API users", async () => {
    await expect(
      asUser(db, adminA, (q) => q("select _move_stock($1, $2, 100, 'opening', null, null, 0, null)", [bizA, productA])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, adminA, (q) => q(`select _log_revision($1, 'sales', $2, 'create', null, null, '{}'::jsonb)`, [bizA, productA])),
    ).rejects.toThrow(/permission denied/);
  });

  it("users cannot promote themselves or create memberships", async () => {
    await expect(asUser(db, userA1, (q) => q("update memberships set role = 'admin' where user_id = $1", [userA1]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, userA1, (q) => q("insert into super_admins (user_id) values ($1)", [userA1]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, adminA, (q) => q("select create_business('X', 'xx')"))).rejects.toThrow(/SUPER_ADMIN_ONLY/);
  });

  it("anon has no access", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.query("set local role anon");
        await tx.query("select * from products");
      }),
    ).rejects.toThrow(/permission denied/);
  });

  it("storage policies scope images to the business folder", async () => {
    await asUser(db, adminA, (q) =>
      q("insert into storage.objects (bucket_id, name) values ('product-images', $1)", [`${bizA}/${productA}/a.jpg`]));
    await expect(
      asUser(db, adminA, (q) => q("insert into storage.objects (bucket_id, name) values ('product-images', $1)", [`${bizB}/x/a.jpg`])),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(db, userA1, (q) => q("insert into storage.objects (bucket_id, name) values ('product-images', $1)", [`${bizA}/x/b.jpg`])),
    ).rejects.toThrow(/row-level security/);
    const seenByB = await asUser(db, adminB, (q) => q("select * from storage.objects"));
    expect(seenByB.rows).toHaveLength(0);
    const seenByUser = await asUser(db, userA1, (q) => q("select * from storage.objects"));
    expect(seenByUser.rows).toHaveLength(1);
  });
});

describe("spare parts sales", () => {
  it("sale decrements stock atomically and snapshots cost + fx", async () => {
    const before = await stockOf(productA);
    const id = await asUser(db, userA1, async (q) => (await one(q<{ id: string }>("select record_sale($1, 2, 1.00, 'USD') as id", [productA]))).id);
    expect(await stockOf(productA)).toBe(before - 2);
    const s = await db.query<Record<string, string>>("select * from sales where id = $1", [id]);
    expect(Number(s.rows[0].total_usd)).toBe(2);
    expect(Number(s.rows[0].cost_usd)).toBe(1.25);
    expect(Number(s.rows[0].profit_usd)).toBe(0.75);
    expect(Number(s.rows[0].fx_slsh_per_usd)).toBe(11800);
    const mv = await db.query("select * from stock_movements where ref_id = $1", [id]);
    expect(mv.rows).toHaveLength(1);
  });

  it("SLSH sale converts with the snapshot rate", async () => {
    const id = await asUser(db, userA1, async (q) => (await one(q<{ id: string }>("select record_sale($1, 1, 11800, 'SLSH') as id", [productA]))).id);
    const s = await db.query<Record<string, string>>("select total, currency, total_usd from sales where id = $1", [id]);
    expect(s.rows[0].currency).toBe("SLSH");
    expect(Number(s.rows[0].total)).toBe(11800);
    expect(Number(s.rows[0].total_usd)).toBe(1);
  });

  it("rejects insufficient stock and leaves stock untouched", async () => {
    const before = await stockOf(productA);
    await expect(
      asUser(db, userA1, (q) => q("select record_sale($1, $2, 1, 'USD')", [productA, before + 1])),
    ).rejects.toThrow(/INSUFFICIENT_STOCK/);
    expect(await stockOf(productA)).toBe(before);
  });

  it("users see coworkers' sales read-only", async () => {
    const rows = await asUser(db, userA2, (q) => q("select id from sales"));
    expect(rows.rows.length).toBeGreaterThan(0);
    const upd = await asUser(db, userA2, (q) => q("select id from sales limit 1").then(async (r) => {
      try {
        await q("update sales set total = 0 where id = $1", [(r.rows[0] as { id: string }).id]);
        return "updated";
      } catch (e) {
        return String(e);
      }
    }));
    expect(upd).toMatch(/permission denied/);
  });
});

describe("5h edit window + audit", () => {
  let saleId: string;

  beforeAll(async () => {
    saleId = await asUser(db, userA1, async (q) => (await one(q<{ id: string }>("select record_sale($1, 3, 1.00, 'USD') as id", [productA]))).id);
  });

  it("author can edit within 5h; stock difference applied; revision has changed fields", async () => {
    const before = await stockOf(productA);
    await asUser(db, userA1, (q) => q("select update_sale($1, 1, 1.00, 'USD', null, 'typo')", [saleId]));
    expect(await stockOf(productA)).toBe(before + 2);
    const rev = await db.query<{ action: string; changed_fields: string[]; before: { quantity: number }; after: { quantity: number } }>(
      "select * from record_revisions where record_id = $1 order by id", [saleId]);
    expect(rev.rows.map((r) => r.action)).toEqual(["create", "edit"]);
    expect(rev.rows[1].changed_fields).toEqual(expect.arrayContaining(["quantity", "total", "total_usd"]));
    expect(rev.rows[1].before.quantity).toBe(3);
    expect(rev.rows[1].after.quantity).toBe(1);
  });

  it("edit increasing quantity beyond stock is rejected atomically", async () => {
    const stock = await stockOf(productA);
    await expect(
      asUser(db, userA1, (q) => q("select update_sale($1, $2, 1.00, 'USD')", [saleId, stock + 5])),
    ).rejects.toThrow(/INSUFFICIENT_STOCK/);
    expect(await stockOf(productA)).toBe(stock);
  });

  it("other users cannot edit", async () => {
    await expect(asUser(db, userA2, (q) => q("select update_sale($1, 2, 1, 'USD')", [saleId]))).rejects.toThrow(/NOT_AUTHOR/);
  });

  it("no-op edit is rejected", async () => {
    await expect(asUser(db, userA1, (q) => q("select update_sale($1, 1, 1.00, 'USD')", [saleId]))).rejects.toThrow(/NO_CHANGES/);
  });

  it("window is measured from original created_at and never resets", async () => {
    await age("sales", saleId, 4.9);
    await asUser(db, userA1, (q) => q("select update_sale($1, 2, 1.00, 'USD')", [saleId]));
    const s = await db.query<{ created_at: Date; updated_at: Date }>("select created_at, updated_at from sales where id = $1", [saleId]);
    expect(Date.now() - new Date(s.rows[0].created_at).getTime()).toBeGreaterThan(4.8 * 3600_000);
    await age("sales", saleId, 5.01);
    await expect(asUser(db, userA1, (q) => q("select update_sale($1, 1, 1.00, 'USD')", [saleId]))).rejects.toThrow(/EDIT_WINDOW_CLOSED/);
    await expect(asUser(db, userA1, (q) => q("select void_sale($1, 'mistake')", [saleId]))).rejects.toThrow(/EDIT_WINDOW_CLOSED/);
  });

  it("admin correction after 5h requires a reason and is audited", async () => {
    await expect(asUser(db, adminA, (q) => q("select update_sale($1, 1, 1.00, 'USD')", [saleId]))).rejects.toThrow(/REASON_REQUIRED/);
    await asUser(db, adminA, (q) => q("select update_sale($1, 1, 1.00, 'USD', null, 'customer returned one')", [saleId]));
    const rev = await db.query<{ action: string; actor: string; reason: string }>(
      "select action, actor, reason from record_revisions where record_id = $1 order by id desc limit 1", [saleId]);
    expect(rev.rows[0]).toMatchObject({ action: "correction", actor: adminA, reason: "customer returned one" });
  });

  it("void restores stock; history cannot be erased", async () => {
    const before = await stockOf(productA);
    await asUser(db, adminA, (q) => q("select void_sale($1, 'duplicate entry')", [saleId]));
    expect(await stockOf(productA)).toBe(before + 1);
    await expect(asUser(db, adminA, (q) => q("select void_sale($1, 'again')", [saleId]))).rejects.toThrow(/RECORD_VOIDED/);
    await expect(db.query("delete from record_revisions where record_id = $1", [saleId])).rejects.toThrow(/APPEND_ONLY/);
    await expect(db.query("delete from sales where id = $1", [saleId])).rejects.toThrow(/APPEND_ONLY/);
    await expect(db.query("update stock_movements set qty_change = 1")).rejects.toThrow(/APPEND_ONLY/);
  });

  it("created_at cannot be rewritten even by a direct superuser update", async () => {
    const before = await db.query<{ created_at: Date }>("select created_at from sales where id = $1", [saleId]);
    await db.query("update sales set created_at = now() where id = $1", [saleId]);
    const after = await db.query<{ created_at: Date }>("select created_at from sales where id = $1", [saleId]);
    expect(after.rows[0].created_at).toEqual(before.rows[0].created_at);
  });
});

describe("expenses", () => {
  it("cash expense requires reason and converts SLSH", async () => {
    await expect(asUser(db, userA1, (q) => q("select record_cash_expense(5, 'USD', '')"))).rejects.toThrow(/REASON_REQUIRED/);
    const id = await asUser(db, userA1, async (q) => (await one(q<{ id: string }>("select record_cash_expense(23600, 'SLSH', 'Biyo / water') as id"))).id);
    const e = await db.query<{ amount_usd: string }>("select amount_usd from expenses where id = $1", [id]);
    expect(Number(e.rows[0].amount_usd)).toBe(2);
  });

  it("item expense decrements stock at cost; edits apply stock difference; void restores", async () => {
    const before = await stockOf(productA);
    const id = await asUser(db, userA1, async (q) => (await one(q<{ id: string }>("select record_item_expense($1, 2, 'Dhaawac / damaged') as id", [productA]))).id);
    expect(await stockOf(productA)).toBe(before - 2);
    let e = await db.query<{ amount_usd: string }>("select amount_usd from expenses where id = $1", [id]);
    expect(Number(e.rows[0].amount_usd)).toBe(1.25);
    await asUser(db, userA1, (q) => q("select update_expense($1, null, null, 1, 'Dhaawac / damaged', 'only one')", [id]));
    expect(await stockOf(productA)).toBe(before - 1);
    e = await db.query<{ amount_usd: string }>("select amount_usd from expenses where id = $1", [id]);
    expect(Number(e.rows[0].amount_usd)).toBe(0.625);
    await asUser(db, userA1, (q) => q("select void_expense($1, 'wrong item')", [id]));
    expect(await stockOf(productA)).toBe(before);
  });

  it("item expense cannot drive stock negative", async () => {
    const stock = await stockOf(productA);
    await expect(
      asUser(db, userA1, (q) => q("select record_item_expense($1, $2, 'lost items')", [productA, stock + 1])),
    ).rejects.toThrow(/INSUFFICIENT_STOCK/);
  });

  it("users only see their own expenses", async () => {
    const rows = await asUser(db, userA2, (q) => q("select id from expenses"));
    expect(rows.rows).toHaveLength(0);
  });
});

describe("banjarka 50/50", () => {
  it("splits net 50/50 and stores snapshots", async () => {
    const id = await asUser(db, userA1, async (q) =>
      (await one(q<{ id: string }>("select record_banjarka(40, 6, 'USD', 'Kharashka shaqada') as id"))).id);
    const b = await db.query<Record<string, string>>("select * from banjarka_records where id = $1", [id]);
    expect(Number(b.rows[0].net)).toBe(34);
    expect(Number(b.rows[0].worker_share)).toBe(17);
    expect(Number(b.rows[0].shop_share)).toBe(17);
    expect(Number(b.rows[0].fx_slsh_per_usd)).toBe(11800);
  });

  it("odd cents: shares always sum to net", async () => {
    const id = await asUser(db, userA2, async (q) => (await one(q<{ id: string }>("select record_banjarka(10.01, 0, 'USD') as id"))).id);
    const b = await db.query<Record<string, string>>("select net, worker_share, shop_share from banjarka_records where id = $1", [id]);
    expect(Number(b.rows[0].worker_share) + Number(b.rows[0].shop_share)).toBeCloseTo(Number(b.rows[0].net), 10);
  });

  it("one record per worker per day", async () => {
    await expect(asUser(db, userA1, (q) => q("select record_banjarka(10, 0, 'USD')"))).rejects.toThrow(/DUPLICATE_BANJARKA_DAY/);
  });

  it("expenses greater than gross are rejected (no payout calculated)", async () => {
    await expect(
      asUser(db, adminA, (q) => q("select record_banjarka(5, 6, 'USD', 'too much')")),
    ).rejects.toThrow(/EXPENSES_EXCEED_GROSS/);
    const rows = await db.query("select * from banjarka_records where created_by = $1", [adminA]);
    expect(rows.rows).toHaveLength(0);
  });

  it("expense without reason rejected", async () => {
    await expect(asUser(db, adminA, (q) => q("select record_banjarka(50, 5, 'USD', '')"))).rejects.toThrow(/REASON_REQUIRED/);
  });

  it("SLSH banjarka converts to USD", async () => {
    const id = await asUser(db, adminA, async (q) =>
      (await one(q<{ id: string }>("select record_banjarka(472000, 0, 'SLSH') as id"))).id);
    const b = await db.query<Record<string, string>>("select net_usd, worker_share_usd, worker_share from banjarka_records where id = $1", [id]);
    expect(Number(b.rows[0].net_usd)).toBe(40);
    expect(Number(b.rows[0].worker_share_usd)).toBe(20);
    expect(Number(b.rows[0].worker_share)).toBe(236000);
  });

  it("coworker banjarka hidden unless setting enabled", async () => {
    let rows = await asUser(db, userA2, (q) => q("select created_by from banjarka_records"));
    expect(rows.rows.every((r) => (r as { created_by: string }).created_by === userA2)).toBe(true);
    await asUser(db, adminA, (q) => q("update business_settings set users_see_all_banjarka = true where business_id = $1", [bizA]));
    rows = await asUser(db, userA2, (q) => q("select created_by from banjarka_records"));
    expect(rows.rows.length).toBeGreaterThan(1);
  });
});

describe("accounts: usernames, audit log, login throttling", () => {
  const asService = <T>(fn: (q: Db["query"]) => Promise<T>) =>
    db.transaction(async (tx) => {
      await tx.query("set local role service_role");
      return fn(tx.query.bind(tx) as Db["query"]);
    });

  it("usernames are unique and well-formed", async () => {
    await db.query("update memberships set username = 'kaafiye01' where user_id = $1", [userA1]);
    await expect(db.query("update memberships set username = 'kaafiye01' where user_id = $1", [userA2])).rejects.toThrow(/memberships_username_key/);
    await expect(db.query("update memberships set username = 'Bad Name!' where user_id = $1", [userA2])).rejects.toThrow(/memberships_username_format/);
    const r = await db.query<{ must_change_password: boolean }>("select must_change_password from memberships where user_id = $1", [userA1]);
    expect(r.rows[0].must_change_password).toBe(false);
  });

  it("account events: append-only, tenant-scoped, never writable by API users", async () => {
    await db.query("insert into account_events (business_id, target_user, actor, event) values ($1, $2, $3, 'password_reset')", [bizA, userA1, adminA]);
    await expect(db.query("update account_events set event = 'enabled'")).rejects.toThrow(/APPEND_ONLY/);
    await expect(db.query("delete from account_events")).rejects.toThrow(/APPEND_ONLY/);
    await expect(
      asUser(db, adminA, (q) => q("insert into account_events (business_id, event) values ($1, 'enabled')", [bizA])),
    ).rejects.toThrow(/permission denied/);
    expect((await asUser(db, adminA, (q) => q("select * from account_events"))).rows).toHaveLength(1);
    expect((await asUser(db, adminB, (q) => q("select * from account_events"))).rows).toHaveLength(0);
    expect((await asUser(db, userA1, (q) => q("select * from account_events"))).rows).toHaveLength(0);
  });

  it("login throttling is server-only and locks after repeated failures", async () => {
    await expect(asUser(db, userA1, (q) => q("select * from login_attempts"))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, userA1, (q) => q("select login_wait_seconds(array['k'], array[5])"))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, userA1, (q) => q("select login_record('k', 'ip', true)"))).rejects.toThrow(/permission denied/);

    const wait = async () =>
      asService(async (q) => (await q<{ w: number }>("select login_wait_seconds(array['user-x', 'ip-x'], array[5, 30]) as w")).rows[0].w);
    for (let i = 0; i < 4; i++) await asService((q) => q("select login_record('user-x', 'ip-x', false)"));
    expect(await wait()).toBe(0);
    await asService((q) => q("select login_record('user-x', 'ip-x', false)"));
    const w = await wait();
    expect(w).toBeGreaterThan(800);
    expect(w).toBeLessThanOrEqual(900);
    await asService((q) => q("select login_record('user-x', 'ip-x', true)"));
    expect(await wait()).toBe(0); // success clears the account's failure streak
  });
});

describe("fx + reports", () => {
  it("only admins set rates; new rate does not change old records", async () => {
    await expect(asUser(db, userA1, (q) => q("select set_fx_rate(12000)"))).rejects.toThrow(/ADMIN_ONLY/);
    await asUser(db, adminA, (q) => q("select set_fx_rate(12000, 'market check')"));
    const old = await db.query<{ fx_slsh_per_usd: string }>("select fx_slsh_per_usd from sales where business_id = $1 order by created_at limit 1", [bizA]);
    expect(Number(old.rows[0].fx_slsh_per_usd)).toBe(11800);
    const id = await asUser(db, userA1, async (q) => (await one(q<{ id: string }>("select record_cash_expense(12000, 'SLSH', 'test rate') as id"))).id);
    const e = await db.query<{ amount_usd: string }>("select amount_usd from expenses where id = $1", [id]);
    expect(Number(e.rows[0].amount_usd)).toBe(1);
  });

  it("report separates categories and never mixes currencies", async () => {
    const r = await asUser(db, adminA, async (q) => (await one(q<{ r: Record<string, unknown> }>("select report_summary() as r"))).r);
    expect(r.sales_by_currency).toHaveProperty("USD");
    expect(r.sales_by_currency).toHaveProperty("SLSH");
    expect(Number(r.gross_profit_usd)).toBeCloseTo(Number(r.sales_usd) - Number(r.cogs_usd), 2);
    expect(Number(r.banjarka_worker_usd) + Number(r.banjarka_shop_usd)).toBeCloseTo(Number(r.banjarka_net_usd), 2);
    await expect(asUser(db, userA1, (q) => q("select report_summary()"))).rejects.toThrow(/ADMIN_ONLY/);
  });

  it("disabled users lose access", async () => {
    await db.query("update memberships set active = false where user_id = $1", [userA2]);
    await expect(asUser(db, userA2, (q) => q("select record_sale($1, 1, 1, 'USD')", [productA]))).rejects.toThrow(/NOT_A_MEMBER/);
    const rows = await asUser(db, userA2, (q) => q("select id from products"));
    expect(rows.rows).toHaveLength(0);
    await db.query("update memberships set active = true where user_id = $1", [userA2]);
  });
});

describe("display currency, performance, rewards, archive", () => {
  let bizC: string;
  let adminC: string;
  let workerC: string;
  let productC: string;
  const report = (uid: string) => asUser(db, uid, async (q) => (await one(q<{ r: Record<string, number> }>("select report_summary() as r"))).r);
  const perf = async (uid: string) =>
    (await asUser(db, uid, async (q) => (await one(q<{ r: Record<string, number | string>[] }>("select staff_performance() as r"))).r));

  beforeAll(async () => {
    bizC = (await asUser(db, superId, (q) => one(q<{ id: string }>("select create_business('Perf', 'perf') as id")))).id;
    adminC = await createAuthUser(db, "admin@c");
    workerC = await createAuthUser(db, "w@c");
    await addMember(adminC, bizC, "admin", "Admin C");
    await addMember(workerC, bizC, "user", "Worker C");
    productC = await asUser(db, adminC, async (q) => {
      const p = await one(q<{ id: string }>("insert into products (business_id, name, cost_usd) values ($1, 'Taayir', 5) returning id", [bizC]));
      await q("select adjust_stock($1, 20, 'opening', null)", [p.id]);
      return p.id;
    });
  });

  it("80,000 SlSh at 11,800 stays 80,000 SlSh / $6.78 after the rate changes", async () => {
    await asUser(db, workerC, (q) => q("select record_sale($1, 1, 80000, 'SLSH')", [productC]));
    await asUser(db, adminC, (q) => q("select set_fx_rate(11000)"));
    await asUser(db, workerC, (q) => q("select record_sale($1, 1, 10, 'USD')", [productC]));
    const r = await report(adminC);
    expect(Number(r.sales_slsh)).toBe(80000 + 110000);
    expect(Number(r.sales_usd)).toBeCloseTo(6.78 + 10, 2);
    expect(r.sales_by_currency).toEqual({ SLSH: 80000, USD: 10 });
    // COGS uses each sale's own snapshot: $5 × 11,800 + $5 × 11,000.
    expect(Number(r.cogs_slsh)).toBe(59000 + 55000);
    expect(Number(r.gross_profit_slsh)).toBe(190000 - 114000);
  });

  it("performance: per employee, voided excluded, edits counted once, banjarka split", async () => {
    const tmp = await asUser(db, workerC, async (q) => (await one(q<{ id: string }>("select record_sale($1, 2, 10, 'USD') as id", [productC]))).id);
    await asUser(db, workerC, (q) => q("select update_sale($1, 1, 10, 'USD')", [tmp]));
    const gone = await asUser(db, workerC, async (q) => (await one(q<{ id: string }>("select record_sale($1, 1, 99, 'USD') as id", [productC]))).id);
    await asUser(db, workerC, (q) => q("select void_sale($1, 'wrong entry')", [gone]));
    await asUser(db, workerC, (q) => q("select record_banjarka(110000, 22000, 'SLSH', 'Kharash shaqo')"));
    const w = (await perf(adminC)).find((x) => x.user_id === workerC)!;
    expect(w.sales_count).toBe(3);
    expect(Number(w.sales_usd)).toBeCloseTo(6.78 + 10 + 10, 2);
    expect(Number(w.sales_slsh)).toBe(80000 + 110000 + 110000);
    expect(Number(w.bj_gross_slsh)).toBe(110000);
    expect(Number(w.bj_net_slsh)).toBe(88000);
    expect(Number(w.bj_worker_slsh)).toBe(44000);
    expect(Number(w.bj_shop_slsh)).toBe(44000);
    expect(Number(w.bj_shop_usd)).toBe(4);
    expect(Number(w.business_usd)).toBeCloseTo(Number(w.sales_usd) + 4, 2);
    expect(Number(w.business_slsh)).toBe(300000 + 44000);
  });

  it("performance is admin-only and tenant-scoped", async () => {
    await expect(perf(workerC)).rejects.toThrow(/ADMIN_ONLY/);
    const ids = (await perf(adminA)).map((x) => x.user_id);
    expect(ids).not.toContain(workerC);
    expect(ids).toContain(userA1);
  });

  it("rewards: admin-only, same business, snapshot rate, audited, void needs a reason", async () => {
    const id = await asUser(db, adminC, async (q) =>
      (await one(q<{ id: string }>("select record_reward($1, 22000, 'SLSH', current_date, 'Top seller') as id", [workerC]))).id);
    const rw = await db.query<Record<string, string>>("select * from employee_rewards where id = $1", [id]);
    expect(Number(rw.rows[0].amount)).toBe(22000);
    expect(Number(rw.rows[0].amount_usd)).toBe(2);
    await expect(asUser(db, workerC, (q) => q("select record_reward($1, 5, 'USD', current_date, 'self')", [workerC]))).rejects.toThrow(/ADMIN_ONLY/);
    await expect(asUser(db, adminA, (q) => q("select record_reward($1, 5, 'USD', current_date, 'other biz')", [workerC]))).rejects.toThrow(/RECORD_NOT_FOUND/);
    await expect(asUser(db, adminC, (q) => q("select void_reward($1, '')", [id]))).rejects.toThrow(/REASON_REQUIRED/);
    await asUser(db, adminC, (q) => q("select void_reward($1, 'entered twice')", [id]));
    await expect(db.query("delete from employee_rewards where id = $1", [id])).rejects.toThrow(/APPEND_ONLY/);
    const ev = await db.query<{ event: string }>("select event from account_events where business_id = $1 order by id", [bizC]);
    expect(ev.rows.map((e) => e.event)).toEqual(["reward_recorded", "reward_voided"]);
    expect(await asUser(db, adminA, (q) => q("select id from employee_rewards"))).toHaveProperty("rows.length", 0);
  });

  it("archived employees lose access, cannot be active while archived, and keep history", async () => {
    await db.query("update memberships set active = false, archived_at = now() where user_id = $1", [workerC]);
    await expect(db.query("update memberships set active = true where user_id = $1", [workerC])).rejects.toThrow(/memberships_archived_inactive/);
    await expect(asUser(db, workerC, (q) => q("select record_sale($1, 1, 1, 'USD')", [productC]))).rejects.toThrow(/NOT_A_MEMBER/);
    const w = (await perf(adminC)).find((x) => x.user_id === workerC)!;
    expect(w.archived).toBe(true);
    expect(w.sales_count).toBe(3);
    expect(Number((await report(adminC)).sales_slsh)).toBe(300000);
  });
});

# Kaafiye Spare Parts

Multi-business inventory, simple POS and Banjarka (tyre-repair) records for a small Somaliland shop.
Next.js 15 (App Router) · TypeScript · Tailwind 4 · Supabase (Postgres, Auth, Storage) · installable PWA.
Somali by default, English toggle (remembered in a cookie).

## Status (3 Nov 2026)

| Item | State |
|---|---|
| Production | ✅ https://kaafiye-spare-parts.vercel.app (Vercel, auto-deploys from `main`) |
| Database | ✅ Supabase project `kjmhgnntiuvgshbgxodm`; migrations 0001–0003 applied, RLS on every table |
| Auth | ✅ Public signup disabled; staff log in with **username + password** |
| Kaafiye inventory | ✅ Owner-approved baseline imported: 10 products, 233 units, $575 retail (`supabase/seed/kaafiye_initial_inventory.sql`) |
| Tests | `npm test` — SQL rules run in real Postgres (PGlite) + unit tests |
| Live FX feed | ❌ None — no verified source exists for the Somaliland Shilling market rate. The rate is **admin-managed with history and a stale warning**. 11,800 is seeded only as a flagged *example*. |

## Accounts and sign-in

- Staff sign in with a **username** (e.g. `kaafiye01`) and password. The server maps the username to the
  Supabase Auth account; e-mails are never sent to the browser and every failure shows the same message.
- **Throttling:** 5 failed attempts per account or 30 per IP within 15 minutes → wait 15 minutes.
- **Passwords:** at least 8 characters; very common / sequential passwords and passwords containing the
  username are refused. No forced symbol rules.
- **Admins** create staff (username + temporary password), reset passwords without the old one, set
  usernames and disable/enable accounts. The **Super Admin** does the same for business admins.
  Temporary passwords must be changed at the next sign-in. Every action is written to `account_events`
  (append-only, never the password).
- Accounts created earlier with an e-mail can keep using it, or get a username via **Staff → Set username**.

## What is enforced where

All money and stock rules live **in Postgres** (`supabase/migrations/`), not only in the UI:

- **Tenancy:** every table has RLS; a user belongs to one business via `memberships` (roles are stored there, never in user-editable metadata). Super admins are in `super_admins`.
- **Writes only via RPCs:** clients can't `insert/update/delete` sales, expenses, Banjarka records, revisions or ledgers. RPCs are `SECURITY DEFINER` and check membership first. Internal helpers aren't callable from the API.
- **Stock:** `products.stock_qty` changes only through the append-only `stock_movements` ledger, with row locks and a `>= 0` check (no negative stock). Sale/usage edits apply the *difference* in the same transaction.
- **Costs:** each sale and item-expense snapshots the unit cost; purchases re-weight the average cost and never rewrite old sales. Purchases are inventory (an asset), so they're not counted as an expense. Items that are used or damaged are expensed once, at cost.
- **Currency:** each record keeps the amount and currency as entered, plus an immutable FX snapshot and USD-normalised columns. Reports add up only the USD columns and show the original-currency totals separately.
- **Banjarka:** net = gross − expenses. The worker gets net ÷ 2 (rounded to the cent) and the shop gets the exact remainder. If expenses are greater than gross, the save is rejected and no payout is calculated. A worker can save one record per day.
- **5-hour edit window:** an author can edit or void their own record while `now() < created_at + 5h`. `created_at` and `created_by` are frozen by a trigger, so the window never resets. After that, only an admin can make a *correction*, and it needs a reason.
- **Audit:** `record_revisions` is append-only (enforced by a trigger, which applies even to the table owner). It stores the original, every before/after JSON snapshot, the changed fields, the actor, the reason and the time. Records are voided, never deleted.

## Setup

### 1. Create the Supabase project
1. At supabase.com create a **new** project named `kaafiye-spare-parts`. Don't reuse the paused `travel-agency-system` project.
2. **SQL Editor:** run these two migrations in order, pasting each file's full contents:
   - `supabase/migrations/20261102000001_init.sql`
   - `supabase/migrations/20261102000002_storage.sql` (creates the private `product-images` bucket and its policies)

   CLI alternative: `npx supabase init` (keep the existing `supabase/migrations`), then `npx supabase link --project-ref <ref>`, then `npx supabase db push`.
3. **Authentication → Sign In / Providers → Email:** turn **off** "Allow new users to sign up". Staff accounts are created only by admins.
4. **Authentication → URL Configuration:** set the Site URL to your production URL.

### 2. Environment
```bash
cp .env.example .env.local   # then fill in values from Project Settings → API
```
`SUPABASE_SERVICE_ROLE_KEY` is server-only. It's used only by the admin/super-admin actions that create or disable logins, and only after the caller's role has been re-checked. Never prefix it with `NEXT_PUBLIC_`.

Staff can log in with a username. Usernames are stored as `<username>@STAFF_EMAIL_DOMAIN` (default `staff.kaafiye.local`), and no e-mail is ever sent. If your Supabase project rejects that domain, set `STAFF_EMAIL_DOMAIN` to a domain you own.

### 3. Run
```bash
npm install
npm run create-super-admin -- owner@example.com   # prompts for a password (min 12 chars); nothing is hard-coded
npm run dev                                        # http://localhost:3000
```
After that:
1. Sign in as the super admin and open **Meheradaha / Businesses**.
2. Create the business (short code `kaafiye`) together with its admin account.
3. Sign in as that admin and open **Settings**. Enter today's real exchange rate; until you do, the example rate stays flagged.
4. Go to **Users** and create staff accounts.
5. **Optional:** to record the known receipts, run `supabase/seed/historical_receipts.sql` in the SQL editor. It records the Geelle ($68) and Tawakal ($155) receipts and creates their six products with **0 stock and no selling price**. Then, in **Inventory**, enter each product's *current* on-hand count (as an "Opening count") and its real selling price.

`supabase/seed/demo_business.sql` creates a separate, clearly labelled **DEMO** business for staging. Don't run it in production.

### 4. Deploy (Vercel)
1. Import the repo.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `STAFF_EMAIL_DOMAIN`.
3. Deploy.

The app must be served over HTTPS for installing to work (Vercel does this by default).

## Commands
| | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest: SQL rules in Postgres (PGlite) + money/format logic + seed scripts |
| `npm run typecheck` / `lint` | TS / ESLint |
| `npm run icons` | regenerate PWA icons |

## Install as an app
The public login page has **"⬇ Ku rakib App-ka / Install App"**. You don't have to sign in to see it, and it's also in Settings.
- **Chrome/Edge (Android/desktop):** the button opens the browser's real install prompt.
- **iPhone/iPad:** shows the steps (Safari → Share → Add to Home Screen).

There is no APK. The service worker caches only static files. Pages and saves always need a connection, and when offline the app shows an honest "nothing can be saved offline" page.

## Known limitations / next steps
- **Missing purchase costs:** Xaydh Weyn, Xaydh Yar, Filter and Taayir R18 have no known cost price, so their
  profit is overstated until the admin enters it (the app marks them "cost not set" and reports warn).
- **FX:** set manually. If a trustworthy SlSh market-rate source appears, insert into `fx_rates` with
  `source='auto:<name>'` from a scheduled job.
- **One business per staff account.** **One product per sale.** **One photo per product.**
- **No offline saving**, by design: the app shows an honest offline page.

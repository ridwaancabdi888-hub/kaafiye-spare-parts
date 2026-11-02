// Ops helper: run SQL on the linked Supabase project via the Management API.
//   node scripts/sbq.mjs "select 1"      |  node scripts/sbq.mjs -f file.sql
// Reads the access token from SUPABASE_ACCESS_TOKEN or ./.supabase-token (gitignored). Never prints it.
import { readFileSync, existsSync } from "node:fs";

const REF = process.env.SUPABASE_PROJECT_REF || "kjmhgnntiuvgshbgxodm";
const token = process.env.SUPABASE_ACCESS_TOKEN || (existsSync(".supabase-token") && readFileSync(".supabase-token", "utf8").trim());
if (!token) throw new Error("No Supabase access token");
const args = process.argv.slice(2);
const query = args[0] === "-f" ? readFileSync(args[1], "utf8") : args.join(" ");

const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const text = await r.text();
console.log(r.ok ? text : `HTTP ${r.status}: ${text}`);
if (!r.ok) process.exit(1);

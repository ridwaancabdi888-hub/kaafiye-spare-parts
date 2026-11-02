// One-off ops: secure Supabase Auth config + write env for local and Vercel. Never prints secrets.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const REF = "kjmhgnntiuvgshbgxodm";
const SITE = "https://kaafiye-spare-parts.vercel.app";
const token = readFileSync(".supabase-token", "utf8").trim();
const api = (path, init = {}) =>
  fetch(`https://api.supabase.com/v1/projects/${REF}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });

// 1) Auth: no public signup, correct site URL, sane password rules.
let r = await api("/config/auth", {
  method: "PATCH",
  body: JSON.stringify({
    disable_signup: true,
    site_url: SITE,
    uri_allow_list: `${SITE}/**,http://localhost:3000/**`,
    password_min_length: 8,
    external_anonymous_users_enabled: false,
  }),
});
console.log("auth config:", r.status);
const auth = await (await api("/config/auth")).json();
console.log("disable_signup =", auth.disable_signup, "| site_url =", auth.site_url);

// 2) Keys (legacy JWT anon/service_role — what @supabase/ssr + admin API accept).
const keys = await (await api("/api-keys?reveal=true")).json();
const anon = keys.find((k) => k.name === "anon")?.api_key;
const service = keys.find((k) => k.name === "service_role")?.api_key;
if (!anon || !service) throw new Error("Could not read API keys");

const env = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: service,
  STAFF_EMAIL_DOMAIN: "staff.kaafiye.local",
};

// 3) .env.local (keep existing lines such as Vercel's OIDC token).
const existing = existsSync(".env.local") ? readFileSync(".env.local", "utf8").split(/\r?\n/) : [];
const kept = existing.filter((l) => l && !Object.keys(env).some((k) => l.startsWith(k + "=")));
writeFileSync(".env.local", [...kept, ...Object.entries(env).map(([k, v]) => `${k}=${v}`)].join("\n") + "\n", { mode: 0o600 });
console.log(".env.local written with", Object.keys(env).join(", "));

// 4) Vercel env (value via stdin, never on the command line).
if (process.argv.includes("--vercel")) {
  for (const target of ["production", "preview", "development"]) {
    for (const [k, v] of Object.entries(env)) {
      const secret = k === "SUPABASE_SERVICE_ROLE_KEY";
      if (secret && target === "development") continue; // Vercel sensitive vars can't target development
      execFileSync("vercel", ["env", "add", k, target, "--force", "--yes", secret ? "--sensitive" : "--no-sensitive"], {
        input: v, stdio: ["pipe", "ignore", "ignore"], shell: true,
      });
    }
    console.log("vercel env set for", target);
  }
}

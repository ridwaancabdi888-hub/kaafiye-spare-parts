// Provision the first Super Admin. Nothing is hard-coded: the password is typed at the prompt.
//   npm run create-super-admin -- owner@example.com
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline";

const email = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !email.includes("@")) {
  console.error("Usage: npm run create-super-admin -- you@example.com");
  process.exit(1);
}
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local)");
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : "*");
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = process.env.SUPER_ADMIN_PASSWORD || (await askHidden("New password (min 12 chars): "));
if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
let userId;
const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  if (!/already|registered|exists/i.test(error.message)) throw error;
  // Existing account: promote it (password unchanged).
  const { data: list, error: lErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (lErr) throw lErr;
  userId = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  if (!userId) throw new Error("User exists but could not be found");
  console.log("Account already existed — promoting to super admin (password unchanged).");
} else {
  userId = data.user.id;
}

const { error: sErr } = await admin.from("super_admins").upsert({ user_id: userId });
if (sErr) throw sErr;
console.log(`✓ ${email} is a Super Admin. Sign in, open “Businesses”, and create the first business + admin.`);

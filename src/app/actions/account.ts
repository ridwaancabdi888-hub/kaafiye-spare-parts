"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession, type Session } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCurrentPassword } from "@/lib/login-guard";
import { passwordProblem } from "@/lib/password";
import { isValidUsername, normalizeUsername, usernameToEmail } from "@/lib/staff";
import { errorKey, type ActionState } from "@/lib/errors";
import type { DictKey } from "@/lib/i18n/dict";

// Every privileged change re-checks the caller's role server-side, uses the service-role client
// only after that check, and writes an account_events row. Passwords are never logged.

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v.trim() : "";
};
const fail = (error: DictKey): ActionState => ({ error, at: Date.now() });
const done = (id?: string): ActionState => ({ ok: true, id, at: Date.now() });

type Target = { user_id: string; business_id: string; role: "admin" | "user"; username: string | null; full_name: string; archived_at: string | null };
type EventName = "account_created" | "password_reset" | "password_changed" | "disabled" | "enabled" | "username_set" | "archived" | "restored";

async function logEvent(admin: SupabaseClient, s: Session, businessId: string | null, target: { id: string; name: string },
  event: EventName, detail: Record<string, unknown> = {}) {
  await admin.from("account_events").insert({
    business_id: businessId, target_user: target.id, target_name: target.name, actor: s.user.id,
    actor_name: s.membership?.full_name ?? s.user.email ?? null, event, detail,
  });
}

/**
 * Who may manage whom: the super admin manages any business account; a business admin manages
 * staff (role "user") of their own business. Nobody manages their own account here, and super admin
 * accounts are never managed from these screens.
 */
async function manageable(userId: string): Promise<{ s: Session; admin: SupabaseClient; target: Target } | null> {
  const s = await getSession();
  if (!s || !userId || userId === s.user.id || !(s.isSuper || s.isAdmin)) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("memberships").select("user_id, business_id, role, username, full_name, archived_at").eq("user_id", userId).maybeSingle<Target>();
  if (!data) return null;
  const { data: superRow } = await admin.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (superRow) return null;
  if (s.isSuper) return { s, admin, target: data };
  if (s.isAdmin && data.business_id === s.membership?.business_id && data.role === "user") return { s, admin, target: data };
  return null;
}

async function createAccount(s: Session, businessId: string, role: "admin" | "user", f: FormData): Promise<ActionState> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fail("users.serviceKeyMissing");
  const fullName = str(f, "full_name");
  const username = normalizeUsername(str(f, "username"));
  const password = String(f.get("password") ?? "");
  if (!fullName) return fail("err.REQUIRED");
  if (!isValidUsername(username)) return fail("err.USERNAME_INVALID");
  const pwProblem = passwordProblem(password, username);
  if (pwProblem) return fail(pwProblem);

  const admin = createAdminClient();
  const { data: taken } = await admin.from("memberships").select("id").eq("username", username).maybeSingle();
  if (taken) return fail("err.USERNAME_TAKEN");
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username), password, email_confirm: true,
    user_metadata: { full_name: fullName }, // display only — roles live in public.memberships
  });
  if (error || !data.user) {
    if (/already|exists|registered/i.test(error?.message ?? "")) return fail("err.USERNAME_TAKEN");
    if (/password/i.test(error?.message ?? "")) return fail("err.PASSWORD_WEAK");
    return fail("err.generic");
  }
  const { error: mErr } = await admin.from("memberships").insert({
    business_id: businessId, user_id: data.user.id, role, full_name: fullName, username, must_change_password: true,
  });
  if (mErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    return fail(errorKey(mErr));
  }
  await logEvent(admin, s, businessId, { id: data.user.id, name: fullName }, "account_created", { role, username });
  revalidatePath("/users");
  revalidatePath("/super");
  return done(data.user.id);
}

/** Business admin: add a staff member to their own business. */
export async function createStaff(_: ActionState, f: FormData): Promise<ActionState> {
  const s = await getSession();
  if (!s?.isAdmin || !s.membership) return fail("err.ADMIN_ONLY");
  return createAccount(s, s.membership.business_id, "user", f);
}

/** Super admin: add an admin to any business. */
export async function addBusinessAdmin(_: ActionState, f: FormData): Promise<ActionState> {
  const s = await getSession();
  if (!s?.isSuper) return fail("err.SUPER_ADMIN_ONLY");
  const businessId = str(f, "business_id");
  if (!businessId) return fail("err.REQUIRED");
  return createAccount(s, businessId, "admin", f);
}

export async function createBusinessWithAdmin(_: ActionState, f: FormData): Promise<ActionState> {
  const s = await getSession();
  if (!s?.isSuper) return fail("err.SUPER_ADMIN_ONLY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fail("users.serviceKeyMissing");
  const name = str(f, "name");
  const slug = str(f, "slug").toLowerCase();
  if (!name || !/^[a-z0-9-]{2,40}$/.test(slug) || !str(f, "full_name")) return fail("err.REQUIRED");
  const username = normalizeUsername(str(f, "username"));
  if (!isValidUsername(username)) return fail("err.USERNAME_INVALID");
  const pwProblem = passwordProblem(String(f.get("password") ?? ""), username);
  if (pwProblem) return fail(pwProblem);

  const { data: businessId, error } = await s.supabase.rpc("create_business", { p_name: name, p_slug: slug });
  if (error) return fail(errorKey(error));
  const r = await createAccount(s, businessId as string, "admin", f);
  revalidatePath("/super");
  return r?.ok ? done(businessId as string) : r; // on failure the business exists; add its admin from the list
}

export async function setBusinessActive(businessId: string, active: boolean): Promise<ActionState> {
  const s = await getSession();
  if (!s?.isSuper) return fail("err.SUPER_ADMIN_ONLY");
  const { error } = await s.supabase.from("businesses").update({ active }).eq("id", businessId);
  if (error) return fail(errorKey(error));
  revalidatePath("/super");
  return done();
}

/** Admin-issued temporary password: old password not needed; user must change it at next sign-in. */
export async function resetPassword(_: ActionState, f: FormData): Promise<ActionState> {
  const m = await manageable(str(f, "user_id"));
  if (!m) return fail("err.ADMIN_ONLY");
  const password = String(f.get("password") ?? "");
  const problem = passwordProblem(password, m.target.username);
  if (problem) return fail(problem);
  const { error } = await m.admin.auth.admin.updateUserById(m.target.user_id, { password });
  if (error) return fail(/password/i.test(error.message) ? "err.PASSWORD_WEAK" : "err.generic");
  await m.admin.from("memberships").update({ must_change_password: true }).eq("user_id", m.target.user_id);
  await logEvent(m.admin, m.s, m.target.business_id, { id: m.target.user_id, name: m.target.full_name }, "password_reset");
  revalidatePath("/users");
  revalidatePath("/super");
  return done(m.target.user_id);
}

export async function setAccountActive(userId: string, active: boolean): Promise<ActionState> {
  const m = await manageable(userId);
  if (!m) return fail("err.ADMIN_ONLY");
  if (m.target.archived_at) return fail("err.ACCOUNT_ARCHIVED");
  const { error } = await m.admin.from("memberships").update({ active }).eq("user_id", userId);
  if (error) return fail(errorKey(error));
  // Also block sign-in at the auth layer (RLS already denies data access once inactive).
  await m.admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  await logEvent(m.admin, m.s, m.target.business_id, { id: userId, name: m.target.full_name }, active ? "enabled" : "disabled");
  revalidatePath("/users");
  revalidatePath("/super");
  return done(userId);
}

/**
 * "Remove employee": ends their employment without deleting anything. The account is disabled and
 * blocked from signing in; their sales, Banjarka, expenses and audit history stay as they are.
 */
export async function archiveAccount(userId: string): Promise<ActionState> {
  const m = await manageable(userId);
  if (!m) return fail("err.ADMIN_ONLY");
  if (m.target.archived_at) return done(userId);
  const { error } = await m.admin.from("memberships")
    .update({ active: false, archived_at: new Date().toISOString(), archived_by: m.s.user.id }).eq("user_id", userId);
  if (error) return fail(errorKey(error));
  await m.admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  await logEvent(m.admin, m.s, m.target.business_id, { id: userId, name: m.target.full_name }, "archived");
  revalidatePath("/users");
  revalidatePath("/super");
  return done(userId);
}

/** Bring an archived employee back as an active account. */
export async function restoreAccount(userId: string): Promise<ActionState> {
  const m = await manageable(userId);
  if (!m) return fail("err.ADMIN_ONLY");
  if (!m.target.archived_at) return done(userId);
  const { error } = await m.admin.from("memberships").update({ active: true, archived_at: null, archived_by: null }).eq("user_id", userId);
  if (error) return fail(errorKey(error));
  await m.admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  await logEvent(m.admin, m.s, m.target.business_id, { id: userId, name: m.target.full_name }, "restored");
  revalidatePath("/users");
  revalidatePath("/super");
  return done(userId);
}

export async function setUsername(_: ActionState, f: FormData): Promise<ActionState> {
  const m = await manageable(str(f, "user_id"));
  if (!m) return fail("err.ADMIN_ONLY");
  const username = normalizeUsername(str(f, "username"));
  if (!isValidUsername(username)) return fail("err.USERNAME_INVALID");
  if (username === m.target.username) return done(m.target.user_id);
  const { error } = await m.admin.from("memberships").update({ username }).eq("user_id", m.target.user_id);
  if (error) return fail(error.code === "23505" ? "err.USERNAME_TAKEN" : errorKey(error));
  await logEvent(m.admin, m.s, m.target.business_id, { id: m.target.user_id, name: m.target.full_name }, "username_set",
    { from: m.target.username, to: username });
  revalidatePath("/users");
  revalidatePath("/super");
  return done(m.target.user_id);
}

/** Any signed-in user. After an admin reset (forced) the current password is not asked again. */
export async function changeOwnPassword(_: ActionState, f: FormData): Promise<ActionState> {
  const s = await getSession();
  if (!s?.user.email) return fail("err.generic");
  const forced = Boolean(s.membership?.must_change_password);
  const password = String(f.get("password") ?? "");
  if (password !== String(f.get("confirm") ?? "")) return fail("err.PASSWORD_MISMATCH");
  const problem = passwordProblem(password, s.membership?.username);
  if (problem) return fail(problem);
  if (!forced) {
    const current = String(f.get("current") ?? "");
    if (current === password) return fail("err.SAME_PASSWORD");
    const check = await verifyCurrentPassword(s.user.email, current);
    if (check === "throttled") return { error: "login.throttled", vars: { m: 15 }, at: Date.now() };
    if (check === "wrong") return fail("err.WRONG_PASSWORD");
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(s.user.id, { password });
  if (error) return fail(/password/i.test(error.message) ? "err.PASSWORD_WEAK" : "err.generic");
  if (s.membership) await admin.from("memberships").update({ must_change_password: false }).eq("user_id", s.user.id);
  await logEvent(admin, s, s.membership?.business_id ?? null, { id: s.user.id, name: s.membership?.full_name ?? s.user.email }, "password_changed");
  // A password change ends the user's existing sessions; sign this device straight back in.
  const { error: reauth } = await s.supabase.auth.signInWithPassword({ email: s.user.email, password });
  if (reauth) redirect("/login");
  if (forced) redirect("/");
  return done();
}

/** Staff accounts are created with a username; Supabase Auth stores a synthetic address (no mail is ever sent). */
export function staffEmailDomain() {
  return (process.env.STAFF_EMAIL_DOMAIN || "staff.kaafiye.local").toLowerCase();
}

export function normalizeUsername(v: string) {
  return v.trim().toLowerCase();
}

export function isValidUsername(v: string) {
  return /^[a-z0-9._-]{3,32}$/.test(v);
}

export function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@${staffEmailDomain()}`;
}

/** Staff without e-mail log in with a username, stored as a synthetic address (no mail is sent). */
export function staffEmailDomain() {
  return (process.env.STAFF_EMAIL_DOMAIN || "staff.kaafiye.local").toLowerCase();
}

export function loginToEmail(identifier: string) {
  const v = identifier.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${staffEmailDomain()}`;
}

export function isValidUsername(v: string) {
  return /^[a-z0-9._-]{3,32}$/.test(v);
}

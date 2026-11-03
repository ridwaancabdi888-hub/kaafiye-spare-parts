import type { DictKey } from "./i18n/dict";

// Length is what matters (NIST 800-63B): min 8, no forced symbol rules, but block the obvious.
export const PASSWORD_MIN = 8;
const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "qwerty123", "qwertyuiop", "iloveyou", "welcome1",
  "admin123", "letmein1", "abcd1234", "abc12345", "kaafiye1", "kaafiye123", "kaafiye01", "somaliland",
  "hargeisa", "hargeisa1", "12341234", "11223344", "00000000",
]);

function isSequence(s: string) {
  if (!/^\d+$/.test(s)) return false;
  const step = Number(s[1]) - Number(s[0]);
  if (Math.abs(step) !== 1) return false;
  for (let i = 1; i < s.length; i++) if ((Number(s[i]) - Number(s[i - 1]) + 10) % 10 !== (step + 10) % 10) return false;
  return true;
}

/** Returns a translation key describing the problem, or null if the password is acceptable. */
export function passwordProblem(pw: string, username?: string | null): DictKey | null {
  if (pw.length < PASSWORD_MIN) return "err.PASSWORD_SHORT";
  if (pw.length > 72) return "err.PASSWORD_LONG";
  const lower = pw.toLowerCase();
  if (/^(.)\1+$/.test(pw) || COMMON.has(lower) || isSequence(pw)) return "err.PASSWORD_WEAK";
  if (username && username.length >= 3 && lower.includes(username.toLowerCase())) return "err.PASSWORD_HAS_USERNAME";
  return null;
}

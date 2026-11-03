import type { IconName } from "../Icon";

export type NavItem = { href: string; label: string; icon: IconName };

export function isActive(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}

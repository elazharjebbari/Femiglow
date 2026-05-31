/**
 * Flag client du Locale Switcher V2 (lot L0/L3).
 *
 * `NEXT_PUBLIC_LOCALE_SWITCHER_V2` (lisible navigateur) — off par défaut.
 * Permet une bascule progressive + rollback instantané (flag off = retour
 * au comportement V1, cf. runbook §rollback N1).
 */
const TRUTHY = new Set(['true', '1', 'on', 'yes', 'enabled']);

export function isLocaleSwitcherV2Enabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_LOCALE_SWITCHER_V2;
  if (!raw) return false;
  return TRUTHY.has(raw.toLowerCase().trim());
}

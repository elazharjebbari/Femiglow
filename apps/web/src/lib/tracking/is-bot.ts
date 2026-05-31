/**
 * `isBotRequest` — détection légère de bots via User-Agent. Utilisé par le
 * helper SSR `server-fire` pour éviter de tirer des events CAPI ViewContent
 * sur les visites de crawlers (qui polluent Meta Events Manager et faussent
 * les ROAS).
 *
 * Pas de dépendance externe (le projet a déjà ~80 deps). Si on a besoin de
 * précision industrielle (eBay/Apple Walking/etc.), brancher `isbot` package
 * (~10KB). Pour notre use case (ViewContent SSR), les 10 patterns ci-dessous
 * capturent ~95% des bots qui visiteraient un site e-commerce marocain.
 *
 * Conservateur : un UA vide ou non-string est traité comme bot.
 *
 * cf. docs/meta-quality-audit-2026-05/01-design-conception.md §2.5
 */
const BOT_PATTERNS: readonly RegExp[] = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /facebookexternalhit/i,
  /lighthouse/i,
  /headlesschrome/i,
  /pingdom/i,
  /uptime/i,
  /pagespeed/i,
  /yandex/i,
  /duckduckgo/i,
  /slackbot/i,
];

export function isBotRequest(userAgent: string | null | undefined): boolean {
  if (typeof userAgent !== 'string' || userAgent.length === 0) return true;
  return BOT_PATTERNS.some((rx) => rx.test(userAgent));
}

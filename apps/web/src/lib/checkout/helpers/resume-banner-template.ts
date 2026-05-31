/**
 * Helper pur — résout le template ResumeBanner en remplaçant `{firstName}`.
 *
 * Le template est éditable via override admin (Phase W5) — on garde la
 * logique dans un helper pur testable indépendamment du composant.
 */
export function formatResumeBanner(template: string, firstName: string): string {
  return template.replace(/\{firstName\}/g, firstName);
}

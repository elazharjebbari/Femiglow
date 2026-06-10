/**
 * axe-e2e — oracle d'accessibilité Playwright partagé (gate G6).
 *
 * Politique identique au helper jsdom `src/test/axe.ts` : on ne bloque que
 * sur les violations `serious`/`critical` (les `minor`/`moderate` sont
 * remontées par l'audit, pas par la batterie bloquante). Le message d'échec
 * liste id + impact + cibles pour corriger sans relancer en debug.
 */
import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export async function expectNoSeriousAxeViolations(
  page: Page,
  context?: string,
): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  const report = blocking
    .map(
      (v) =>
        `[${v.impact}] ${v.id} — ${v.help}\n  ${v.nodes
          .slice(0, 5)
          .map((n) => `${n.target.join(' ')}\n    ${n.html.slice(0, 200)}`)
          .join('\n  ')}`,
    )
    .join('\n');
  expect(blocking, `axe ${context ?? page.url()} :\n${report}`).toEqual([]);
}

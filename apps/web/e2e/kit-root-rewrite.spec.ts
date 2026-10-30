/**
 * Kit CRO v2 §1 — `/kit` (landing des publicités) servi par rewrite interne.
 *
 * Avec `I18N_ENABLED=true` et `KIT_ROOT_REWRITE` actif (défaut), le
 * middleware sert l'arbre localisé `/fr/kit` SANS 307 : l'URL `/kit?…` reste
 * dans la barre d'adresse. Risque principal : des composants clients qui
 * dérivent la locale de `usePathname()` (`/kit` au lieu de `/fr/kit`) et
 * produisent un écart d'hydratation. On vérifie donc :
 *  - réponse 200 directe (aucune redirection dans la chaîne) ;
 *  - URL finale toujours `/kit?code=GLOW99` ;
 *  - aucun message console d'hydratation pendant le chargement + 2 s.
 *
 * Pré-requis (lus aussi par `playwright.config.ts` depuis `.env` /
 * `.env.local`) : `I18N_ENABLED=true`, `KIT_ROOT_REWRITE` absent ou `on`.
 * Sinon le test est ignoré : sans i18n, `/kit` est l'arbre legacy (pas de
 * rewrite à vérifier) ; avec `KIT_ROOT_REWRITE=off`, le 307 est attendu.
 */
import { expect, test, type ConsoleMessage } from '@playwright/test';

const I18N_FLAG_ACTIVE = process.env.I18N_ENABLED === 'true';
const KIT_REWRITE_DISABLED = ['off', 'false', '0'].includes(
  (process.env.KIT_ROOT_REWRITE ?? '').trim().toLowerCase(),
);

/** Landing réelle des publicités FR (code promo de la publicité). */
const AD_LANDING = '/kit?code=GLOW99';

/** Fenêtre d'observation après `load` (effets, hydratation des îlots Suspense). */
const SETTLE_MS = 2_000;

/**
 * Messages d'hydratation React 18 : texte complet en dev, erreurs minifiées
 * en build de production (#418 hydratation échouée, #422/#423 erreur pendant
 * l'hydratation, #425 texte différent).
 */
const HYDRATION_PATTERN = /hydration|did not match|Minified React error #(?:418|422|423|425)\b/i;

test.describe('Kit CRO v2 — /kit servi sans redirection', () => {
  test.skip(
    !I18N_FLAG_ACTIVE,
    'I18N_ENABLED=true requis : sans i18n, /kit est l’arbre legacy (aucun rewrite).',
  );
  test.skip(KIT_REWRITE_DISABLED, 'KIT_ROOT_REWRITE=off : la redirection 307 est attendue.');

  test('/kit?code=GLOW99 : 200 direct, URL conservée, aucune erreur d’hydratation', async ({
    page,
    context,
  }) => {
    // Visiteur publicitaire neuf : pas de cookie de langue (un cookie `ar`
    // donnerait légitimement un 307 vers /ar/kit).
    await context.clearCookies();

    const hydrationMessages: string[] = [];
    const onConsole = (message: ConsoleMessage) => {
      const text = message.text();
      if (HYDRATION_PATTERN.test(text)) hydrationMessages.push(`[${message.type()}] ${text}`);
    };
    const onPageError = (error: Error) => {
      if (HYDRATION_PATTERN.test(error.message))
        hydrationMessages.push(`[pageerror] ${error.message}`);
    };
    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    const response = await page.goto(AD_LANDING, { waitUntil: 'load' });

    expect(response, 'réponse de navigation').not.toBeNull();
    // Aucune redirection dans la chaîne : la réponse finale est la première.
    expect(response!.request().redirectedFrom()).toBeNull();
    expect(response!.status()).toBe(200);

    // URL inchangée dans la barre d'adresse (et après hydratation).
    expect(page.url()).toMatch(/\/kit\?code=GLOW99$/);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    await page.waitForTimeout(SETTLE_MS);
    expect(new URL(page.url()).pathname).toBe('/kit');
    expect(page.url()).toMatch(/\/kit\?code=GLOW99$/);

    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    expect(hydrationMessages, hydrationMessages.join('\n')).toEqual([]);
  });
});

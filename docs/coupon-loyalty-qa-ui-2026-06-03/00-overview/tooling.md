# Tooling — stack, chemins, patterns, pièges

## Stack

| Couche | Outil | Config |
|---|---|---|
| Unit/Intégration/Composant | **Vitest** (globals, env `jsdom`) | `apps/web/vitest.config.ts` |
| DOM matchers | `@testing-library/jest-dom/vitest` | auto via `apps/web/vitest.setup.ts` |
| Rendu React | `@testing-library/react` | `render()` direct (pas de wrapper global) |
| Réseau mocké | **MSW** (`setupServer`) | `apps/web/src/test/msw/server.ts` |
| E2E | **Playwright** | `apps/web/playwright.config.ts`, dir `e2e/` |
| A11y | `axe-core` (e2e) / `jest-axe` (composant) | par test |

## Chemins exacts

- Vitest config : `apps/web/vitest.config.ts` — setup : `vitest.setup.ts`, `src/test/setup/{vitest.faker,msw.setup,matchers.setup}.ts`
- MSW serveur : `apps/web/src/test/msw/server.ts` → `export const server = setupServer(); export { http, HttpResponse }`
- **Nouveau** : `apps/web/src/test/msw/coupons-handlers.ts` (à créer en W1)
- Playwright : `apps/web/playwright.config.ts` — baseURL `http://127.0.0.1:3000` (ou `PLAYWRIGHT_BASE_URL`)
- Setup e2e (auth) : `apps/web/e2e/global.setup.ts` → `.auth/admin.json` (storageState) ; helpers `apps/web/e2e/helpers/auth.ts`
- Specs e2e : `apps/web/e2e/*.spec.ts`

## Patterns

### Composant admin avec MSW + session mockée
```ts
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { couponsAdminHandlers } from '@/test/msw/coupons-handlers';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('F01-C001 crée un brouillon et l’affiche dans la table', async () => {
  server.use(...couponsAdminHandlers({ coupons: [], role: 'admin' }));
  render(<CouponsManager initialCoupons={[]} />);
  fireEvent.change(screen.getByLabelText(/libellé/i), { target: { value: 'Flash' } });
  fireEvent.click(screen.getByText(/Créer/i));
  expect(await screen.findByTestId('coupon-row-cpn_test')).toBeInTheDocument();
});
```

### Échec réseau (403)
```ts
server.use(http.post('/api/admin/coupons', () =>
  HttpResponse.json({ error: { code: 'forbidden' } }, { status: 403 })));
// oracle : screen.getByRole('alert') contient « refusée (HTTP 403) »
```

### Contrat de route (Vitest, sans serveur)
```ts
import { POST } from '@/app/api/admin/coupons/[id]/status/route';
vi.mock('@/lib/auth/admin-session', () => ({ getAdminSession: () => sessionViewer }));
const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ status: 'active' }) }), { params: { id } });
expect(res.status).toBe(403);
```

### E2E admin (storageState pré-authentifié)
```ts
test('F16-E001 créer → activer → effet /kit', async ({ page }) => {
  await page.goto('/admin/coupons');
  await page.getByTestId('coupon-create-label').fill('Geste');
  await page.getByRole('button', { name: /Créer/ }).click();
  // …activer puis vérifier /kit
});
```

## Pièges connus (de l'expérience du repo)

1. **`cd apps/web` obligatoire** avant tout `pnpm test`/`playwright` (sinon « command not found »).
2. **MSW lifecycle par fichier** : ne jamais poser un `server.listen()` global ; chaque suite gère son cycle + sa policy `onUnhandledRequest`.
3. **react-hook-form** : remplir un input via `.value=` programmatique ne déclenche pas la validation ; en composant test utiliser `fireEvent.change`/`userEvent.type` ; en Playwright `fill()`.
4. **Tailwind opacity sur var CSS** : `bg-sauge/20` peut rendre transparent → asserter sur la classe **hex** (`bg-[#A8B89E]/30`) si pertinent.
5. **`Date.now()` interdit dans les oracles** : injecter `now` (param des fonctions) ou utiliser des dates fixes de fixtures.
6. **Téléphone PII** : les fixtures de grants doivent fournir le téléphone **déjà masqué** côté réponse (le repo masque en sérialisation) ; ne jamais asserter un numéro en clair.
7. **Playwright** : pas de `waitForTimeout`; attendre un testid ou `page.waitForResponse(/api\/coupons/)`.
8. **storageState admin** : produit par `global.setup.ts` ; si absent, les specs admin échouent en redirection `/admin/login` (c'est aussi un test : F16 auth-guard).

## Commandes (rappel, détail dans 99-runbook/commands.md)

```bash
cd apps/web && pnpm typecheck
cd apps/web && pnpm lint
cd apps/web && pnpm test src/components/admin/coupons           # cibler un dossier
cd apps/web && pnpm test -t "F08"                               # par id
cd apps/web && pnpm vitest run --repeat-each 3 <fichier>        # anti-flaky
cd apps/web && pnpm exec playwright test e2e/loyalty-redemption.spec.ts
```

# Unit tests — Vitest

| Aspect | Valeur |
|---|---|
| Outil | Vitest 1.x |
| DOM | jsdom (par défaut) |
| Library composant | @testing-library/react |
| User events | @testing-library/user-event |
| a11y | jest-axe |
| Coverage | v8 provider |

## Configuration

`apps/web/vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.config.ts',
        'src/test/**',
        'src/app/**/page.tsx',
        'src/app/**/layout.tsx',
        'src/instrumentation.ts',
        'src/middleware.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

`apps/web/vitest.setup.ts` :

```ts
import '@testing-library/jest-dom/vitest';
import { server } from './src/test/msw/server';
import { beforeAll, afterAll, afterEach } from 'vitest';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Catalogue des spécifications unit

### Composants UI génériques

| Fichier | Composant | Cas couverts |
|---|---|---|
| `Button.test.tsx` | `<Button>` | variants, disabled, asChild, href, focus |
| `Field.test.tsx` | `<Field>` | label/input lié, erreur affichée, aria-describedby |
| `Badge.test.tsx` | `<Badge>` | variants couleur, taille |
| `Pagination.test.tsx` | `<Pagination>` | hasPrev/hasNext, range, hrefs |
| `Modal.test.tsx` | `<Modal>` | open/close, focus trap, Esc, click outside |
| `Switch.test.tsx` | `<Switch>` | toggle, controlled, aria-checked |

### Login

| Fichier | Cas couverts |
|---|---|
| `LoginForm.test.tsx` | rendu initial, validation Zod, submit ok, focus initial email |

### Dashboard

| Fichier | Cas couverts |
|---|---|
| `KPICards.test.tsx` | 3 cartes rendues, valeurs, accent couleur |
| `RecentLeads.test.tsx` | tableau 5 lignes, lien "Voir tous" |

### Leads

| Fichier | Cas couverts |
|---|---|
| `LeadFilters.test.tsx` | filtres → URL, debounce, reset |
| `LeadTable.test.tsx` | tri, ligne cliquable, badges |
| `LeadDetail.test.tsx` | sections rendues selon type |
| `StatusMenu.test.tsx` | options selon état, transition |
| `NoteForm.test.tsx` | submit, validation min/max |
| `Timeline.test.tsx` | tri chronologique, types d'event |
| `ExportButton.test.tsx` | href construit avec filtres courants |

### Webhooks

| Fichier | Cas couverts |
|---|---|
| `WebhooksTable.test.tsx` | colonnes, indicateur santé |
| `WebhookToggle.test.tsx` | toggle active/inactive |
| `DeleteWebhookDialog.test.tsx` | confirmation, cancel |
| `WebhookForm.test.tsx` | validation Zod, submit, secret affiché une fois |
| `EventTypeMultiSelect.test.tsx` | sélection multiple, validation min 1 |
| `CustomHeadersInput.test.tsx` | ajout, suppression, max 5 |
| `RotateSecretButton.test.tsx` | confirmation, nouveau secret |
| `TestButton.test.tsx` | submit, affichage résultat |

### Deliveries

| Fichier | Cas couverts |
|---|---|
| `DeliveriesTable.test.tsx` | colonnes, colorisation HTTP |
| `DeliveryDrawer.test.tsx` | open/close, focus trap, contenu |
| `RetryButton.test.tsx` | submit, état loading |
| `DeliveryStats.test.tsx` | 3 KPIs |

### Hooks & utils

| Fichier | Cas couverts |
|---|---|
| `usePagination.test.ts` | encode/decode cursor |
| `useFilters.test.tsx` | sync URL → state, debounce |
| `useSession.test.tsx` | détection 401 → redirect |
| `pagination.test.ts` | base64 round-trip, validité |
| `csv.test.ts` | streaming, échappement, BOM UTF-8 |
| `time.test.ts` | format relatif, fuseau Casablanca |

### Schemas Zod

| Fichier | Cas couverts |
|---|---|
| `admin-auth.test.ts` | parse OK, erreurs de validation |
| `leads.test.ts` | enums, filtres, csvExport |
| `webhooks.test.ts` | URL HTTPS, anti-SSRF, customHeaders max |
| `public-forms.test.ts` | consent obligatoire, types |

### Auth & sécurité

| Fichier | Cas couverts |
|---|---|
| `password.test.ts` | hash & verify argon2id, paramètres |
| `rate-limit.test.ts` | fenêtre, seuil, retry-after |
| `require-admin.test.ts` | throw HttpError 401 si pas de session |
| `signing.test.ts` | HMAC SHA-256, timingSafeEqual |
| `encrypt.test.ts` | round-trip pgp_sym |
| `redact.test.ts` | masquage email/phone/password |

### Webhook engine

| Fichier | Cas couverts |
|---|---|
| `enqueue.test.ts` | filtre endpoints actifs, signature |
| `attempt-delivery.test.ts` | success/4xx/5xx/timeout/dead |
| `retry-policy.test.ts` | schedule, jitter, last attempt |
| `dispatch.test.ts` | budget temps, batch, FOR UPDATE |

## Conventions

### Localisation

```ts
// Tests vivent À CÔTÉ du fichier source
src/components/admin/LoginForm.tsx
src/components/admin/LoginForm.test.tsx
```

### Pattern AAA (Arrange / Act / Assert)

```ts
it('renders error when status change fails with 409', async () => {
  // Arrange
  server.use(http.patch('*/leads/*/status', () =>
    HttpResponse.json({ error: 'conflict' }, { status: 409 })));
  render(<StatusMenu lead={lead} />);

  // Act
  await user.click(screen.getByRole('button', { name: 'Statut' }));
  await user.click(screen.getByText('Gagné'));

  // Assert
  expect(await screen.findByRole('alert')).toHaveTextContent(/transition/i);
});
```

### `userEvent.setup()` au début de chaque test

```ts
const user = userEvent.setup();
```

Plus rapide et déterministe que `fireEvent`.

### Pas de `act()` manuel

`@testing-library/react` enveloppe automatiquement.

### Pas de snapshot tests

Préférer des assertions explicites. Snapshots = régressions silencieuses
dès qu'un détail change.

## Exécution

```bash
pnpm test                      # toutes les specs
pnpm test --watch              # watch mode
pnpm test LoginForm            # filtre par nom
pnpm test --coverage           # rapport couverture
pnpm test:ui                   # Vitest UI (debug visuel)
```

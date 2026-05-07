# Tests d'intégration — MSW

[MSW v2](https://mswjs.io/) intercepte les appels HTTP au niveau
`fetch`/`XMLHttpRequest` (Node + browser). On l'utilise pour :

1. Tester les composants connectés à l'API admin **sans serveur réel**.
2. Tester le moteur de webhooks en simulant les **endpoints consommateurs**.
3. Tester les routes publiques en simulant les **handlers API**.

## Pourquoi MSW

| Alternative | Pourquoi rejeté |
|---|---|
| Mock manuel `vi.fn()` sur fetch | duplique le contrat d'API dans chaque test |
| Serveur Express de test | overhead, état partagé entre tests |
| Nock (interception HTTP) | API moins ergonomique, MSW v2 = standard |

MSW :
- partage les handlers entre Vitest et Playwright (même contrat),
- intercepte de façon déterministe (pas de course de network),
- fournit un seul endroit où décrire ce que l'API renvoie pour un cas.

## Architecture des handlers

```
apps/web/src/test/msw/
├── server.ts                    # setupServer() Vitest
├── browser.ts                   # setupWorker() Playwright (post-v1)
├── handlers/
│   ├── index.ts                 # exporte tous les handlers par défaut
│   ├── admin-auth.ts            # /api/admin/login, /logout, /session
│   ├── admin-leads.ts           # /api/admin/leads/*
│   ├── admin-webhooks.ts        # /api/admin/webhooks/*
│   ├── admin-deliveries.ts      # /api/admin/webhook-deliveries/*
│   ├── admin-kpi.ts             # /api/admin/kpi
│   ├── admin-cron.ts            # /api/cron/tick
│   ├── public-forms.ts          # /api/public/*
│   └── partner-webhook.ts       # endpoints externes (Slack-like)
└── factories/
    ├── lead.ts
    ├── webhook-endpoint.ts
    └── webhook-delivery.ts
```

## Convention par scénario

Chaque scénario MSW vit dans un fichier `.md` qui décrit **un seul cas
métier complet**. Le `.test.tsx` qui le consomme implémente exactement
cette description.

### Anatomie d'un scénario

```markdown
# scenario-{domaine}-{action}

| Aspect | Valeur |
|---|---|
| Composant testé | LoginForm |
| Niveau | intégration MSW |
| Fichier test | LoginForm.integration.test.tsx |

## Préconditions
- état initial : utilisateur non connecté

## Handlers MSW
- POST /api/admin/login → 200

## Action utilisateur
1. Saisir email valide
2. Saisir mot de passe valide
3. Cliquer "Se connecter"

## Assertions
- bouton désactivé pendant la requête
- redirection vers /admin/dashboard après succès
- toast de succès non affiché (redirect suffit)

## Edge cases couverts par d'autres scénarios
- 401 → scenario-login-failure
- 429 → scenario-login-rate-limit
```

## Catalogue des scénarios

### Auth (5)

| Scénario | Code |
|---|---|
| Login réussi | `scenario-login-success.md` |
| Login échec identifiants | `scenario-login-failure.md` |
| Login rate-limited | `scenario-login-rate-limit.md` |
| Session expirée pendant nav | `scenario-session-expired.md` |
| Logout | `scenario-logout.md` |

### Leads (10)

| Scénario | Code |
|---|---|
| Liste leads (page de chargement) | `scenario-leads-list.md` |
| Filtres URL synchronisés | `scenario-leads-filters.md` |
| Pagination cursor | `scenario-leads-pagination.md` |
| Recherche debounced | `scenario-leads-search.md` |
| Empty state | `scenario-leads-empty.md` |
| Export CSV | `scenario-leads-export-csv.md` |
| Détail lead | `scenario-lead-detail-load.md` |
| Changement statut succès | `scenario-lead-status-change.md` |
| Changement statut conflit | `scenario-lead-status-conflict.md` |
| Ajout note | `scenario-lead-note-add.md` |

### Webhooks (8)

| Scénario | Code |
|---|---|
| Liste endpoints | `scenario-webhooks-list.md` |
| Toggle actif/inactif | `scenario-webhooks-toggle.md` |
| Suppression | `scenario-webhooks-delete.md` |
| Création | `scenario-webhook-create.md` |
| Édition | `scenario-webhook-edit.md` |
| URL en conflit | `scenario-webhook-conflict.md` |
| Test endpoint | `scenario-webhook-test.md` |
| Rotation secret | `scenario-webhook-rotate.md` |

### Deliveries (5)

| Scénario | Code |
|---|---|
| Liste livraisons | `scenario-deliveries-list.md` |
| Filtre par statut | `scenario-deliveries-filter.md` |
| Détail dans drawer | `scenario-delivery-detail.md` |
| Renvoyer | `scenario-delivery-retry.md` |
| Renvoyer en conflit | `scenario-delivery-retry-conflict.md` |

### Webhook engine (7) — simulent des consommateurs externes

| Scénario | Code |
|---|---|
| Livraison succès 200 | `scenario-delivery-success.md` |
| 5xx puis succès au retry | `scenario-delivery-5xx.md` |
| Timeout → retry | `scenario-delivery-timeout.md` |
| 4xx considéré comme échec | `scenario-delivery-4xx.md` |
| Échec final dead-letter | `scenario-delivery-final-fail.md` |
| Replay manuel reset | `scenario-delivery-replay.md` |
| Vérification signature côté consommateur | `scenario-delivery-signature-check.md` |

### Cron (3)

| Scénario | Code |
|---|---|
| Tick batch normal | `scenario-cron-tick-batch.md` |
| Tick file vide | `scenario-cron-tick-empty.md` |
| Tick non autorisé | `scenario-cron-tick-unauthorized.md` |

### Public (5)

| Scénario | Code |
|---|---|
| Form contact valide | `scenario-public-contact.md` |
| Form order valide | `scenario-public-order.md` |
| Form newsletter valide | `scenario-public-newsletter.md` |
| Form sans consentement refusé | `scenario-public-no-consent.md` |
| Rate limit form | `scenario-public-rate-limit.md` |

### Rate limiting transverse (2)

| Scénario | Code |
|---|---|
| Login rate limit | `scenario-rate-limit-login.md` |
| Forms publics rate limit | `scenario-rate-limit-public.md` |

**Total : ~45 scénarios MSW**.

## Setup Vitest

```ts
// apps/web/vitest.setup.ts
import { server } from './src/test/msw/server';
import { beforeAll, afterAll, afterEach } from 'vitest';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` impose que **chaque** requête HTTP du
test soit explicitement mockée. Pas de mock implicite, pas de fuite vers
le réseau réel.

## Factories

Pour réduire la duplication :

```ts
// apps/web/src/test/msw/factories/lead.ts
import type { Lead } from '@/lib/db/schema';
import { createId } from '@/lib/crypto/ids';

export function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: createId(),
    type: 'contact',
    status: 'new',
    fullName: 'Leïla Bennani',
    email: 'leila@example.ma',
    phone: '+212 6 12 34 56 78',
    city: 'casablanca',
    source: 'form:contact',
    metadata: {},
    consentAt: new Date('2026-05-03T14:32:00Z'),
    createdAt: new Date('2026-05-03T14:32:00Z'),
    updatedAt: new Date('2026-05-03T14:32:00Z'),
    deletedAt: null,
    ...overrides,
  };
}
```

## Conventions de surcharge

Dans un test :

```ts
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

it('handles 401 from session endpoint', async () => {
  server.use(
    http.get('*/api/admin/session', () =>
      HttpResponse.json({ error: 'unauthorized' }, { status: 401 }),
    ),
  );
  // … render & assert
});
```

Le reset entre tests garantit l'isolation.

## Tests

Les scénarios sont eux-mêmes le test. Cf. catalogue ci-dessus.

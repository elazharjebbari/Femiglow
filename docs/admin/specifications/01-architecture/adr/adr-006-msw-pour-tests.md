# ADR-006 — MSW (Mock Service Worker) pour les tests d'intégration

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-03 |

## Contexte

Le projet teste actuellement des unités isolées avec Vitest +
@testing-library/react. Pour l'admin, la couverture nécessite :

- Tests de **flux complets** côté frontend (formulaires + appels API).
- Tests de **route handlers** sans démarrer un vrai serveur partenaire.
- Tests de **livraison webhook** sans dépendance externe.

Il existe trois grandes options pour mocker les requêtes HTTP :

1. **MSW (Mock Service Worker)** — intercepte au niveau du runtime
   (Node/browser) sans modifier le code applicatif.
2. **vi.mock('node-fetch')** ou patches `global.fetch` — bricolage,
   fragile, casse les types.
3. **nock** (Node only) — intercepte au niveau HTTP module, mature mais
   API peu ergonomique.

## Décision

Adopter **MSW v2** (mode Node pour Vitest, mode worker pour Playwright si
besoin). Tous les scénarios HTTP — appels frontend → API admin, et
appels webhook engine → partenaire — sont mockés via MSW.

## Organisation

```
apps/web/src/test/
├── msw/
│   ├── server.ts              ← setupServer() pour Node (Vitest)
│   ├── browser.ts             ← setupWorker() pour Playwright (optionnel)
│   ├── handlers/
│   │   ├── index.ts           ← combine tous les handlers
│   │   ├── admin-auth.ts      ← /api/admin/login, /logout
│   │   ├── admin-leads.ts     ← /api/admin/leads/*
│   │   ├── admin-webhooks.ts  ← /api/admin/webhooks/*
│   │   ├── admin-cron.ts      ← /api/admin/cron/webhook-tick
│   │   ├── public-forms.ts    ← /api/contact, /api/checkout, /api/newsletter
│   │   └── partner-webhook.ts ← URL configurable du partenaire
│   └── fixtures/
│       ├── leads.ts
│       ├── webhooks.ts
│       └── deliveries.ts
└── setup.ts                   ← import MSW, beforeAll/afterAll
```

## Conséquences

### Positives

- Code applicatif inchangé en test (pas de stubs intrusifs).
- Handlers réutilisables entre Vitest et Playwright.
- Possibilité de simuler des erreurs réseau, latence, statuts HTTP
  arbitraires.
- Compatible avec les tests d'intégration des Server Components
  (mockent les fetch internes du runtime Next.js).
- Maintenance unique des fixtures (pas de duplication test/dev).
- Documentation officielle riche, communauté active.

### Négatives

- Ajout de dépendance dev `msw@^2`.
- Légère courbe d'apprentissage (handlers, runtimes Node vs browser).
- En mode Node, certains comportements (Service Worker registration)
  ne s'appliquent pas — non bloquant pour notre usage.

## Couverture cible

Chaque endpoint API admin DOIT avoir au minimum :

1. **Happy path** — appel valide, session valide, retourne 2xx.
2. **Auth missing** — appel sans cookie → 401.
3. **Validation error** — body invalide → 400 avec issues Zod.
4. **DB failure** — Drizzle throws → 500 ou 503 selon nature.
5. **Edge case** — race condition, duplicate, empty result.

Liste exhaustive : voir
[`../../08-tests/integration-msw/scenarios.csv`](../../08-tests/integration-msw/scenarios.csv).

## Critères d'acceptation

- [ ] `pnpm test` lance Vitest avec MSW activé.
- [ ] Chaque scénario `scenario-*.md` du dossier `08-tests/integration-msw/`
      a son fichier `*.test.ts` qui passe.
- [ ] Aucun test ne fait de vrai appel réseau (vérifié par MSW
      `onUnhandledRequest: 'error'`).
- [ ] Couverture combinée Vitest + MSW ≥ 85 % sur `lib/auth`,
      `lib/webhooks`, `lib/db`, `app/api/admin`.

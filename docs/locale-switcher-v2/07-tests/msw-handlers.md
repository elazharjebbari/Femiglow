# MSW handlers — Locale Switcher V2

> Mocks réseau pour les tests **Vitest** (intégration) et, là où pertinent, pour le routing
> Playwright (`page.route`). Conformes au **CONTRACT** (`GET /api/i18n/config`,
> `GET/PUT /api/admin/i18n/config`, events §4) et aux invariants **INV-5 / INV-10 / INV-12**.
>
> Convention repo (cf. `apps/web/src/test/msw/legal-handlers.ts`) :
> - un module `*-handlers.ts` exporte une **factory** `i18nConfigHandlers(state)` + un objet
>   `i18nConfigScenarios` de variantes ponctuelles (`server.use(scenario())` override par test) ;
> - `onUnhandledRequest: 'error'` est actif (`src/test/setup/msw.setup.ts`) → **tout** appel réseau
>   du code testé doit avoir un handler, sinon le test échoue (anti-flakiness).
>
> Fichier cible : `apps/web/src/test/msw/i18n-config-handlers.ts` (+ `i18n-config-handlers.test.ts`
> pour tester les handlers eux-mêmes, comme `legal-handlers` le fait).

---

## 0. État partagé + config canonique

```ts
import { HttpResponse, http } from 'msw';

// Forme canonique = CONTRACT §3. Source unique pour les handlers "happy path".
export const CANONICAL_I18N_CONFIG = {
  locales: [
    { code: 'fr', enabled: true, endonym: 'Français', order: 1 },
    { code: 'ar', enabled: true, endonym: 'العربية', direction: 'rtl', order: 2 },
    { code: 'en', enabled: true, endonym: 'English', order: 3 },
  ],
  defaultLocale: 'fr',
  nudge: { enabled: true, maxImpressionsPerVisitor: 1 },
  surfaces: {
    header: { variant: 'dropdown' },
    drawer: { variant: 'pills' },
    footer: { variant: 'pills' },
  },
  transition: { durationMs: 280, easing: 'cubic-bezier(0.22,1,0.36,1)' },
} as const;

export interface I18nConfigState {
  config: unknown;          // ce que GET renvoie (peut être volontairement invalide)
  etag: string;             // pour le scénario conflit (If-Match)
  authed: boolean;          // simulate admin session pour les PUT
}

export const defaultI18nConfigState: I18nConfigState = {
  config: CANONICAL_I18N_CONFIG,
  etag: 'v1',
  authed: true,
};
```

---

## 1. `GET /api/i18n/config` — config publique (lecture sans auth, cachée)

Invariant config (CONTRACT §3) : **lisible sans auth**, **cachée**, et toute config invalide ⇒
**fallback défauts** côté loader (jamais d'écran cassé → INV-12).

```ts
export function i18nConfigHandlers(state = defaultI18nConfigState) {
  return [
    http.get('/api/i18n/config', () => {
      return HttpResponse.json(state.config, {
        // La config publique est cachée — le loader doit respecter ces headers.
        headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' },
      });
    }),
    // ...PUT admin (section 2)
  ];
}

export const i18nConfigScenarios = {
  // Variantes ponctuelles : `server.use(i18nConfigScenarios.invalid())`
  invalid: () =>
    http.get('/api/i18n/config', () =>
      // defaultLocale manquant + order négatif → schema.safeParse échoue
      HttpResponse.json({ locales: [{ code: 'fr', enabled: true, order: -1 }] }),
    ),
  malformedJson: () =>
    http.get('/api/i18n/config', () =>
      new HttpResponse('{"locales": [unclosed', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  empty: () =>
    http.get('/api/i18n/config', () => HttpResponse.json({})),
  singleLocale: () =>
    http.get('/api/i18n/config', () =>
      HttpResponse.json({
        ...CANONICAL_I18N_CONFIG,
        locales: [{ code: 'fr', enabled: true, endonym: 'Français', order: 1 }],
      }),
    ),
  arDisabled: () =>
    http.get('/api/i18n/config', () =>
      HttpResponse.json({
        ...CANONICAL_I18N_CONFIG,
        locales: CANONICAL_I18N_CONFIG.locales.map((l) =>
          l.code === 'ar' ? { ...l, enabled: false } : l,
        ),
      }),
    ),
  nudgeDisabled: () =>
    http.get('/api/i18n/config', () =>
      HttpResponse.json({
        ...CANONICAL_I18N_CONFIG,
        nudge: { enabled: false, maxImpressionsPerVisitor: 1 },
      }),
    ),
  serverError: () =>
    http.get('/api/i18n/config', () =>
      HttpResponse.json({ error: { code: 'internal' } }, { status: 500 }),
    ),
};
```

**Scénarios débloqués / liens plan :**

| Scénario | Réponse | Débloque (Vitest) | Débloque (Playwright) |
|---|---|---|---|
| happy path | 200 + config canonique | VU-57 (fetch sans auth + cache), VU-49..VU-51 (nudge) | PW-15..PW-18 (nudge), baseline switch |
| `invalid()` | 200 mais schema KO | VU-28, VU-58 (defaults), VU-31 | PW-38 (switcher sur défauts) |
| `malformedJson()` | 200 JSON cassé | VU-58 (safeParse fail → defaults) | — |
| `empty()` | 200 `{}` | VU-28/VU-32 (defaults) | — |
| `singleLocale()` | 200 1 locale | VU-29 (switcher null) | — |
| `arDisabled()` | 200 ar off | VU-30 | (manuel) |
| `nudgeDisabled()` | 200 nudge off | VU-54 | PW-18 voisin |
| `serverError()` | 500 | VU-56 (nudge safe), VU-58 | PW-38 (INV-12) |

> **Playwright** : pour PW-38 utiliser `page.route('**/api/i18n/config', r => r.fulfill({ status: 500 }))`
> (équivalent E2E du `serverError()` MSW). Même contrat, sink différent.

---

## 2. `PUT /api/admin/i18n/config` — écriture admin (auth + audit + concurrence)

CONTRACT §3 : écriture **admin-only + audit**. Codes : `200` (ok), `401` (non authentifié),
`422` (config invalide / schema), `409` (conflit d'optimistic concurrency via `If-Match`/etag).

```ts
// (dans i18nConfigHandlers, même module)
http.put('/api/admin/i18n/config', async ({ request }) => {
  if (!state.authed) {
    return HttpResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
  }
  const ifMatch = request.headers.get('If-Match');
  if (ifMatch && ifMatch !== state.etag) {
    return HttpResponse.json(
      { error: { code: 'conflict', current: state.etag } },
      { status: 409 },
    );
  }
  const body = await request.json().catch(() => null);
  const parsed = i18nConfigSchema.safeParse(body); // même schéma que le runtime
  if (!parsed.success) {
    return HttpResponse.json(
      { error: { code: 'validation', issues: parsed.error.issues } },
      { status: 422 },
    );
  }
  state.config = parsed.data;
  state.etag = `v${Number(state.etag.replace('v', '')) + 1}`;
  return HttpResponse.json(
    { ok: true, etag: state.etag, audit: { action: 'i18n.config.update' } },
    { status: 200, headers: { ETag: state.etag } },
  );
}),
```

Variantes :

```ts
// ajouter à i18nConfigScenarios
putUnauthorized: () =>
  http.put('/api/admin/i18n/config', () =>
    HttpResponse.json({ error: { code: 'unauthorized' } }, { status: 401 }),
  ),
putValidation: () =>
  http.put('/api/admin/i18n/config', () =>
    HttpResponse.json({ error: { code: 'validation' } }, { status: 422 }),
  ),
putConflict: () =>
  http.put('/api/admin/i18n/config', () =>
    HttpResponse.json({ error: { code: 'conflict', current: 'v9' } }, { status: 409 }),
  ),
```

**Scénarios débloqués :**

| Code | Réponse | Débloque | Invariant |
|---|---|---|---|
| 200 | ok + ETag + audit | tests admin save (couverture admin authz/audit) | INV-5 (admin-only path) |
| 401 | unauthorized | test admin guard (écriture refusée sans session) | INV-5 |
| 422 | validation | test admin rejette config invalide côté serveur | INV-12 |
| 409 | conflict | test admin gère l'édition concurrente (etag stale) | INV-12 |

> Le détail authz/audit complet relève de `06-admin` ; ici on fige uniquement le **contrat réseau**
> nécessaire aux tests d'intégration UI admin.

---

## 3. Sink analytics — events `locale_*` (CONTRACT §4)

Le code émet `locale_switch`, `locale_nudge_shown|accepted|dismissed`. En test on **capture** le
payload pour l'asserter, et on couvre le cas **sink en échec** (ne doit pas bloquer la bascule → INV-1).

```ts
export const capturedEvents: Array<{ name: string; payload: unknown }> = [];

export function analyticsSinkHandlers() {
  return [
    http.post('/api/track', async ({ request }) => {
      const body = (await request.json()) as { name: string; payload: unknown };
      capturedEvents.push(body);
      return HttpResponse.json({ ok: true });
    }),
  ];
}

export const analyticsScenarios = {
  // INV-1 : un sink 500 ne doit jamais casser la navigation.
  sinkError: () =>
    http.post('/api/track', () =>
      HttpResponse.json({ error: 'boom' }, { status: 500 }),
    ),
};

// reset entre tests (msw.setup resetHandlers ne vide pas ce tableau)
export const resetCapturedEvents = () => { capturedEvents.length = 0; };
```

> **Note de branchement** : si l'app émet les events via un client JS direct (`navigator.sendBeacon`
> ou `fetch` interne) plutôt qu'un endpoint, remplacer ce handler par un **spy** (`vi.fn()`) injecté
> dans `useLocaleTransition` / `LocaleNudge`. Adapter l'URL réelle une fois l'endpoint figé en
> `03-data/events-telemetry.json`. Le **shape** des payloads, lui, est figé par CONTRACT §4 et ne doit
> pas dévier.

**Scénarios débloqués :**

| Scénario | Débloque (Vitest) | Invariant |
|---|---|---|
| capture happy path | VU-43 (locale_switch vt), VU-44 (veil), VU-45 (reduced), VU-46 (reload) | INV-1 / INV-7 |
| capture nudge | VU-49 (shown), VU-50 (dismissed), VU-51 (accepted) | INV-12 |
| no-op silence | VU-47 (0 event sur langue active) | INV-11 |
| `sinkError()` | VU-48 (navigation aboutit malgré 500) | INV-1 / INV-12 |

---

## 4. Branchement type dans un test Vitest

```ts
import { server } from '@/test/msw/server';
import {
  i18nConfigHandlers, i18nConfigScenarios,
  analyticsSinkHandlers, capturedEvents, resetCapturedEvents,
} from '@/test/msw/i18n-config-handlers';

beforeEach(() => {
  resetCapturedEvents();
  server.use(...i18nConfigHandlers(), ...analyticsSinkHandlers());
});

it('VU-58 — config publique invalide ⇒ defaults', async () => {
  server.use(i18nConfigScenarios.malformedJson());   // override ponctuel
  const cfg = await loadPublicI18nConfig();
  expect(cfg).toEqual(DEFAULT_I18N_CONFIG);           // jamais throw (INV-12)
});

it('VU-48 — sink 500 ne bloque pas la bascule', async () => {
  server.use(analyticsScenarios.sinkError());
  await switchLocale('ar');                           // ne throw pas
  expect(document.documentElement.lang).toBe('ar');   // navigation a eu lieu
});
```

---

## 5. Récap traçabilité handler ↔ plan

| Handler | Vitest IDs | Playwright IDs | Invariants principaux |
|---|---|---|---|
| `GET /api/i18n/config` (200) | VU-49, VU-50, VU-51, VU-57 | PW-15, PW-16, PW-17 | INV-12 |
| `GET /api/i18n/config` (invalid/empty/malformed/500) | VU-28, VU-31, VU-56, VU-58 | PW-38 | INV-12 |
| `GET /api/i18n/config` (singleLocale/arDisabled/nudgeOff) | VU-29, VU-30, VU-54 | — | INV-12 |
| `PUT /api/admin/i18n/config` (200/401/422/409) | tests admin authz/audit | — | INV-5, INV-12 |
| Analytics sink (capture + 500) | VU-43..VU-48, VU-49..VU-51 | (events asserts via console/network) | INV-1, INV-7, INV-11, INV-12 |

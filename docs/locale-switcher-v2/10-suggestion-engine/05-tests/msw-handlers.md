# MSW handlers — Locale Suggestion Engine

> Mocks réseau pour les tests **Vitest** (intégration) du moteur de suggestion et, là où
> pertinent, pour le routing Playwright (`page.route`). Conformes au **CONTRACT §7**
> (`GET /api/i18n/config` section `i18n_suggestion_engine`, `GET/PUT /api/admin/i18n/config`,
> events §7.3) et aux invariants moteur **INV-13..INV-20**.
>
> Convention repo (cf. `apps/web/src/test/msw/i18n-config-handlers.ts` du plan de base) :
> - un module `*-handlers.ts` exporte une **factory** `suggestionEngineHandlers(state)` + un objet
>   `suggestionEngineScenarios` d'overrides ponctuels (`server.use(scenario())`) ;
> - `onUnhandledRequest: 'error'` est actif → tout appel réseau du code testé doit avoir un
>   handler, sinon le test échoue (anti-flakiness).
>
> Fichier cible : `apps/web/src/test/msw/suggestion-engine-handlers.ts`
> (+ `suggestion-engine-handlers.test.ts` pour tester les handlers eux-mêmes).
>
> **Garde-fou clé (CONTRACT §7.5)** : la section `engine` peut être **absente / invalide / off** ;
> dans tous ces cas le loader retombe sur **engine off** (INV-13). La **zone calme** (INV-14)
> n'est **jamais** pilotée par le réseau — c'est un plancher hard-codé côté politique, donc
> aucun handler ne peut la désactiver (un scénario `engineDisablesCheckout()` existe **uniquement**
> pour prouver que le runtime l'ignore).

---

## 0. État partagé + config moteur canonique

```ts
import { HttpResponse, http } from 'msw';
import { CANONICAL_I18N_CONFIG } from './i18n-config-handlers'; // réutilise le plan de base

// Section engine canonique = CONTRACT §7. ENGINE OFF PAR DÉFAUT (INV-13).
// Les profils sont des DONNÉES (INV-18). enabled défaut false pour chaque trigger.
export const CANONICAL_ENGINE_CONFIG = {
  engineEnabled: false,                      // INV-13 — off par défaut
  strategyWeights: { S1: 1.0, S2: 0.8, S3: 0.6, S4: 0.7, S5: 0.5, S7: 0.5 },
  geoTieBreak: false,                        // IP-geo jamais déclenchant (INV-20)
  highConfidenceThreshold: 0.6,
  neverProfiles: [
    // Plancher non désactivable (INV-14/15) — présent même si le réseau l'omet.
    { id: 'NEVER-CHECKOUT', kind: 'never', conditions: ['inCheckout'] },
    { id: 'NEVER-FORM', kind: 'never', conditions: ['formFocused', 'typing'] },
    { id: 'NEVER-DEEP-READ', kind: 'never', conditions: ['deepRead'] },
    { id: 'NEVER-FRESH', kind: 'never', conditions: ['freshUnder3s'] },
    { id: 'NEVER-FAST-SCROLL', kind: 'never', conditions: ['fastScroll'] },
    { id: 'NEVER-MODAL', kind: 'never', conditions: ['modalOpen'] },
    { id: 'NEVER-DISMISSED', kind: 'never', conditions: ['dismissedPersistent'] },
    { id: 'NEVER-BUDGET', kind: 'never', conditions: ['cooldownActive', 'capReached'] },
    { id: 'NEVER-SAME-LANG', kind: 'never', conditions: ['sameLangOrLowConf'] },
  ],
  triggerProfiles: [
    {
      id: 'TRIG-ENTRY-MISMATCH', kind: 'trigger', enabled: false, priority: 1,
      conditions: ['guessedNotServed', 'confidenceHigh'],
      minConfidence: 0.6, cooldownHours: 168, maxImpressions: 1,
      surface: 'pearl', opportuneMoment: ['scroll-pause', 'return-top'],
    },
    {
      id: 'TRIG-EXIT-RESCUE', kind: 'trigger', enabled: false, priority: 2,
      conditions: ['exitIntent', 'guessedNotServed'],
      minConfidence: 0.5, cooldownHours: 168, maxImpressions: 1,
      surface: 'toast', opportuneMoment: ['exit-intent'],
    },
    {
      id: 'TRIG-IDLE-BREAK', kind: 'trigger', enabled: false, priority: 3,
      conditions: ['idleShort', 'engaged'],
      minConfidence: 0.5, cooldownHours: 168, maxImpressions: 1,
      surface: 'pearl', opportuneMoment: ['idle-break'],
    },
  ],
} as const;

export interface EngineConfigState {
  engine: unknown;   // ce que GET renvoie dans i18n_suggestion_engine (peut être invalide)
  etag: string;
  authed: boolean;
}

export const defaultEngineConfigState: EngineConfigState = {
  engine: CANONICAL_ENGINE_CONFIG,
  etag: 'e1',
  authed: true,
};
```

---

## 1. `GET /api/i18n/config` — section moteur (lecture sans auth, cachée)

La config publique est **lisible sans auth** et **cachée**. La section `i18n_suggestion_engine`
est sérialisée dedans. Toute section **absente / invalide / off** ⇒ loader force **engine off**
(INV-13) — jamais d'affichage par erreur.

```ts
export function suggestionEngineHandlers(state = defaultEngineConfigState) {
  return [
    http.get('/api/i18n/config', () => {
      return HttpResponse.json(
        { ...CANONICAL_I18N_CONFIG, i18n_suggestion_engine: state.engine },
        { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
      );
    }),
    // ...PUT admin (section 3)
  ];
}

export const suggestionEngineScenarios = {
  // OFF par défaut — happy "no prompt" baseline (INV-13)
  engineOff: () =>
    http.get('/api/i18n/config', () =>
      HttpResponse.json({ ...CANONICAL_I18N_CONFIG, i18n_suggestion_engine: CANONICAL_ENGINE_CONFIG }),
    ),

  // ON + TRIG-ENTRY-MISMATCH activé (le seul moyen de voir un prompt)
  entryMismatchEnabled: () =>
    http.get('/api/i18n/config', () =>
      HttpResponse.json({
        ...CANONICAL_I18N_CONFIG,
        i18n_suggestion_engine: {
          ...CANONICAL_ENGINE_CONFIG,
          engineEnabled: true,
          triggerProfiles: CANONICAL_ENGINE_CONFIG.triggerProfiles.map((p) =>
            p.id === 'TRIG-ENTRY-MISMATCH' ? { ...p, enabled: true } : p,
          ),
        },
      }),
    ),

  // ON + TRIG-EXIT-RESCUE activé (desktop toast)
  exitRescueEnabled: () =>
    http.get('/api/i18n/config', () =>
      HttpResponse.json({
        ...CANONICAL_I18N_CONFIG,
        i18n_suggestion_engine: {
          ...CANONICAL_ENGINE_CONFIG,
          engineEnabled: true,
          triggerProfiles: CANONICAL_ENGINE_CONFIG.triggerProfiles.map((p) =>
            p.id === 'TRIG-EXIT-RESCUE' ? { ...p, enabled: true } : p,
          ),
        },
      }),
    ),

  // ON + custom trigger créé en admin (INV-18, sans redeploy)
  customTriggerEnabled: () =>
    http.get('/api/i18n/config', () =>
      HttpResponse.json({
        ...CANONICAL_I18N_CONFIG,
        i18n_suggestion_engine: {
          ...CANONICAL_ENGINE_CONFIG,
          engineEnabled: true,
          triggerProfiles: [
            ...CANONICAL_ENGINE_CONFIG.triggerProfiles,
            {
              id: 'TRIG-CUSTOM-X', kind: 'trigger', enabled: true, priority: 1,
              conditions: ['guessedNotServed', 'confidenceHigh'],
              minConfidence: 0.6, cooldownHours: 24, maxImpressions: 1,
              surface: 'pearl', opportuneMoment: ['scroll-pause'],
            },
          ],
        },
      }),
    ),

  // INVALIDE → loader doit forcer engine off (INV-13)
  invalidEngine: () =>
    http.get('/api/i18n/config', () =>
      HttpResponse.json({
        ...CANONICAL_I18N_CONFIG,
        // engineEnabled mauvais type + cooldown négatif + trigger sans id
        i18n_suggestion_engine: {
          engineEnabled: 'yes',
          triggerProfiles: [{ enabled: true, cooldownHours: -5 }],
        },
      }),
    ),

  // SECTION ABSENTE → engine off (INV-13)
  engineMissing: () =>
    http.get('/api/i18n/config', () => HttpResponse.json({ ...CANONICAL_I18N_CONFIG })),

  // ADVERSAIRE : config tente de désactiver le plancher checkout → DOIT être ignorée (INV-14)
  engineDisablesCheckout: () =>
    http.get('/api/i18n/config', () =>
      HttpResponse.json({
        ...CANONICAL_I18N_CONFIG,
        i18n_suggestion_engine: {
          ...CANONICAL_ENGINE_CONFIG,
          engineEnabled: true,
          neverProfiles: CANONICAL_ENGINE_CONFIG.neverProfiles.filter(
            (p) => p.id !== 'NEVER-CHECKOUT' && p.id !== 'NEVER-FORM',
          ), // checkout/form retirés volontairement
          triggerProfiles: CANONICAL_ENGINE_CONFIG.triggerProfiles.map((p) =>
            p.id === 'TRIG-ENTRY-MISMATCH' ? { ...p, enabled: true } : p,
          ),
        },
      }),
    ),

  serverError: () =>
    http.get('/api/i18n/config', () =>
      HttpResponse.json({ error: { code: 'internal' } }, { status: 500 }),
    ),
};
```

**Scénarios débloqués / liens plan :**

| Scénario | Réponse | Débloque (Vitest) | Débloque (Playwright) | Invariant |
|---|---|---|---|---|
| `engineOff()` (défaut) | 200 engine off | SE-VU-73, SE-VU-82 | SE-PW-01, SE-PW-02, SE-PW-03 | INV-13 |
| `entryMismatchEnabled()` | 200 trigger on | SE-VU-74, SE-VU-75, SE-VU-76, SE-VU-78 | SE-PW-04..PW-07, PW-09, PW-13, PW-16..PW-22, PW-31..PW-34 | INV-17/16/20 |
| `exitRescueEnabled()` | 200 exit trigger on | SE-VU-80 (rm), events | SE-PW-26, PW-27, PW-28, PW-35 | INV-17/20 |
| `customTriggerEnabled()` | 200 custom on | SE-VU-45 (jeu de données) | SE-PW-40, PW-41 | INV-18 |
| `invalidEngine()` | 200 schema KO | SE-VU-59, SE-VU-83 | SE-PW-43 voisin | INV-13 |
| `engineMissing()` | 200 sans section | SE-VU-21, SE-VU-65 | SE-PW-01 | INV-13 |
| `engineDisablesCheckout()` | 200 plancher retiré | SE-VU-60, SE-VU-61, SE-VU-81 | SE-PW-11 | INV-14 |
| `serverError()` | 500 | SE-VU-83 (defaults off) | SE-PW-43 voisin | INV-13 |

> **Playwright** : équivalents via `page.route('**/api/i18n/config', r => r.fulfill(...))`.
> Pour `entryMismatchEnabled` en E2E, fulfill avec le même JSON. La langue d'accès se contrôle
> via `Accept-Language` (`context({ locale, extraHTTPHeaders })`) et le cookie `NEXT_LOCALE`.

---

## 2. Sink analytics — events `locale_suggestion_*` (CONTRACT §7.3)

Le moteur émet **5 events** : `locale_suggestion_evaluated`, `_shown`, `_accepted`,
`_dismissed`, `_suppressed`. En test on **capture** le payload pour l'asserter (shape figée §7.3),
et on couvre le **sink en échec** (ne doit jamais bloquer la bascule via `useLocaleTransition` → INV-20/INV-1).

```ts
export const capturedSuggestionEvents: Array<{ name: string; payload: any }> = [];

export function suggestionAnalyticsHandlers() {
  return [
    http.post('/api/track', async ({ request }) => {
      const body = (await request.json()) as { name: string; payload: any };
      // ne capturer que les events moteur (laisse passer les autres en happy 200)
      if (typeof body?.name === 'string' && body.name.startsWith('locale_suggestion')) {
        capturedSuggestionEvents.push(body);
      }
      return HttpResponse.json({ ok: true });
    }),
  ];
}

export const suggestionAnalyticsScenarios = {
  // INV-20/INV-1 : un sink 500 ne casse ni l'évaluation ni la bascule à l'accept.
  sinkError: () =>
    http.post('/api/track', () => HttpResponse.json({ error: 'boom' }, { status: 500 })),
};

export const resetCapturedSuggestionEvents = () => { capturedSuggestionEvents.length = 0; };
```

Shapes attendues (assertions, CONTRACT §7.3) :

```ts
// evaluated (audit/debug, échantillonnable)
{ name: 'locale_suggestion_evaluated',
  payload: { suggested, served, decision: 'show'|'suppress', reason, profileMatched, page } }
// shown
{ name: 'locale_suggestion_shown',
  payload: { suggested, served, profileMatched, page, trigger } }
// accepted
{ name: 'locale_suggestion_accepted',
  payload: { suggested, page, msToDecision } }
// dismissed
{ name: 'locale_suggestion_dismissed',
  payload: { suggested, page, scope: 'session'|'persistent' } }
// suppressed (NB: neverProfile present pour les zones calmes, null sinon)
{ name: 'locale_suggestion_suppressed',
  payload: { suggested, served, reason, neverProfile, page } }
```

**Scénarios débloqués :**

| Scénario | Débloque (Vitest) | Débloque (Playwright) | Invariant |
|---|---|---|---|
| capture `evaluated` | SE-VU-66, SE-VU-68 | SE-PW-38 (audit) | INV-19 |
| capture `shown` | SE-VU-69 | SE-PW-37, SE-PW-44 | INV-19 |
| capture `accepted` | SE-VU-70 | SE-PW-44 | INV-19/20 |
| capture `dismissed` | SE-VU-71, SE-VU-72 | SE-PW-16 | INV-16/19 |
| capture `suppressed` + neverProfile | SE-VU-67 | SE-PW-39, SE-PW-45 | INV-19/14 |
| `sinkError()` | SE-VU-76 (accept aboutit malgré 500) | — | INV-20/INV-1 |

> **Note de branchement** : si les events partent via `navigator.sendBeacon` / client interne,
> remplacer ce handler par un **spy** (`vi.fn()`) injecté dans `useLocaleSuggestionEngine`.
> Le **shape** des payloads reste figé par CONTRACT §7.3.

---

## 3. `PUT /api/admin/i18n/config` — écriture admin moteur (auth + audit + validation)

CONTRACT §3/§7 : écriture **admin-only + audit**. Codes : `200` (ok + audit + etag),
`401` (non authentifié), `422` (section moteur invalide / schema). Permet de tester l'activation
de profils **sans redeploy** (INV-18) et la traçabilité (INV-19).

```ts
// (dans suggestionEngineHandlers, même module)
http.put('/api/admin/i18n/config', async ({ request }) => {
  if (!state.authed) {
    return HttpResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = engineConfigSchema.safeParse((body as any)?.i18n_suggestion_engine);
  if (!parsed.success) {
    return HttpResponse.json(
      { error: { code: 'validation', issues: parsed.error.issues } },
      { status: 422 },
    );
  }
  // Plancher zones calmes ré-injecté côté serveur même si le payload l'omet (INV-14).
  state.engine = normalizeEngineConfig(parsed.data); // force NEVER-CHECKOUT/FORM
  state.etag = `e${Number(state.etag.replace('e', '')) + 1}`;
  return HttpResponse.json(
    { ok: true, etag: state.etag, audit: { action: 'i18n.engine.update' } },
    { status: 200, headers: { ETag: state.etag } },
  );
}),
```

Variantes :

```ts
// ajouter à suggestionEngineScenarios
putEngineUnauthorized: () =>
  http.put('/api/admin/i18n/config', () =>
    HttpResponse.json({ error: { code: 'unauthorized' } }, { status: 401 }),
  ),
putEngineValidation: () =>
  http.put('/api/admin/i18n/config', () =>
    HttpResponse.json({ error: { code: 'validation' } }, { status: 422 }),
  ),
```

**Scénarios débloqués :**

| Code | Réponse | Débloque (Vitest) | Débloque (Playwright) | Invariant |
|---|---|---|---|---|
| 200 | ok + ETag + audit | SE-VU-84 | SE-PW-40, PW-42 | INV-18/19 |
| 401 | unauthorized | SE-VU-85 | (admin guard) | INV-18 |
| 422 | validation | SE-VU-86 | SE-PW-43 | INV-18/13 |

> Le détail authz/audit complet relève de l'onglet admin « Moteur » ; ici on fige le **contrat réseau**
> nécessaire aux tests d'intégration. Le plancher zones calmes est ré-imposé par `normalizeEngineConfig`,
> jamais désactivable par le payload (CONTRACT §7.5).

---

## 4. Branchement type dans un test Vitest

```ts
import { server } from '@/test/msw/server';
import {
  suggestionEngineHandlers, suggestionEngineScenarios,
  suggestionAnalyticsHandlers, suggestionAnalyticsScenarios,
  capturedSuggestionEvents, resetCapturedSuggestionEvents,
} from '@/test/msw/suggestion-engine-handlers';

beforeEach(() => {
  resetCapturedSuggestionEvents();
  server.use(...suggestionEngineHandlers(), ...suggestionAnalyticsHandlers());
});

it('SE-VU-73 — engine off par défaut ⇒ aucun prompt, suppress engine-off', async () => {
  // défaut = engineOff ; guessed ar / served fr
  renderEngine({ servedLocale: 'fr', guessedLocale: 'ar', confidence: 0.9 });
  await advanceToBreakpoint();
  expect(screen.queryByRole('dialog', { name: /العربية/ })).toBeNull();
  expect(capturedSuggestionEvents).toContainEqual(
    expect.objectContaining({
      name: 'locale_suggestion_evaluated',
      payload: expect.objectContaining({ decision: 'suppress', reason: 'engine-off' }),
    }),
  );
});

it('SE-VU-81 — checkout supprime même trigger armé (zone calme)', async () => {
  server.use(suggestionEngineScenarios.entryMismatchEnabled());
  renderEngine({ servedLocale: 'fr', guessedLocale: 'ar', confidence: 0.9, inCheckout: true });
  await advanceToBreakpoint();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(capturedSuggestionEvents).toContainEqual(
    expect.objectContaining({
      name: 'locale_suggestion_suppressed',
      payload: expect.objectContaining({ neverProfile: 'NEVER-CHECKOUT' }),
    }),
  );
});

it('SE-VU-76 — sink 500 ne bloque pas l\'accept (no-reload)', async () => {
  server.use(suggestionEngineScenarios.entryMismatchEnabled(), suggestionAnalyticsScenarios.sinkError());
  renderEngine({ servedLocale: 'fr', guessedLocale: 'ar', confidence: 0.9 });
  await advanceToBreakpoint();
  await userEvent.click(screen.getByRole('button', { name: /العربية/ }));
  expect(document.documentElement.lang).toBe('ar'); // useLocaleTransition a basculé
});
```

---

## 5. Récap traçabilité handler ↔ plan

| Handler | Vitest IDs | Playwright IDs | Invariants principaux |
|---|---|---|---|
| `GET /config` engine off (défaut) | SE-VU-21, SE-VU-65, SE-VU-73, SE-VU-82 | SE-PW-01..PW-03, PW-38 | INV-13 |
| `GET /config` trigger(s) enabled | SE-VU-74..SE-VU-80 | SE-PW-04..PW-22, PW-26..PW-36 | INV-17/16/20 |
| `GET /config` custom trigger | SE-VU-45 | SE-PW-40, PW-41 | INV-18 |
| `GET /config` invalid/missing/500 | SE-VU-59, SE-VU-83 | SE-PW-43 | INV-13 |
| `GET /config` disables-checkout (adversaire) | SE-VU-60, SE-VU-61, SE-VU-81 | SE-PW-11 | INV-14 |
| Analytics sink (5 events + 500) | SE-VU-66..SE-VU-72, SE-VU-76 | SE-PW-37..PW-39, PW-44, PW-45 | INV-19/20 |
| `PUT /admin/config` (200/401/422) | SE-VU-84..SE-VU-86 | SE-PW-40, PW-42, PW-43 | INV-18/19/13 |

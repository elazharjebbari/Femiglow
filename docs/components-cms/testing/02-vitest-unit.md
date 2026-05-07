# T2 — Tests unitaires Vitest

> Patterns et exemples concrets pour la couche unitaire : resolver
> de cascade, encoders, validators Zod, sanitization, cron de
> promotion. Cible ≥ 85 % de coverage (cf. T1).

## Setup

Vitest est déjà configuré au niveau du monorepo. Pas de bootstrap
spécifique pour les tests CMS — on suit les conventions existantes
(cf. `apps/web/vitest.config.ts`).

### Mock de `next/cache`

Pour rester déterministe, on neutralise `unstable_cache` et on espionne
`revalidateTag`. Pattern standard du projet (cf. `resolver.test.ts`) :

```ts
vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
  revalidateTag: vi.fn(),
}));
```

### Reset DB in-memory

```ts
import { resetMemoryStore } from '@/lib/db/client';

beforeEach(() => {
  resetMemoryStore();
});
```

`createInMemoryStore()` (du même module) fabrique un store frais —
utile dans les tests parallèles qui ne veulent pas du singleton global.

### Mock du temps

```ts
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-05T10:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});
```

Indispensable pour `scheduledAt`, `publishedAt`, `updatedAt`. **Tout
test qui touche à un timestamp doit poser `setSystemTime`.**

## Convention AAA

Chaque test :

```ts
it('résout un binding publié plutôt que le defaultValue', async () => {
  // Arrange
  const seed: SiteComponentSeed = { /* … */ fields: [{ key: 'title', type: 'text', required: true, defaultValue: 'Default' }] };
  const c = await upsertSiteComponentFromSeed(seed);
  await upsertFieldBinding({ componentId: c.id, fieldKey: 'title', status: 'published', value: { v: 'Override' }, version: 1, locale: 'fr' });

  // Act
  const resolved = await resolveComponentField('home-hero', 'title', 'fr');

  // Assert
  expect(resolved.value).toBe('Override');
  expect(resolved.meta.source).toBe('binding');
});
```

> **Pas plus d'un appel `act` par test.** Si un test enchaîne 3
> mutations, c'est trois tests.

## Cascade — un test par EC (A3)

Un fichier dédié `cascade.test.ts`. **Chaque EC est un `describe`** ;
chaque branche est un `it`.

```ts
describe('cascade — EC1 champ supprimé du registre', () => {
  it('ignore un binding publié dont le fieldKey n\'est plus dans le registre', async () => {
    // Arrange : seed v1 avec field 'kicker', binding publié, puis re-seed sans 'kicker'
    const seedV1 = makeSeed({ key: 'home-hero', fields: [{ key: 'kicker', type: 'text' }, { key: 'title', type: 'text' }] });
    const c = await upsertSiteComponentFromSeed(seedV1);
    await upsertFieldBinding({ componentId: c.id, fieldKey: 'kicker', status: 'published', value: { v: 'Notre rituel' } });
    const seedV2 = makeSeed({ key: 'home-hero', fields: [{ key: 'title', type: 'text' }] });
    await upsertSiteComponentFromSeed(seedV2);

    // Act
    const fields = await resolveComponentFields('home-hero', 'fr');

    // Assert
    expect(fields.kicker).toBeUndefined();
    expect(Object.keys(fields)).toEqual(['title']);
  });
});

describe('cascade — EC2 champ ajouté', () => {
  it('retombe sur defaultValue quand aucun binding n\'existe', async () => { /* … */ });
});

describe('cascade — EC3 type changé', () => {
  it('lève une erreur de migration si le type d\'un field change pour une key existante', async () => {
    await expect(upsertSiteComponentFromSeed(seedWithChangedType)).rejects.toThrow(/type change forbidden/);
  });
});

describe('cascade — EC4 locale absente', () => {
  it('fallback sur fr si la locale demandée n\'a pas de binding', async () => { /* … */ });
});

describe('cascade — EC5 cache stale', () => {
  it('appelle revalidateTag après publish', async () => {
    // (testé aussi en intégration ; ici on vérifie le call côté service)
  });
});

describe('cascade — EC6 race two drafts', () => {
  it('rejette le second update avec If-Match obsolète', async () => { /* … */ });
});

describe('cascade — EC7 binding orphelin', () => {
  it('supprime les bindings et l\'history quand le composant est supprimé (CASCADE)', async () => { /* … */ });
});

describe('cascade — EC8 fuseau horaire scheduledAt', () => {
  it('stocke l\'heure en UTC indépendamment du fuseau client', async () => {
    vi.setSystemTime(new Date('2026-03-15T07:00:00Z'));
    // Le client envoie '2026-03-15T08:00:00+01:00' (Paris) → DB doit voir 07:00 UTC
  });
});
```

## Invariants — un test par I (A2)

```ts
describe('invariants', () => {
  it('I1 — au plus un binding published par triplet', async () => {
    await upsertFieldBinding({ componentId, fieldKey: 'title', locale: 'fr', status: 'published', value: { v: 'A' } });
    await expect(
      upsertFieldBinding({ componentId, fieldKey: 'title', locale: 'fr', status: 'published', value: { v: 'B' } })
    ).rejects.toThrow(/unique/i);
  });

  it('I2 — au plus un binding draft par triplet', async () => { /* … */ });
  it('I3 — version strictement croissant par triplet', async () => { /* … */ });
  it('I4 — scheduledAt requis si status=scheduled', async () => { /* … */ });
  it('I5 — publishedAt set par le serveur, ignoré du payload client', async () => { /* … */ });
  it('I6 — defaultValue absent + required → resolver dev placeholder', async () => { /* … */ });
  it('I7 — pas de DELETE physique, archive uniquement', async () => { /* … */ });
});
```

## Encoders / Decoders

Le format jsonb (cf. A2 §Encodage) est encapsulé dans
`fields/encoders.ts`. **C'est l'endroit où le snapshot Vitest est
légitime** — on fige le shape jsonb pour détecter une régression de
format.

```ts
import { encodeFieldValue, decodeFieldValue } from './encoders';

describe('encoders', () => {
  it('encode text dans { v: string }', () => {
    expect(encodeFieldValue('text', 'Hello')).toMatchInlineSnapshot(`{ "v": "Hello" }`);
  });

  it('encode cta dans la forme typée', () => {
    expect(encodeFieldValue('cta', { label: 'Découvrir', href: '/rituel', variant: 'primary' }))
      .toMatchInlineSnapshot(`{ "label": "Découvrir", "href": "/rituel", "variant": "primary" }`);
  });

  it('round-trip text', () => {
    const encoded = encodeFieldValue('text', 'Hello');
    expect(decodeFieldValue('text', encoded)).toBe('Hello');
  });

  it('round-trip list of cta', () => {
    const list = [{ label: 'A', href: '/a' }, { label: 'B', href: '/b' }];
    const encoded = encodeFieldValue('list', list, { itemType: 'cta' });
    expect(decodeFieldValue('list', encoded, { itemType: 'cta' })).toEqual(list);
  });
});
```

> **Limiter les snapshots aux jsonb encodés.** Pas de snapshot HTML,
> pas de snapshot d'objet métier complet : on perd la lisibilité.

## Validators Zod — pas de mock

> **Règle dure** : on ne mocke jamais Zod. On teste la vraie
> validation. C'est l'un des rares endroits où on accepte la
> duplication de logique entre test et code.

```ts
import { ctaSchema } from './validators';

describe('validators — cta', () => {
  it('accepte un href relatif', () => {
    expect(ctaSchema.safeParse({ label: 'A', href: '/rituel' }).success).toBe(true);
  });

  it('rejette un href javascript:', () => {
    const r = ctaSchema.safeParse({ label: 'A', href: 'javascript:alert(1)' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/href/i);
  });

  it('rejette un href HTTP non-allowlisted', () => {
    const r = ctaSchema.safeParse({ label: 'A', href: 'https://evil.com' });
    expect(r.success).toBe(false);
  });

  it('accepte un href HTTPS allowlisted (instagram.com)', () => {
    expect(ctaSchema.safeParse({ label: 'A', href: 'https://instagram.com/femiglow' }).success).toBe(true);
  });
});
```

## Sanitization rich-text

Tests dédiés sur `sanitizeRichText()`. **Couvre A6 §XSS.**

```ts
describe('sanitizeRichText', () => {
  it('autorise h2/h3/p/ul/li/strong/em/a/blockquote', () => {
    const html = '<h2>T</h2><p>Texte <strong>fort</strong></p>';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it('strip <script>', () => {
    expect(sanitizeRichText('<p>x<script>alert(1)</script></p>')).toBe('<p>x</p>');
  });

  it('strip <iframe>, <img>, <style>', () => {
    expect(sanitizeRichText('<iframe src="x"></iframe>')).toBe('');
    expect(sanitizeRichText('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('strip on* attributes', () => {
    expect(sanitizeRichText('<p onclick="x">a</p>')).toBe('<p>a</p>');
  });

  it('strip href="javascript:"', () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
  });

  it('flag substantial-diff comme tentative (signal log)', () => {
    const result = sanitizeRichTextWithDiff('<script>x</script>'.repeat(50));
    expect(result.diffRatio).toBeGreaterThan(0.5);
    expect(result.flagged).toBe(true);
  });
});
```

## Service de publication

`publishFieldBinding()` est le cœur du workflow A4. On teste **chaque
transition** + **chaque erreur E1–E5**.

```ts
describe('publishFieldBinding', () => {
  it('promeut draft → published, archive l\'ancien published, history x2', async () => {
    // Arrange : un published v1 + un draft
    // Act : publish(draft.id)
    // Assert : draft devient published v2, ancien published devient archived,
    //          2 lignes history (publish nouvelle, archive ancienne)
  });

  it('E1 — 409 sur If-Match obsolète', async () => {
    const draft = await upsertFieldBinding({ /* … */ });
    const stale = draft.updatedAt;
    await touchBinding(draft.id); // simule autre admin
    await expect(publishFieldBinding(draft.id, { ifMatch: stale })).rejects.toMatchObject({ code: 'conflict.stale_version' });
  });

  it('E2 — 409 si le field a été retiré du registre entre temps', async () => {
    const draft = await upsertFieldBinding({ fieldKey: 'kicker', /* … */ });
    await reseedWithoutKicker();
    await expect(publishFieldBinding(draft.id)).rejects.toMatchObject({ code: 'field.removed_from_registry' });
  });
});

describe('scheduleFieldBinding', () => {
  it('E3 — rejette scheduledAt < now() + 1min', async () => {
    vi.setSystemTime(new Date('2026-05-05T10:00:00Z'));
    await expect(scheduleFieldBinding(draft.id, new Date('2026-05-05T10:00:30Z')))
      .rejects.toMatchObject({ code: 'schedule.in_past' });
  });
});

describe('restoreFromHistory', () => {
  it('crée un nouveau draft avec la valeur du snapshot', async () => { /* … */ });

  it('E4 — 409 si le field a été supprimé du registre', async () => {
    await expect(restoreFromHistory({ historyId, /* field gone */ }))
      .rejects.toMatchObject({ code: 'field.removed_from_registry' });
  });
});
```

## Cron de promotion — idempotence (E5)

```ts
describe('promoteScheduledFields (cron)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T08:00:00Z'));
  });

  it('promeut les bindings scheduled dont scheduledAt <= now()', async () => {
    await upsertFieldBinding({ status: 'scheduled', scheduledAt: new Date('2026-03-15T07:59:00Z') });
    const result = await promoteScheduledFields();
    expect(result.promoted).toBe(1);
  });

  it('ignore les bindings scheduled dans le futur', async () => {
    await upsertFieldBinding({ status: 'scheduled', scheduledAt: new Date('2026-03-15T08:01:00Z') });
    const result = await promoteScheduledFields();
    expect(result.promoted).toBe(0);
  });

  it('E5 — idempotent : deux runs simultanés ne promeuvent qu\'une fois', async () => {
    const binding = await upsertFieldBinding({ status: 'scheduled', scheduledAt: new Date('2026-03-15T07:00:00Z') });
    const [r1, r2] = await Promise.all([promoteScheduledFields(), promoteScheduledFields()]);
    expect(r1.promoted + r2.promoted).toBe(1); // un seul a vraiment promu
    const reloaded = await getFieldBinding(binding.id);
    expect(reloaded.status).toBe('published');
    expect(reloaded.version).toBe(1);
  });

  it('signal field.schedule.failed si la validation Zod échoue', async () => {
    // valeur stockée dans scheduled, mais le registre a changé son schéma entre-temps
    const log = vi.spyOn(logger, 'info');
    await promoteScheduledFields();
    expect(log).toHaveBeenCalledWith('field.schedule.failed', expect.objectContaining({ /* … */ }));
  });
});
```

## Resolver `resolveComponentFields` (pluriel)

```ts
describe('resolveComponentFields', () => {
  it('un seul SELECT pour N fields', async () => {
    const spy = vi.spyOn(memoryStore.fieldBindings, 'list');
    await resolveComponentFields('home-hero', 'fr');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('mappe par fieldKey, ordre du registre respecté', async () => { /* … */ });

  it('cache hit < 1ms (deuxième appel)', async () => {
    // Avec unstable_cache mocké, on vérifie qu'on n'appelle pas listPublishedBindings deux fois
  });
});
```

## Diagnostic

```ts
describe('diagnoseComponentFields', () => {
  it('reporte source=binding pour les fields ayant un binding publié', async () => { /* … */ });
  it('reporte source=default pour les fields sans binding', async () => { /* … */ });
  it('counts: published, draft, scheduled, archived corrects', async () => { /* … */ });
});
```

## Liste des fichiers attendus

| Fichier | Couvre |
|---|---|
| `lib/components/fields/cascade.test.ts` | EC1–EC8 (8 describes) |
| `lib/components/fields/resolver.test.ts` | resolveComponentField/Fields, cache, diagnose |
| `lib/components/fields/encoders.test.ts` | encode/decode + snapshots jsonb |
| `lib/components/fields/validators.test.ts` | tous les types (text, cta, link, icon, color-token, …) |
| `lib/components/fields/sanitize.test.ts` | XSS rich-text |
| `lib/components/fields/publish-service.test.ts` | A4 transitions + E1–E5 |
| `lib/components/fields/cron-promote.test.ts` | E5 idempotence |
| `lib/db/queries/component-fields.test.ts` | I1–I7 invariants DB |

## Cross-références

- A2 §Invariants, A3 §Edge cases, A4 §Erreurs, A6 §Tests sécurité.
- B2 (schémas Zod), B3 (cache + revalidate).
- T1 §Cibles de couverture.
- T3 (intégration MSW), T4 (RTL), T5 (Playwright), T6 (matrice composants).

# Testing — Stratégie

## Pyramide

```
                  ┌─────────────────┐
                  │   Playwright    │   ~6 scénarios
                  │   (e2e admin)   │
                  └─────────────────┘
              ┌─────────────────────────┐
              │   RTL composants admin   │   ~12 fichiers
              │   (SerpPreview, FB, …)   │
              └─────────────────────────┘
        ┌───────────────────────────────────┐
        │   Vitest unit                      │   ~30 fichiers
        │   (resolve, linter, queries Zod)   │
        └───────────────────────────────────┘
```

Cible coverage : **85%** sur `apps/web/src/lib/seo/**` et
**70%** sur `apps/web/src/components/admin/seo/**`.

## Couches testées

### 1. `resolveSeoMetadata()` (unit, Vitest)

- Cascade complète (defaults → settings → override)
- Fallback si champ override absent
- `noindex` exclut bien du sitemap
- Cache `unstable_cache` invalidé par tag
- Error path : DB down → renvoie defaults sans throw

### 2. Linter (unit, Vitest)

Fixtures : 10 cas couvrant chaque règle.

- title trop long / trop court / vide
- description trop longue / vide
- keywords > 20 / vide / valides
- canonical absolue / relative / invalide
- robots `noindex` + dans `known_pages`
- JSON-LD valide / invalide / vide
- OG image présente / absente / dimensions ko

### 3. Queries Drizzle (unit, Vitest avec PG-mem ou testcontainers)

- `getOverride` retourne null si absent
- `upsertOverride` UNIQUE constraint respectée
- `publishOverride` crée snapshot + set `published_at`
- `restoreSnapshot` réinitialise le draft sans publier

### 4. Routes API (unit, Vitest avec MSW + supertest)

- 401/403/404/422/429 paths
- Audit log écrit
- `revalidateTag` appelé après mutation
- `If-Match` optimistic lock (si retenu)

### 5. Composants admin (RTL)

- `SerpPreview` rend les bonnes troncatures (60 / 160)
- `FacebookPreview` rend l'image OG fallback si absente
- `TwitterPreview` switch `summary` ↔ `summary_large_image`
- `SeoEditor` save optimiste + dirty tracking
- Linter panel : compteurs sévérité, click highlight champ

### 6. Parcours e2e (Playwright)

Cf. [`03-playwright-scenarios.md`](./03-playwright-scenarios.md).

## Non-tests (volontairement)

- Le rendu pixel-perfect des previews (visual regression hors scope v1)
- La validité Schema.org de chaque type (test de Google rich-results
  trop coûteux ; on se contente du parse JSON + check `@context`)
- L'OG render edge runtime (testé manuellement, pas en CI faute de
  satellite edge dans GitHub Actions)

## Fixtures

- `apps/web/src/lib/seo/__fixtures__/overrides.ts` — 10 overrides type
- `apps/web/src/lib/seo/__fixtures__/lint-cases.ts` — 10 cas linter
- `apps/web/test/fixtures/seo-snapshots.ts` — snapshots restorables

## Règle d'or

Chaque PR qui touche la cascade ou le linter ajoute au moins 1 cas
fixture documenté (input → expected output). Pas de tests
« généralistes » non commentés — un test = un comportement nommé.

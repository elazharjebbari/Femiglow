# Frontend — Linter / Audit SEO

Le linter calcule un **score audit** (0-100) et une **liste d'issues**
(severity = `error | warning | info`) pour chaque override.

## Architecture

```
┌──────────────┐    candidate     ┌───────────────────────┐
│ Editor UI    │  ─────────────►  │ POST /api/admin/seo/  │
│              │                  │ audit                 │
│ (debounce)   │  ◄───── report   └───────────┬───────────┘
└──────────────┘                              │
                                              ▼
                                 ┌───────────────────────────┐
                                 │ runLinter(resolved)       │
                                 │ + runJsonLdValidator(...) │
                                 │ + (optional) HEAD canonical│
                                 └───────────────────────────┘
```

- Côté client : appel debouncé (350 ms) à chaque modif
- Côté serveur : pure logic, pas d'effet, < 30 ms hors fetch HTTP

## Règles

| Code                       | Sévérité | Détail |
|----------------------------|----------|--------|
| `title.empty`              | error    | title obligatoire (sauf si default codé existe) |
| `title.too-long`           | warning  | > 60 chars (tronque en SERP) |
| `title.too-short`          | info     | < 30 chars |
| `description.empty`        | error    | description obligatoire |
| `description.too-long`     | warning  | > 160 chars |
| `description.too-short`    | info     | < 80 chars |
| `keywords.too-many`        | warning  | > 20 entrées |
| `og.image.missing`         | warning  | aucune `ogImage` ni template ni default |
| `og.image.dimensions`      | warning  | image < 1200×630 |
| `canonical.relative`       | error    | URL non absolue |
| `canonical.protocol`       | error    | protocole ≠ http/https |
| `canonical.unreachable`    | warning  | HEAD renvoie 4xx/5xx (opt-in) |
| `robots.noindex-in-sitemap`| error    | `noindex` mais cible présente dans sitemap |
| `jsonld.invalid`           | error    | parse JSON ou `@context` manquant |
| `jsonld.unknown-type`      | info     | `@type` absent du registre Schema.org connu |
| `twitter.handle.invalid`   | warning  | settings.twitterHandle pas du format `@xxx` |
| `i18n.locale-fallback`     | info     | locale demandée non disponible, fallback `fr-MA` |

## Calcul du score

```ts
function scoreFromIssues(issues: AuditIssue[]): number {
  const errorCount   = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount    = issues.filter(i => i.severity === 'info').length;

  return Math.max(
    0,
    100 - errorCount * 25 - warningCount * 8 - infoCount * 2,
  );
}
```

Seuils UI : `vert ≥ 80`, `ambre 50-79`, `rouge < 50`.

## Composant `<SeoLinterPanel>`

```
┌──────────────────────────────────────────────┐
│  Audit                          [Score 78]   │
│  ──────────────────────────────────────────  │
│  ⚠ title 65 chars (max 60)         [→ champ] │
│  ⚠ description 178 chars (max 160) [→ champ] │
│  ✓ canonical OK                              │
│  ✓ robots OK                                 │
│  ⓘ keywords 12 OK (max 20)                   │
│  ──────────────────────────────────────────  │
│  Errors 0 · Warnings 2 · Info 1              │
└──────────────────────────────────────────────┘
```

- Click sur une issue → `focus()` + `scrollIntoView()` du champ concerné
- Compteurs cliquables : filtre la liste par sévérité
- Toggle « masquer les info » dans le footer

## Blocage publish

Le bouton **Publier** est désactivé si `errors > 0`. Tooltip :
« Corrige les erreurs avant de publier. »

Côté serveur le `/publish` re-lance le linter ; refus 422 si erreurs
(double protection, important si client patché).

## Mode preview live (sans persister)

Body du POST audit accepte un `candidate: Partial<SeoOverride>` ; le
serveur fusionne `published || draft || candidate` pour calculer.
→ permet de prévisualiser un changement avant le PATCH.

## Caching

Pas de cache sur le linter (pure CPU, < 30 ms). Le check HTTP
canonical (opt-in, env `SEO_LINTER_FETCH_CANONICAL=true`) est
mémoizé in-memory 5 min par URL pour ne pas saturer.

## Extensibilité

Ajouter une règle :

1. Ajouter un objet dans `apps/web/src/lib/seo/rules/index.ts`
2. Implémenter `(resolved) => Issue | null`
3. Ajouter un cas fixture dans `__fixtures__/lint-cases.ts`
4. Documenter dans le tableau ci-dessus

Aucune règle n'a accès au DOM ou à un fetch sans flag explicite.

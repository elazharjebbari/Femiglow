# Backend — OG images dynamiques

Génération PNG runtime via `next/og` (`ImageResponse`). Route :
`apps/web/src/app/api/og/[scope]/[targetKey]/route.tsx`. Runtime
`edge`.

## Contrat de la route

`GET /api/og/[scope]/[targetKey]?locale=fr-MA`

Réponse :

- 200 OK, `image/png`, 1200×630
- `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`
- ETag = hash(scope, targetKey, locale, override.updated_at, settings.updated_at)

Comportement par cascade :

1. Charger `seo_overrides` (publié) + `seo_settings`
2. Si `override.og_image_media_id` → redirect 307 vers le média
   (passthrough, pas de re-render)
3. Sinon si `override.og_image_template` ∈ templates → render template
4. Sinon si `settings.default_og_image_media_id` → redirect média
5. Sinon → render template `default`

## Templates

4 templates dans `apps/web/src/app/api/og/_templates/`.

### `marketing.tsx` (default)

- Fond `#FAF6EE` (crème)
- Logo SVG inline en haut-gauche (50×50)
- Titre Cormorant Garamond 80px, max 3 lignes
- Sous-titre Inter 32px, 1 ligne
- Filet dégradé en bas (3 px sauge → encre)

### `article.tsx`

- Photo hero remplit 60% gauche (resize côté server depuis le binding média)
- Bloc texte 40% droite : kicker, titre, auteur, date
- Police titre Cormorant 64px

### `product.tsx`

- Packshot 50% droite (centrée, fond crème)
- Bloc texte 50% gauche : nom, tagline, prix « à partir de … »
- Badge promo si `promoPriceCents` présent

### `default.tsx`

- Fond crème, juste le `siteName` typographique centré
- Filet dégradé

## Polices

```ts
async function loadFont(name: 'inter' | 'cormorant') {
  const url = new URL(`/fonts/og/${name}.subset.woff2`, env.NEXT_PUBLIC_APP_URL);
  return fetch(url).then(r => r.arrayBuffer());
}
```

Subsets latin uniquement (~80 KB chacune). Préchargées en parallèle
via `Promise.all` au début du handler.

## Performance

| Métrique           | Cible | Mesuré (dev) |
|--------------------|-------|--------------|
| Cold start edge    | < 800 ms | 620 ms |
| Cached (CDN hit)   | < 80 ms  | 35 ms  |
| Taille PNG         | < 200 KB | 140 KB |

Si dépassement → ajout d'un `unstable_cache` côté query DB pour
éviter le hit Postgres à chaque cold.

## Failsafe

En cas d'erreur (DB down, font fetch fail, render fail) :

- Log structuré `{ severity: 'error', scope, targetKey, err }`
- Renvoyer un PNG fallback statique (`/public/og-fallback.png`)
- Code 200 (pas 5xx) pour ne pas casser les unfurls Slack/FB qui
  retentent agressivement

## Cache invalidation

À chaque PATCH/publish d'un override :

- `revalidateTag(\`seo:${scope}:${targetKey}\`)` (déjà fait par les routes admin)
- L'ETag change automatiquement (incl. `updated_at`)
- CDN respecte `Cache-Control` ; pas de purge manuelle nécessaire
- Si urgence : `POST /api/admin/cache/revalidate?tag=seo`

## Tests

- Snapshot tests sur 4 fixtures (1 par template) — comparé avec
  `pixelmatch` à un PNG de référence dans `apps/web/test/og-snapshots/`
- Tolérance 0.5% diff par pixel (police rendering edge ≠ local)
- Test perf en CI : timer.now() < 1500 ms pour cold

## Sécurité

- Pas d'exécution de code arbitraire dans les templates (tout est
  React serialisé)
- `targetKey` validé contre regex avant query DB
- Pas de fetch externe sauf polices (URL whitelistée)
- Rate limit : 60 req/min/IP via middleware

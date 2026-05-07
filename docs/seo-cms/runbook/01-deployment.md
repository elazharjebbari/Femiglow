# Runbook — Déploiement SEO-CMS

## Pré-requis

- Migration `0007_seo_cms.sql` revue
- Schémas Zod ajoutés (`apps/web/src/lib/seo/schemas.ts`)
- Helper `resolveSeoMetadata()` testé (cascade + fallback)
- Tests unitaires : `getOverride`, `publishOverride`, `linter` ✅

## Séquence de déploiement

### 1. Migration DB

```bash
pnpm --filter @femiglow/web drizzle:migrate
```

Vérifier :

```sql
SELECT count(*) FROM seo_overrides;        -- 0 attendu
SELECT count(*) FROM seo_settings;          -- 1 attendu (singleton seedé)
SELECT count(*) FROM seo_audit_snapshots;   -- 0 attendu
```

### 2. Seed `known_pages`

Le seed `apps/web/src/lib/db/seeds/seo-known-pages.ts` insère les
13 pages cartographiées dans `seo_settings.known_pages` :

```bash
pnpm --filter @femiglow/web db:seed -- seo-known-pages
```

Liste attendue (ordre alphabétique des `key`) :

`accueil`, `apropos`, `contact`, `cookies`, `journal`, `kit`,
`legal`, `pourquoi`, `rituel`, `mentions`, `programme`, `soin`,
`temoignages`.

### 3. Déploiement code

Push sur `main` → Vercel build automatique. Le build doit passer :

- `pnpm typecheck`
- `pnpm test:unit -- seo-cms`
- `pnpm test:e2e -- seo-cms`
- Lighthouse CI : pas de régression Performance/SEO sur les 3
  pages clés (`/`, `/kit`, `/journal`)

### 4. Vérification post-deploy

1. `/admin/seo` accessible avec un compte admin
2. Créer un override `home` (title custom) → publier
3. Curl `https://femiglow.com/` et vérifier `<title>`
4. Sitemap : `https://femiglow.com/sitemap.xml` ne contient pas la
   home si `noindex` est mis (test négatif)
5. OG image : `/api/og/page/home` répond 200 + PNG 1200×630

### 5. Activation progressive

- Phase A déployée → admin peut éditer mais aucune override n'existe
- Tant qu'aucun override n'est créé : 0 régression possible
- Activation OG dynamique : flag `seoCmsOgDynamic` (default false)
  → flip via `/admin/settings/flags`

## Variables d'environnement

| Var                                  | Description                                | Defaut |
|--------------------------------------|--------------------------------------------|--------|
| `OG_IMAGE_CACHE_TTL`                 | Cache `next/og` en secondes                | 3600   |
| `SEO_LINTER_FETCH_CANONICAL`         | Validation HTTP des canonical URLs         | false  |
| `SEO_AUDIT_SNAPSHOT_RETENTION`       | Nb max snapshots / cible                   | 50     |

## Métriques à surveiller (J+1, J+7)

| Métrique                                    | Seuil acceptable |
|---------------------------------------------|------------------|
| Latence p95 `resolveSeoMetadata()`           | < 5 ms cached    |
| Cache miss rate `seo`                        | < 2% / heure     |
| Latence p95 `/api/og/[scope]/[targetKey]`    | < 800 ms cold, < 80 ms cached |
| Erreurs 5xx sur `/api/admin/seo/*`           | 0 / heure        |
| Score Lighthouse SEO                         | ≥ 95 sur les 3 pages clés |

## Rollback

### Rollback complet (revenir aux defaults codés)

```sql
DELETE FROM seo_overrides;
```

Toutes les pages reprennent leurs `metadata` codées d'origine.
`revalidateTag('seo')` puis vider Vercel data cache.

### Rollback ciblé d'un override

```sql
UPDATE seo_overrides
SET published_at = NULL
WHERE scope = '<scope>' AND target_key = '<key>';
```

→ La page revient au défaut codé. Le draft reste éditable.

### Rollback OG dynamique

```sql
UPDATE app_config
SET payload = jsonb_set(payload, '{flags,seoCmsOgDynamic}', 'false')
WHERE section = 'flags';
```

Les pages reviennent à l'OG SVG statique.

## Communication

- Annoncer aux admins éditoriaux : `/admin/seo` est dispo
- Lien vers le tableau de la cascade et le linter
- Workshop 30 min recommandé avant ouverture (montrer SerpPreview,
  audit, snapshot/restore)

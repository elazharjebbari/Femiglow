# Runbook — Déploiement admin-config

## Pré-requis

- Migration `0009_admin_config.sql` revue et appliquée
- Schémas Zod par section ajoutés à `apps/web/src/lib/admin-config/schemas.ts`
- Defaults codés présents dans `apps/web/src/lib/admin-config/defaults.ts`
- Tests unitaires `getAppConfig()` ✅ (cascade + failsafe)

## Séquence de déploiement

### 1. Migration DB

```bash
pnpm --filter @femiglow/web drizzle:migrate
```

Vérifier :

```sql
SELECT section, version FROM app_config;
-- attendu : 0 ligne (les defaults codés prennent le relais)
```

### 2. Déploiement code

Push sur `main` → Vercel build automatique. Le build doit passer :

- `pnpm typecheck` (les types Zod sont source de vérité)
- `pnpm test:unit` — focus sur `admin-config/*`
- `pnpm test:e2e -- admin-config` — parcours `/admin/settings`

### 3. Vérification post-deploy

Sur prod :

1. Login admin
2. Naviguer `/admin/settings` → 4 cartes visibles, toutes en
   « valeur défaut »
3. Éditer NAV : ajouter un item → publier → vérifier qu'il apparaît
   dans la sidebar admin après refresh
4. Ouvrir `/admin/settings/branding` → changer la couleur primaire
   → vérifier qu'elle s'applique sur la page suivante

### 4. Smoke test failsafe

Test manuel obligatoire avant de déclarer green :

```sql
-- corrompre volontairement la section nav
UPDATE app_config
SET payload = '{"items":[{"key":"💥","href":"not-a-path"}]}'::jsonb
WHERE section = 'nav';
```

Recharger l'admin → la NAV doit toujours s'afficher (défaut codé) ;
un warn doit apparaître dans Sentry/console serveur.

Nettoyer :

```sql
DELETE FROM app_config WHERE section = 'nav';
```

## Rollback

Cf. [`02-rollback.md`](./02-rollback.md) pour le détail.

Rollback rapide (config cassée mais site OK grâce au failsafe) :

```sql
DELETE FROM app_config WHERE section = '<section_cassee>';
SELECT pg_notify('cache_revalidate', 'app-config');
```

Puis dans l'admin : `revalidateTag('app-config')` via une route
admin protégée si pg_notify n'est pas branché.

## Variables d'environnement

Aucune nouvelle var requise. Le module utilise :

- `DATABASE_URL` — déjà présent
- `NEXT_PUBLIC_APP_URL` — déjà présent (pour les hrefs absolus dans
  les snapshots)

## Métriques à surveiller (J+1, J+7)

| Métrique                                    | Seuil acceptable |
|---------------------------------------------|------------------|
| `app_config_zod_failure_total` (Prom/Sentry) | 0 / jour        |
| Latence p95 `getAppConfig()`                 | < 5 ms (cached) |
| Cache miss rate `app-config`                 | < 1% / heure    |
| Erreurs 5xx sur `/api/admin/settings/*`      | 0 / heure       |

Alerte si `app_config_zod_failure_total > 0` → un payload corrompu
existe en DB ; investiguer immédiatement (le site tient grâce au
failsafe mais la config admin n'est pas appliquée).

## Communication

- Annoncer aux utilisateurs admin (Slack #admin) : « `/admin/settings`
  est dispo, NAV / flags / RBAC / branding éditables. »
- Lien vers ce runbook + le glossaire dans le README.

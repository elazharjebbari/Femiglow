# R1 — Bootstrap

> Mise en place initiale du système Components-CMS (extension du
> Component-Media). À exécuter **une seule fois** par environnement
> (dev local, staging, prod). Idempotent : ré-exécuter ne casse rien.

## Pré-requis

- Branche contenant les phases P1 → P4 mergées (cf. `action-plan/01-phases.md`).
- Accès `psql` ou Drizzle Studio à la DB cible.
- Variables d'env. listées en bas de ce doc.
- `pnpm` ≥ 9, Node ≥ 20.

## Étape 1 — Migrations (5 min)

Génération + application des migrations Drizzle pour les tables
`component_field_bindings` et `component_field_history` (cf. A2).

```bash
# 1. Vérifier que le schema TS est à jour
pnpm --filter @femiglow/web tsc --noEmit

# 2. Générer la migration (lit src/lib/db/schema.ts, écrit dans drizzle/)
pnpm --filter @femiglow/web drizzle-kit generate

# 3. Inspecter le SQL produit (CRITIQUE : on lit avant d'appliquer)
ls -lt apps/web/drizzle/migrations/ | head -3
cat apps/web/drizzle/migrations/<dernier_fichier>.sql

# 4. Appliquer
pnpm --filter @femiglow/web drizzle-kit migrate
```

**Sortie attendue** dans le SQL :

- `CREATE TYPE field_binding_status AS ENUM ('draft','published','scheduled','archived');`
- `CREATE TYPE field_history_action AS ENUM ('create','update','publish','unpublish','restore','archive','schedule','unschedule');`
- `CREATE TABLE component_field_bindings (…)` (cf. A2 pour la liste des colonnes)
- `CREATE TABLE component_field_history (…)`
- 4 index : `cfb_publish_uniq`, `cfb_draft_uniq`, `cfb_lookup`, `cfb_scheduled`.
- `ALTER TABLE site_components ADD COLUMN fields jsonb NOT NULL DEFAULT '[]'::jsonb;`

**Validation** :

```sql
\d component_field_bindings
\d component_field_history
SELECT count(*) FROM component_field_bindings;   -- 0
```

## Étape 2 — Seed (5–15 min selon volume)

Le pipeline de seed (cf. B4) parcourt `SITE_COMPONENT_REGISTRY`,
extrait `fields[]` de chaque entrée, et upserte un binding
`status='published'` avec la `defaultValue` du registre. Les fields
absents du registre côté DB sont **archivés** (cf. EC1 dans A3).

```bash
pnpm --filter @femiglow/web seed:components-fields
```

Options utiles :

| Flag | Effet |
|------|-------|
| `--dry-run` | Affiche ce qui serait fait sans toucher la DB. À exécuter d'abord. |
| `--filter-page-group home` | Seed un seul page-group (utile en rollout phasé). |
| `--actor-id <id>` | Marque les bindings créés avec un `authorId` (sinon `NULL`). |

**Sortie attendue** (extrait NDJSON) :

```
{"phase":"fields","status":"seeded","componentKey":"home-hero","fieldKey":"title"}
{"phase":"fields","status":"seeded","componentKey":"home-hero","fieldKey":"subtitle"}
{"phase":"fields","status":"seeded","componentKey":"home-hero","fieldKey":"cta"}
…
{"phase":"summary","totalSeeded":234,"totalArchived":0,"totalSkipped":0}
```

## Étape 3 — Vérification de cohérence (2 min)

> **Invariant clé** : `count(bindings published) = somme des fields
> déclarés dans le registre`.

```sql
-- Compte des bindings publiés
SELECT count(*) AS bindings_published
FROM component_field_bindings
WHERE status = 'published' AND locale = 'fr';

-- Compte attendu (depuis le registre, via JS — voir script ci-dessous)
```

```bash
# Script utilitaire fourni
pnpm --filter @femiglow/web tsx scripts/check-field-bindings-count.ts

# Sortie attendue :
# Registry total fields  : 234
# DB published bindings  : 234
# Status                 : OK ✅
```

Si désaccord :

- **DB > registre** : bindings orphelins (cf. R5 / I5, lance le
  reconcile script).
- **DB < registre** : seed n'a pas tourné jusqu'au bout (relance
  avec `--verbose`).

## Étape 4 — Smoke test admin (3 min)

```bash
pnpm --filter @femiglow/web dev
```

1. Ouvrir `http://localhost:3000/admin/login` → s'authentifier.
2. Naviguer vers `/admin/components`.
3. Cliquer sur un composant (ex `home-hero`).
4. Vérifier la présence du panneau **« Champs »** (à côté de Médias /
   Animations / Aperçu).
5. Vérifier que chaque champ déclaré au registre est listé avec sa
   valeur courante (= `defaultValue`).
6. Cliquer sur le champ `title`, modifier d'un caractère, vérifier
   l'auto-save (badge « Brouillon enregistré »).
7. Cliquer **Publier** → toast « Publié — version 2 ».
8. Recharger la page publique : la valeur a changé.

Si l'un de ces points échoue → **stop** et incident (R5 / I2).

## Étape 5 — Cron (Vercel) (5 min)

Deux jobs cron sont nécessaires :

- `promote-scheduled-fields` — toutes les 5 min, promeut les
  bindings `scheduled` arrivés à échéance (cf. A4).
- `purge-field-history` — une fois par mois, applique la rétention
  90/365 jours (cf. A4).

Snippet `vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/cron/promote-scheduled-fields",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/purge-field-history",
      "schedule": "0 3 1 * *"
    }
  ]
}
```

> Les routes vérifient `Authorization: Bearer ${CRON_SECRET}`. En
> dev local, on déclenche manuellement :
>
> ```bash
> curl -H "Authorization: Bearer $CRON_SECRET" \
>   http://localhost:3000/api/cron/promote-scheduled-fields
> ```

## Étape 6 — Variables d'environnement

| Var | Obligatoire | Description |
|-----|-------------|-------------|
| `DATABASE_URL` | ✅ | Postgres prod (existant). |
| `CRON_SECRET` | ✅ | Bearer commun aux 2 routes cron (existant). |
| `ADMIN_SESSION_SECRET` | ✅ | Auth admin (existant). |
| `COMPONENTS_FIELDS_DEFAULT_LOCALE` | ☐ | Défaut `'fr'`. Force la locale par défaut. |
| `COMPONENTS_FIELDS_RICH_TEXT_MAX_LEN` | ☐ | Défaut `5000`. Cap sécurité avant Zod. |
| `COMPONENTS_FIELDS_ALLOWED_HOSTS` | ☐ | CSV des hôtes autorisés pour `cta.href` externe (cf. A6). |
| `COMPONENTS_FIELDS_HISTORY_RETENTION_DAYS` | ☐ | Défaut `90`. Override via env pour staging. |
| `NEXT_PUBLIC_COMPONENTS_FIELDS_ENABLED` | ☐ | Défaut `true`. Feature flag : `false` force le rendu sur `defaultValue`. |

**Important** : ne pas commit les valeurs prod ; utiliser
`.env.production.local` ou Vercel Project Settings.

## Étape 7 — Healthcheck final

```bash
# 1. Build prod (catch les imports server-only fuyants)
pnpm --filter @femiglow/web build

# 2. TypeCheck strict
pnpm --filter @femiglow/web tsc --noEmit

# 3. Suite Vitest
pnpm --filter @femiglow/web test

# 4. Playwright (au moins le parcours nominal admin)
pnpm --filter @femiglow/web test:e2e -- --grep "@components-cms-smoke"
```

Tous verts → bootstrap terminé. On peut passer à R2 (premier ajout
de champ).

## Rollback du bootstrap

Si on veut **complètement** désactiver l'extension :

1. `NEXT_PUBLIC_COMPONENTS_FIELDS_ENABLED=false` (le rendu retombe
   sur `defaultValue` du registre, comme avant l'extension).
2. Désactiver les 2 routes cron (commenter dans `vercel.json`).
3. Optionnel destructif : `DROP TABLE component_field_history,
   component_field_bindings; ALTER TABLE site_components DROP COLUMN
   fields;` — **réservé à une régression majeure**, perd l'historique.

Cf. R5 / I6 pour le rollback non-destructif d'une mauvaise publication.

## Cross-references

- Modèle de données → A2
- Cascade de résolution → A3
- Versioning et cron → A4
- RBAC et audit → A6
- Seed pipeline → B4
- Premier ajout de champ → R2
- Rollout phasé → R4

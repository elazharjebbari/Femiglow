# Admin Config Model — `i18n_locale_config`

> **Source de vérité** : [`../CONTRACT.md`](../CONTRACT.md) §2 (table `i18n_locale_config`), §3 (clés), §6 (INV-12).
> **Schéma de payload** : [`config-schema.yaml`](./config-schema.yaml).
> **Précédent de style à mirrorer** : `app_config` / `app_config_snapshots` (migration `0006_admin_config.sql`), `apps/web/src/lib/admin-config/resolve.ts`, `apps/web/src/lib/db/queries/app-config.ts`.

Ce document fige **(a) le fonctionnement optimal** du modèle de données et **(b) les éléments à vérifier/tester**.

---

## 1. Décision : table dédiée vs section `app_config`

Le repo possède déjà un mécanisme générique de config admin : une table `app_config` (`section` PK, `payload` JSONB, `version`, `updated_at`, `updated_by`) + `app_config_snapshots` (audit before/after). On **mirrore ce mécanisme** plutôt que de réinventer.

**DÉCISION ACTÉE — ADR-009** : on **réutilise `app_config`** avec `section = 'i18n_locale_config'` (**zéro nouvelle table**). On hérite gratuitement du versioning, des snapshots, de l'audit (`logAuditEvent`) et du cache (`unstable_cache` + tag). Le **nom logique** `i18n_locale_config` est conservé comme **identifiant de section**. Le `CONTRACT.md` §2 a été aligné en ce sens. La migration se réduit à un **seed de section** (pas de DDL).

Pourquoi cette option l'emporte :
- cohérence totale avec l'admin existant (nav/flags/rbac/branding sont déjà en `app_config`) ;
- audit + snapshots + cache **gratuits** ; failsafe Zod→défauts (INV-12) déjà fourni par `safeValidate` ;
- moins de surface = moins de bugs.

> Variante « table dédiée `i18n_locale_config` » (isolation cache/audit) : **conservée seulement** si un besoin d'isolation forte émerge plus tard. Le reste du dossier traite `i18n_locale_config` comme **l'entité logique**, matérialisée en **section `app_config`**.

---

## 2. Single-row vs rows-per-locale

**Décision : SINGLE-ROW + payload JSONB** (le tableau `locales[]` vit *dans* le JSONB).

| Critère | Single-row JSONB (retenu) | Rows-per-locale |
|---|---|---|
| Atomicité d'un PUT (toggle + reorder + default en 1 coup) | ✅ une seule écriture transactionnelle | ❌ multi-rows, risque d'état partiel |
| Optimistic concurrency (`version` / `If-Match`) | ✅ trivial (1 version globale) | ⚠️ versionner quoi ? la collection ? |
| Validation trans-champs (exactement 1 default, default enabled…) | ✅ validée sur l'objet complet (Zod superRefine) | ❌ invariants inter-lignes coûteux |
| Snapshot before/after (audit) | ✅ 1 blob = état complet | ❌ diff multi-lignes |
| Cache public (1 GET = 1 objet) | ✅ 1 row → 1 réponse | ⚠️ agrégation |
| Volume | 3 locales, jamais "big data" | sur-ingénierie |

Cohérent avec `app_config` (le repo stocke déjà nav/flags/rbac/branding en single-row JSONB).

---

## 3. Schéma de table (colonnes & types)

```
i18n_locale_config
┌────────────┬───────────────────────────┬──────────────────────────────────────────────┐
│ colonne    │ type                      │ rôle                                          │
├────────────┼───────────────────────────┼──────────────────────────────────────────────┤
│ id         │ text PK                   │ singleton — valeur fixe 'singleton'           │
│ payload    │ jsonb NOT NULL DEFAULT {} │ config validée (forme = config-schema.yaml)   │
│ version    │ integer NOT NULL DEF 1    │ optimistic lock (If-Match)                    │
│ updated_at │ timestamptz NOT NULL now()│ horodatage dernière écriture                  │
│ updated_by │ text → admin_users(id)    │ acteur (FK SET NULL)                          │
└────────────┴───────────────────────────┴──────────────────────────────────────────────┘
```

**JSONB vs colonnes — rationale.** Tout le contenu *éditable* (locales, default, nudge, surfaces, transition) est imbriqué/évolutif → **JSONB** (souplesse de forme + validation applicative Zod, exactement comme `app_config.payload`). Les champs *opérationnels* (concurrence, audit, cache-busting) sont des **colonnes** typées (`version`, `updated_at`, `updated_by`) car ils sont requêtés/indexés et ne doivent pas dépendre de la validité du payload. Le `id` est un **singleton** (`CHECK (id = 'singleton')`) qui garantit "single-row" au niveau base.

**Audit (snapshots before/after)** : table sœur `i18n_locale_config_snapshots`, mirror de `app_config_snapshots` (qui = audit who/when/before-after). Voir `06-admin/admin-permissions.md`.

---

## 4. Migration Drizzle (sketch)

> Style mirroré sur `0006_admin_config.sql` + `0019_product_stock.sql` (CHECK constraints, `--> statement-breakpoint`, FK `admin_users`). Fichier cible : `apps/web/drizzle/migrations/00XX_i18n_locale_config.sql` (+ entrée dans `meta/_journal.json`). **Ne PAS créer le fichier ici** — ceci est l'esquisse contractuelle.

```sql
-- ===========================================================================
-- Migration 00XX — i18n_locale_config (Locale Switcher V2)
-- ---------------------------------------------------------------------------
-- CONTRACT §2 : table de config admin-éditable du switcher de langue.
-- Single-row JSONB (singleton) + version (optimistic lock) + audit snapshots.
-- Lecture publique cachée (/api/i18n/config) ; écriture admin (/api/admin/i18n/config).
-- INV-12 : un payload invalide ⇒ defaults applicatifs (jamais d'écran cassé).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "i18n_locale_config" (
  "id"         text PRIMARY KEY NOT NULL DEFAULT 'singleton',
  "payload"    jsonb NOT NULL DEFAULT '{}'::jsonb,
  "version"    integer NOT NULL DEFAULT 1,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  CONSTRAINT "i18n_locale_config_singleton" CHECK ("id" = 'singleton')
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "i18n_locale_config_snapshots" (
  "id"          text PRIMARY KEY NOT NULL,
  "payload"     jsonb NOT NULL,          -- état APRÈS (before = snapshot précédent)
  "version"     integer NOT NULL,
  "actor_id"    text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "note"        text,
  "captured_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ilc_snap_captured_idx"
  ON "i18n_locale_config_snapshots" ("captured_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ilc_snap_actor_idx"
  ON "i18n_locale_config_snapshots" ("actor_id");
--> statement-breakpoint

-- Default-seed : insère le singleton avec le payload canonique (CONTRACT §3).
INSERT INTO "i18n_locale_config" ("id", "payload", "version")
VALUES (
  'singleton',
  '{
    "locales": [
      {"code":"fr","enabled":true,"endonym":"Français","direction":"ltr","order":1},
      {"code":"ar","enabled":true,"endonym":"العربية","direction":"rtl","order":2},
      {"code":"en","enabled":true,"endonym":"English","direction":"ltr","order":3}
    ],
    "defaultLocale":"fr",
    "nudge":{"enabled":true,"maxImpressionsPerVisitor":1},
    "surfaces":{"header":{"variant":"dropdown"},"drawer":{"variant":"pills"},"footer":{"variant":"pills"}},
    "transition":{"durationMs":280,"easing":"cubic-bezier(0.22,1,0.36,1)"}
  }'::jsonb,
  1
)
ON CONFLICT ("id") DO NOTHING;
```

**Drizzle schema (`apps/web/src/lib/db/schema.ts`)** : ajouter `i18nLocaleConfig` et `i18nLocaleConfigSnapshots` (`pgTable`), même style que `appConfig` / `appConfigSnapshots`.

---

## 5. Read path (public, caché) vs Write path (admin)

### 5.1 Read path — `getLocaleConfig()` (public, sans auth, caché)

Mirror de `admin-config/resolve.ts` (`unstable_cache` + tag + `safeValidate` → fallback defaults).

```
GET /api/i18n/config
  └─ getPublicLocaleConfig()                      // apps/web/src/lib/i18n/locale-config/resolve.ts
       └─ unstable_cache(fn, ['i18n-locale-config'], { tags: [I18N_CONFIG_TAG] })
            └─ row = SELECT * FROM i18n_locale_config WHERE id='singleton'
            └─ parsed = localeConfigSchema.safeParse(row.payload)
            └─ if !parsed.success → log warn + return DEFAULTS   ← INV-12
            └─ return parsed.data (+ meta.version pour ETag)
```

- **Tag de cache** : `I18N_CONFIG_TAG = 'i18n-locale-config'`. Invalidé par `revalidateTag(I18N_CONFIG_TAG)` **dans le write path**.
- **ETag** : dérivé de `version` (ex: `W/"ilc-<version>"`). Cf. `04-backend/api-contracts.md`.
- **Cache HTTP** : `Cache-Control: public, max-age=30, s-maxage=300, stale-while-revalidate=86400` (mirror du style `track/banner-config/route.ts`, mais TTL plus long car change rarement). Le SWR garantit que même si la DB tombe, le edge sert la dernière bonne valeur.
- **Consommation serveur (sans HTTP)** : le rendu RSC du `LocaleSwitcher` appelle directement `getPublicLocaleConfig()` (pas de fetch interne), pour éviter un aller-retour + garantir le no-flash (la config arrive comme prop, cf. `04-backend/server-detection.md`).

### 5.2 Write path — admin only + version + audit

Mirror exact de `app/api/admin/settings/[section]/route.ts` (PUT/PATCH + `If-Match` + Zod 422 + `upsert(expectedVersion)` 409 + `revalidateTag` + `logAuditEvent`).

```
PUT /api/admin/i18n/config   (auth admin requise)
  1. getAdminSession() sinon 401 unauthorized
  2. RBAC : action write sur resource 'app-config' (ou 'i18n') sinon 403 forbidden
  3. If-Match: <version> requis, sinon 400 invalid_input
  4. localeConfigSchema.safeParse(payload) → 422 validation_failed (issues + rule code)
  5. upsertI18nLocaleConfig({ payload, expectedVersion, actorId })
       - WHERE id='singleton' AND version = expectedVersion
       - SET payload, version = version+1, updated_at=now(), updated_by=actorId
       - si 0 row affectée → 409 version_conflict (currentVersion renvoyée)
       - INSERT snapshot (payload après, version, actorId, note)
  6. revalidateTag(I18N_CONFIG_TAG)          ← invalide le cache public
  7. logAuditEvent({ action:'i18n-config.update', resourceType:'i18n_locale_config',
                     resourceId:'singleton', meta:{ version, snapshotId, note,
                     before, after } })       ← who/when/before-after
  8. 200 { payload, meta:{version,updatedAt,updatedBy,isDefault:false}, snapshotId }
```

---

## 6. Default-seed & fallback-to-defaults (INV-12)

Deux niveaux de "defaults", redondants par sécurité :

1. **Seed DB** (migration §4) : insère le payload canonique au déploiement → la table n'est jamais vide.
2. **Defaults applicatifs** (`apps/web/src/lib/i18n/locale-config/defaults.ts`) : objet TS **identique** à `config-schema.yaml#defaults`. Servi par le resolver si :
   - aucune row (DB neuve / seed non joué) ;
   - `safeParse` échoue (payload corrompu / champ retiré / schemaVersion incompatible) ;
   - la DB est injoignable (try/catch → defaults).

> **Invariant INV-12** : *config invalide / API down ⇒ valeurs par défaut, switcher fonctionnel*. Le resolver ne **throw jamais** vers le rendu. Identique au `safeValidate()` de `admin-config/resolve.ts` (log warn + null → default).

---

## 7. Éléments à VÉRIFIER / TESTER

### Fonctionnel
- [ ] Seed : après migration, `SELECT` renvoie le payload canonique, `version=1`.
- [ ] Read path renvoie un objet **validé** identique au seed.
- [ ] Write path : un PUT valide incrémente `version`, met à jour `updated_at/by`, crée 1 snapshot.

### Intégrité des données
- [ ] `CHECK (id='singleton')` empêche toute 2e ligne (test INSERT id='x' → erreur).
- [ ] FK `updated_by`/`actor_id` → `admin_users` ; `ON DELETE SET NULL` (supprimer l'admin ne casse pas la config/audit).
- [ ] `version` strictement croissant ; jamais de gap silencieux (chaque PUT accepté = +1).
- [ ] Snapshot inséré **à chaque** écriture acceptée (before reconstituable via la chaîne).

### Sécurité / authz
- [ ] Read public **sans** session : 200 (jamais 401).
- [ ] Write **sans** session : 401 ; session non-autorisée RBAC : 403 ; **aucune** mutation/snapshot/audit sur 401|403.
- [ ] Payload `.strict()` : clé inconnue dans le PUT ⇒ 422 (anti-injection de clés).

### Caching
- [ ] Après PUT, `revalidateTag(I18N_CONFIG_TAG)` ⇒ le prochain GET public reflète la nouvelle valeur (pas de stale > SWR).
- [ ] ETag change quand `version` change ; `If-None-Match` correspondant ⇒ 304.
- [ ] Le cache n'est **jamais** alimenté par un payload invalide (defaults non mis en cache comme s'ils étaient la DB — `isDefault` tracé).

### Modes de défaillance (INV-12)
- [ ] DB down au read ⇒ defaults servis, 200, switcher OK, log warn.
- [ ] Payload corrompu (clé retirée) ⇒ defaults servis, **pas** de 500 public.
- [ ] Conflit de version (deux admins en parallèle) ⇒ le 2e PUT reçoit 409 + `currentVersion`, **aucune** perte silencieuse.

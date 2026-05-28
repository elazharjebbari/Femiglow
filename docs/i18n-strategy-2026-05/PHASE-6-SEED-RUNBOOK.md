# Phase 6 — Runbook seed i18n FemiGlow (AR + EN bindings)

> Procédure d'ingestion en DB des 510 bindings AR + 510 bindings EN produits par la préparation contenu hors-sprint
> (`docs/i18n-content-2026-05/03-seed-data/component-bindings-{ar,en}.csv`).
>
> Cible : table `component_field_bindings` (Drizzle/Postgres). Status seedé : `draft`. Le founder publie via admin après revue voix.
>
> Statut : Draft initial — à enrichir après 1er run terrain.

---

## TL;DR (5 lignes)

1. `python3 docs/i18n-content-2026-05/scripts/validate-seeds.py` ⇒ verdict `GO conditionnel` accepté (orphans loggés).
2. `pnpm --filter @femiglow/web seed:i18n-bindings -- --dry` ⇒ rapport JSON, `errors=0`, `inserted ≈ N` (selon registre actuel).
3. `pnpm --filter @femiglow/web seed:i18n-bindings` ⇒ insert réel (N bindings AR + N bindings EN, status=`draft`).
4. Vérification SQL : `SELECT locale, status, COUNT(*) FROM component_field_bindings GROUP BY 1, 2;`
5. Preview admin sur `/admin/components/<slug>` (onglets FR/AR/EN) + frontend `/ar/`, `/en/`.

Durée totale estimée : **~45 min** (dry-run + apply + preview admin + smoke Playwright).

---

## 0. Prérequis

| # | Pré-requis | Vérification |
|---|---|---|
| 0.1 | Branche `feat/i18n-foundation` ou descendante | `git status` |
| 0.2 | Node 22 via `.nvmrc` | `node --version` ⇒ `v22.x` |
| 0.3 | pnpm 9.x | `pnpm --version` ⇒ `9.x` |
| 0.4 | DB up (Neon/Postgres ou memoryStore) | `pnpm db:validate` |
| 0.5 | Migrations à jour | `pnpm db:migrate-safe:plan` ⇒ 0 op pending |
| 0.6 | `I18N_ENABLED=true` dans `.env.local` | `grep I18N_ENABLED apps/web/.env.local` |
| 0.7 | Registre TS à jour | `pnpm --filter @femiglow/web seed:components` |
| 0.8 | Seed FR déjà passé | `pnpm --filter @femiglow/web seed:components-fields` |

> **Important** — La step `0.7 + 0.8` doivent être exécutées **avant** ce runbook : ce runbook ne seede que AR + EN. Les 510 bindings FR sont créés par `seed:components-fields` à partir du registre TS (`defaultValue`), pas du CSV.

---

## 1. Procédure GO (chemin nominal)

### Étape 1 — Pré-flight check (~2 min)

```bash
# 1. Validation CSV + structure i18n-content-2026-05/
python3 docs/i18n-content-2026-05/scripts/validate-seeds.py
# Verdict attendu : `GO` ou `GO conditionnel` (WARNINGS sur orphans tolérés).
# Si verdict `NO-GO`, corriger les ERRORS avant de continuer.

# 2. Validation DB
cd apps/web
pnpm db:validate
# Vérifie que les migrations correspondent au schéma TS.
```

**Critère de passage** :
- `validate-seeds.py` ⇒ exit code 0 (ou WARNINGS acceptables).
- `db:validate` ⇒ OK.

---

### Étape 2 — Dry-run (~5 min)

```bash
cd apps/web
pnpm seed:i18n-bindings -- --dry
```

**Output attendu** (extrait) :

```
seed-i18n-bindings — 2 locale(s)
  ar : parsed=510 inserted=47 skipped=0 errors=0 orphans=54 (~200ms)
  en : parsed=510 inserted=47 skipped=0 errors=0 orphans=54 (~180ms)
total : parsed=1020 inserted=94 skipped=0 errors=0 orphans=926
Rapport JSON : apps/web/.seed-reports/seed-i18n-bindings-<ts>.json
```

**Lecture** :
- `parsed` = lignes du CSV bien validées.
- `inserted` = bindings qui SERAIENT créés (dry-run n'écrit pas).
- `skipped` = bindings déjà présents en DB (admin priorité I0).
- `orphans` = rows pour des slugs absents de `site_components` (à corriger dans le registre TS si on veut les seeder).
- `errors` = rows mal formées (Zod validation).

**Critère GO** :
- `errors == 0`.
- Le `inserted` reflète le nombre de bindings que tu attends (cf. tableau §4 plus bas).

> **Si tu vois des orphans nombreux** (>50 slugs) : c'est attendu pour le 1er run. Le registre TS actuel contient 22 composants alors que le CSV cible 60 slugs (les sections marketing détaillées comme `kit-composition`, `commerce-merci`, etc., ne sont pas encore dans le registre). Pour les ingérer, il faut **d'abord** étendre `apps/web/src/lib/components/registry.ts` avec ces 60 entrées, puis re-rouler `pnpm seed:components` + ce runbook.

---

### Étape 3 — Apply (~10 min, dont 30 s de write réel)

```bash
cd apps/web
pnpm seed:i18n-bindings
```

**Output attendu** : identique au dry-run, mais cette fois les bindings sont écrits en DB. Le rapport JSON est sauvé dans `apps/web/.seed-reports/`.

**Critère GO** :
- Exit code 0.
- `errors == 0`.

---

### Étape 4 — Vérification SQL (~5 min)

Connecter à la DB (`pnpm db:studio` ou `psql $DATABASE_URL`) et lancer :

```sql
SELECT locale, status, COUNT(*) AS n
FROM component_field_bindings
GROUP BY 1, 2
ORDER BY 1, 2;
```

**Attendu** :

```
 locale | status     | n
--------+------------+-----
 fr     | published  | ~50    ← seed:components-fields (registre TS)
 ar     | draft      | ~47    ← ce runbook (CSV → seed:i18n-bindings)
 en     | draft      | ~47    ← ce runbook (CSV → seed:i18n-bindings)
```

**Critère GO** : les compteurs AR et EN matchent le `inserted` du rapport JSON.

Pour inspecter un binding particulier :

```sql
SELECT field_key, locale, status, value
FROM component_field_bindings b
JOIN site_components c ON c.id = b.component_id
WHERE c.key = 'home-hero' AND b.field_key = 'title'
ORDER BY locale;
```

---

### Étape 5 — Preview admin (~10 min)

```bash
cd apps/web
pnpm dev
```

1. Ouvrir `http://localhost:3000/admin` et se logger en admin.
2. Naviguer vers `/admin/components/home-hero`.
3. Vérifier que l'onglet **FR** affiche la valeur seedée par `seed:components-fields` (registre TS).
4. Cliquer sur l'onglet **AR** ⇒ vérifier que la valeur du CSV AR s'affiche bien.
5. Cliquer sur l'onglet **EN** ⇒ idem.
6. Tester une modification (ex : sur AR `title`) + sauvegarder ⇒ doit créer une nouvelle version `draft` (ou écraser celle du seed si elle est encore en draft).
7. Switcher entre les 3 onglets ⇒ pas d'erreur 500, pas de flash de contenu manquant.

**Critère GO** :
- Les 3 onglets affichent du contenu cohérent.
- Le switch est instantané.
- Une modif manuelle reste en place après refresh (ce qui valide l'invariant I0).

---

### Étape 6 — Preview frontend (~10 min)

Avec `pnpm dev` toujours actif :

1. `http://localhost:3000/fr/` ⇒ home en français.
2. `http://localhost:3000/ar/` ⇒ home en arabe, direction RTL, police Cairo.
3. `http://localhost:3000/en/` ⇒ home en anglais.

Pour chaque locale, vérifier visuellement que :
- Le titre principal est traduit (pas en fallback FR).
- Le sous-titre est traduit.
- Les CTAs sont traduits.
- Pas de string brute type `marketing.home.hero.title` à l'écran (= fallback rate).

Vérifier au moins **3 pages** :
- `/<locale>/` (home)
- `/<locale>/kit` (page produit)
- `/<locale>/maison` (about)

**Critère GO** : 0 string fallback visible sur les 3 pages × 3 locales = 9 vues.

---

### Étape 7 — Smoke tests Playwright (~5 min)

```bash
cd apps/web
pnpm test:e2e -- --grep @i18n
```

Si la suite `@i18n` n'existe pas encore, lancer au minimum :

```bash
pnpm test:e2e e2e/smoke/smoke-chat-widget.spec.ts
# Plus tard : pnpm test:e2e e2e/i18n/*.spec.ts (Phase 6 T6.3)
```

**Critère GO** : 0 test rouge, 0 flaky test (3 runs consécutifs verts).

---

## 2. Procédure NO-GO / Rollback

### 2.1 Cas où rollback est nécessaire

- Le `seed:i18n-bindings` a inséré des bindings AVEC des valeurs corrompues (ex : encodage UTF-8 cassé).
- L'admin signale que les nouveaux bindings écrasent des valeurs publiées (impossible normalement — I0 ; investiguer d'urgence si ça arrive).
- Régression frontend après ingestion (très improbable car status=`draft` n'est pas servi côté public).

### 2.2 Rollback SQL — supprimer uniquement les bindings AR + EN draft

```sql
BEGIN;

-- Aperçu (toujours avant le DELETE !)
SELECT locale, status, COUNT(*)
FROM component_field_bindings
WHERE locale IN ('ar', 'en')
  AND status = 'draft'
GROUP BY 1, 2;

-- Suppression effective
DELETE FROM component_field_bindings
WHERE locale IN ('ar', 'en')
  AND status = 'draft'
  -- Sécurité : ne supprimer que ceux créés dans la dernière heure
  -- (à ajuster selon ton timestamp d'exécution)
  AND created_at > NOW() - INTERVAL '1 hour';

-- Vérification
SELECT locale, status, COUNT(*)
FROM component_field_bindings
WHERE locale IN ('ar', 'en')
GROUP BY 1, 2;

COMMIT;  -- ou ROLLBACK; si l'aperçu n'est pas conforme
```

> **Garde-fou** : le `WHERE created_at > NOW() - INTERVAL '1 hour'` empêche d'effacer des bindings que l'admin aurait pu créer manuellement. Adapter la fenêtre selon le besoin.

### 2.3 Rollback via re-seed avec correction

Si le contenu CSV était mauvais (typo, mauvaise traduction) :

1. Corriger le CSV dans `docs/i18n-content-2026-05/03-seed-data/component-bindings-{ar|en}.csv`.
2. Re-rouler `pnpm seed:i18n-bindings -- --dry` ⇒ vérifier.
3. Lancer `pnpm seed:i18n-bindings -- --force-update` ⇒ écrase les drafts existants (lève I0).

> `--force-update` est destructif côté admin si l'admin a déjà édité un binding. À utiliser uniquement si on est certain qu'aucune édition manuelle n'a eu lieu (typiquement immédiatement après le 1er seed).

---

## 3. Troubleshooting

| Symptôme | Cause probable | Remède |
|---|---|---|
| `PreflightError: Aucun site_component trouvé en DB` | `seed:components` jamais passé | `pnpm --filter @femiglow/web seed:components` |
| `PreflightError: CSV introuvable` | `--csv-dir` mauvais ou CSV pas commités | `ls docs/i18n-content-2026-05/03-seed-data/` |
| `errors > 0` sur lignes ICU | CSV mal échappé (manque `""` autour d'un champ contenant `,`) | Ré-extraire depuis `messages-{loc}.json` via le script Python |
| Tous les bindings AR sont `orphans` | Le registre TS ne contient pas les slugs CSV | Étendre `registry.ts` puis `pnpm seed:components` puis re-run |
| `inserted=0, skipped=510` | Le seed a déjà tourné (idempotence) | Comportement attendu — ne pas relancer avec `--force-update` sauf besoin |
| L'admin voit des onglets vides | Le binding existe mais `cms.getHomepageContent` ne dispatche pas par locale | Vérifier `apps/web/src/lib/cms/db/homepage.ts` (passe `locale` aux queries) |
| Build Next.js casse après seed | Le seed ne touche pas le code applicatif, build ne devrait pas casser. Si c'est le cas, c'est une régression antérieure | `git diff master` et investiguer |
| `pnpm seed:i18n-bindings` se fige | Trop d'orphans → boucle SQL lente | Vérifier `.seed-reports/` ; couper avec Ctrl+C et faire un dry-run d'abord |
| Le rapport JSON pèse 1 Mo+ | Trop d'erreurs accumulées | Lancer `--locale ar` puis `--locale en` séparément pour isoler |
| FR seedé en `draft` au lieu de `published` | Tu as utilisé `seed:i18n-bindings -- --locale fr` (interdit) | Utiliser `seed:components-fields` pour FR |

---

## 4. Volumes attendus (à date — mai 2026)

| Locale | Source | Status final | Volume |
|---|---|---|---|
| FR | `seed:components-fields` (registre TS) | `published` | ~50 bindings (selon registre actuel) |
| AR | `seed:i18n-bindings` (CSV ar) | `draft` | 510 bindings parsés, **N insérables** selon registre |
| EN | `seed:i18n-bindings` (CSV en) | `draft` | 510 bindings parsés, **N insérables** selon registre |

> **N actuel** : ~47 (la majorité des slugs CSV ne sont pas encore dans le registre TS). Pour ingérer les 510 par locale, il faudra étendre le registre — voir §5.

---

## 5. Notes pour étendre la couverture (futur)

Le registre TS (`apps/web/src/lib/components/registry.ts`) liste actuellement **22 composants** (`home-hero`, `home-avis-strip`, `kit-comparatif`, etc.). Le CSV cible **60 slugs** (60 sections marketing détaillées).

Pour ingérer 100% des CSV :

1. Ajouter les 60 entries dans `registry.ts` avec leurs `fields` (clé, label, type, defaultValue=null).
2. `pnpm seed:components` → upserts dans `site_components`.
3. `pnpm seed:components-fields` → seede les FR `published`.
4. `pnpm seed:i18n-bindings` → seede AR + EN `draft`.

Estimation : ~4 JH pour étendre le registre (sections marketing déjà documentées dans `docs/i18n-content-2026-05/03-seed-data/README.md`).

---

## 6. Diagramme de flux

```
                    ┌─────────────────────────────────────┐
                    │ docs/i18n-content-2026-05/          │
                    │   03-seed-data/                     │
                    │     component-bindings-ar.csv  (510)│
                    │     component-bindings-en.csv  (510)│
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                       ┌──────────────────────┐
                       │ validate-seeds.py    │
                       │ (Go/No-Go preflight) │
                       └──────────┬───────────┘
                                  │ verdict GO
                                  ▼
                ┌────────────────────────────────────┐
                │ seed:i18n-bindings --dry           │
                │  → rapport JSON                    │
                │  → 0 error, N inserted, M orphans  │
                └──────────┬─────────────────────────┘
                           │ team review
                           ▼
                ┌─────────────────────────────────┐
                │ seed:i18n-bindings              │
                │  → INSERT INTO                  │
                │     component_field_bindings    │
                │     (status='draft')            │
                │  → rapport JSON timestampé      │
                └──────────┬──────────────────────┘
                           │
              ┌────────────┼─────────────┐
              │            │             │
              ▼            ▼             ▼
       ┌──────────┐ ┌──────────┐ ┌──────────────┐
       │ Vérif SQL│ │ Admin    │ │ Frontend     │
       │  (psql)  │ │ preview  │ │ /fr,/ar,/en  │
       └────┬─────┘ └────┬─────┘ └─────┬────────┘
            │            │              │
            └────────────┴──────┬───────┘
                                ▼
                         ┌────────────┐
                         │ Playwright │
                         │  smoke     │
                         └────┬───────┘
                              │
                              ▼
                         ┌────────────┐
                         │  GO / NO-GO│
                         └────────────┘
```

---

## 7. Annexes

### 7.1 Format CSV attendu (6 colonnes)

```csv
component_slug,field_key,locale,value,status,notes
home-hero,title,ar,مرحبا بكم,draft,
home-hero,subtitle,ar,"الكتلة، {count, plural, =1 {صباح واحد} other {# صباحات}}",draft,icu
```

- `component_slug` : kebab-case, doit matcher un `siteComponents.key` en DB.
- `field_key` : alphanum + `_` (ex : `title`, `hero__subtitle`, `composition__paste__name`).
- `locale` : `fr` | `ar` | `en` (cf. `apps/web/src/i18n.config.ts`).
- `value` : chaîne, échappage RFC 4180 (guillemets si `,` `\n` ou `"` présent).
- `status` : pour info — le seed force `draft`.
- `notes` : flags (`icu`, `drift: …`, etc.) — stockés en DB.

### 7.2 Exit codes du script

| Code | Sens | Action CI |
|---|---|---|
| 0 | OK — tout inséré, `errors == 0` | Continue |
| 1 | Erreurs runtime (au moins 1 row a échoué) | Failure, consulter rapport JSON |
| 2 | Pré-flight échoué (CSV absent, DB unreachable, slug map vide) | Failure bloquante |

### 7.3 Flags CLI complets

```text
--locale <ar|en>       Seed une seule locale (défaut : AR + EN).
--dry, --dry-run       Pas d'écriture DB, rapport seul.
--force-update         Override les drafts existants (lève I0). DESTRUCTIF si admin a édité.
--csv-dir <path>       Override du dossier CSV.
--report <path>        Écrit le rapport JSON dans ce fichier.
-h, --help             Aide.
```

### 7.4 Qui peut lancer ce runbook ?

| Rôle | Étape 1-2 (validate + dry) | Étape 3 (apply) | Étape 4-7 (preview + smoke) |
|---|---|---|---|
| Dev | ✅ | ✅ en dev/staging | ✅ |
| Lead tech | ✅ | ✅ en staging/prod | ✅ |
| Translator | ✅ (lecture) | ❌ | ✅ (preview) |
| Founder | ✅ (lecture) | ❌ (sauf go/no-go formel) | ✅ (signoff) |

### 7.5 Timing total estimé

| Étape | Durée | Bloquante ? |
|---|---|---|
| 1. Pré-flight | 2 min | Oui (si fail) |
| 2. Dry-run | 5 min | Oui (si errors > 0) |
| 3. Apply | 10 min | — |
| 4. Vérif SQL | 5 min | — |
| 5. Preview admin | 10 min | Oui (si regression admin) |
| 6. Preview frontend | 10 min | Oui (si fallback FR partout) |
| 7. Playwright smoke | 5 min | Oui (si specs rouges) |
| **Total** | **~45 min** | — |

---

## 8. Références

- Script seed : `apps/web/scripts/seed-i18n-bindings.ts`
- Pipeline pur : `apps/web/src/lib/i18n/seed-bindings.ts`
- Tests : `apps/web/src/lib/i18n/seed-bindings.test.ts` (21 tests)
- Validation Python : `docs/i18n-content-2026-05/scripts/validate-seeds.py`
- Sources CSV : `docs/i18n-content-2026-05/03-seed-data/`
- Schéma DB : `apps/web/src/lib/db/schema.ts` § `componentFieldBindings`
- Queries DB : `apps/web/src/lib/db/queries/component-fields.ts`
- Plan d'action : `docs/i18n-strategy-2026-05/08-plan-action/phases.md` §Phase 6
- Stratégie données : `docs/i18n-strategy-2026-05/06-data-strategy/seed-translations.md`
- Stratégie URL : `docs/i18n-strategy-2026-05/02-design-conception/url-strategy.md`

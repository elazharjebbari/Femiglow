# 06 — Data strategy i18n

> **Périmètre** : tout ce qui touche au **data layer** de l'internationalisation FemiGlow — schemas DB additionnels, seed, migration historique du FR hardcoded, inventaire des clés à extraire, workflow translateur, extraction automatisée. Lecture ~ 30 min, ~ 2500 lignes au total.

## TL;DR

FemiGlow opte pour un **storage hybride** :

- **JSON statiques** (`apps/web/messages/[locale].json`) pour les ~600-800 strings UI fixes (boutons, navigation, sections marketing). Bundle build-time, type-safe, edge-cache.
- **PostgreSQL** pour le contenu CMS dynamique :
  - `component_field_bindings` (déjà multilingue, champ `locale` existant)
  - `legal_pages` (déjà multilingue)
  - `seo_overrides` (déjà multilingue)
  - **Nouvelle table** `i18n_locales` (config par locale : direction, fallback, currency, sortOrder)
  - **Tables miroir optionnelles** `i18n_translation_keys` + `i18n_translation_values` (V2 — admin coverage)
- **Workflow translateur V1** : export CSV depuis admin → traducteur externe (Google Sheets) → import CSV → review founder → publish.
- **Workflow V2** : intégration TMS (Crowdin ou Lokalise) via webhooks GitHub.

L'effort principal n'est pas la création de tables (le schéma est déjà préparé), mais **l'extraction systématique des ~600-800 strings FR hardcoded** vers `messages/fr.json` via un outil AST (ts-morph) couplé à un review humain.

## Sommaire du sous-dossier

| # | Fichier | Rôle | Lignes |
|---|---|---|---|
| 0 | [`README.md`](./README.md) (ce fichier) | Index + TL;DR data strategy | ~250 |
| 1 | [`translation-tables.sql`](./translation-tables.sql) | DDL Drizzle/PostgreSQL : `i18n_locales`, tables miroir, triggers, RLS, migration Drizzle | ~400 |
| 2 | [`seed-translations.md`](./seed-translations.md) | Stratégie seed initial : `seed-i18n.ts`, ordre FR > AR > EN, fixtures tests, idempotence | ~500 |
| 3 | [`migration-historique.md`](./migration-historique.md) | Migration du FR hardcoded → messages.json : script AST, validation, rollback, effort | ~500 |
| 4 | [`translation-keys-inventory.csv`](./translation-keys-inventory.csv) | ~80 lignes prévisionnelles des clés à extraire (priorité P0/P1/P2) | 80+ |
| 5 | [`workflow-translation.md`](./workflow-translation.md) | Workflow founder → traducteur : export, traduction, import, QA, publish | ~600 |
| 6 | [`content-extraction.md`](./content-extraction.md) | Comment extraire les strings : outils, script ts-morph, cas particuliers | ~500 |

## Pourquoi un sous-dossier dédié au data

Trois raisons précises :

1. **Volumétrie** : ~600-800 strings × 3 locales = ~2400 valeurs à gérer. Sans process clair, drift garanti.
2. **Cycle de vie distinct** : le code change tous les jours, les traductions toutes les semaines. Découpler = essentiel.
3. **Acteurs multiples** : devs (extraction), founder (validation), traducteur externe (production), admin (import). Workflow explicite obligatoire.

## Décisions data actées

| Décision | Choix V1 | Alternative V2 |
|---|---|---|
| Format source UI | JSON files (`messages/[locale].json`) | TMS-managed (Crowdin/Lokalise) |
| Format source CMS | DB (`component_field_bindings.locale`) | Idem |
| Config locales | Table `i18n_locales` en DB | Hardcoded `i18n.config.ts` |
| Catalog des clés | Optionnel V1 (`i18n_translation_keys`) | DB obligatoire V2 |
| Workflow translateur | CSV manuel via admin export/import | Webhook Crowdin/Lokalise |
| Outil extraction | `ts-morph` custom script | `formatjs/cli` extract |
| Idiom plurals/numbers | ICU MessageFormat (next-intl) | Idem |
| RLS sur i18n tables | Lecture publique, écriture admin only | Idem |

## Architecture data — vue d'ensemble

```
                                ┌─────────────────────────────────────┐
                                │  i18n_locales (config)              │
                                │  fr, ar, en — direction, fallback   │
                                └────────────────┬────────────────────┘
                                                 │
                ┌────────────────────────────────┼────────────────────────────────┐
                │                                │                                │
                ▼                                ▼                                ▼
┌───────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
│ JSON files (build-time)   │  │ DB tables (runtime)       │  │ Optionnel V2 — DB mirror  │
├───────────────────────────┤  ├───────────────────────────┤  ├───────────────────────────┤
│ messages/fr.json          │  │ component_field_bindings  │  │ i18n_translation_keys     │
│ messages/ar.json          │  │ (locale, value, status)   │  │ (catalog des clés UI)     │
│ messages/en.json          │  │                           │  │                           │
│                           │  │ legal_pages               │  │ i18n_translation_values   │
│ ~600-800 clés UI          │  │ (locale, body_md)         │  │ (FK key + locale)         │
│ Bundle ~12 kB/locale      │  │                           │  │                           │
│                           │  │ seo_overrides             │  │ Sync via CLI:             │
│ Source of truth UI        │  │ (locale, title, desc)     │  │ json ↔ DB                 │
└──────────────┬────────────┘  └─────────────┬─────────────┘  └─────────────┬─────────────┘
               │                              │                              │
               ▼                              ▼                              ▼
        ┌───────────────────────────────────────────────────────────────────────┐
        │                       next-intl (RSC + edge middleware)              │
        └───────────────────────────────────────────────────────────────────────┘
```

## Flux principaux

### Flux 1 — Strings UI statiques (`common.back`, `marketing.hero.title`)

```
Dev pose la string FR
  ↓
extract-strings.ts détecte hardcode → propose clé `marketing.hero.title`
  ↓
Founder valide la clé (review PR)
  ↓
messages/fr.json à jour
  ↓
Founder exporte CSV vers traducteur (script export-translations)
  ↓
Traducteur remplit AR + EN dans Google Sheets
  ↓
Founder importe le CSV (script import-translations) → messages/ar.json + en.json
  ↓
Push branche → CI valide schema + coverage → review PR → merge → deploy
```

### Flux 2 — Contenu CMS dynamique (hero, manifesto, kit features)

```
Founder édite FR dans /admin/cms/[component]
  ↓
component_field_bindings(componentId, fieldKey, locale='fr', value, status='published')
  ↓
Founder clique "Cloner depuis FR" pour AR (bouton admin)
  ↓
Bindings AR créés en draft avec valeur FR copiée comme placeholder
  ↓
Founder exporte CSV CMS → traducteur traduit → import retour
  ↓
component_field_bindings(componentId, fieldKey, locale='ar', value, status='draft')
  ↓
Founder publie l'onglet AR → status='published' → revalidateTag('cms-component-...')
  ↓
Visiteur /ar/ voit le contenu AR (avec fallback FR par champ si manquant)
```

### Flux 3 — Pages légales (CGV, mentions, confidentialité)

```
Founder rédige body_md en FR (markdown long)
  ↓
legal_pages(slug='cgv', locale='fr', body_md='...', status='published')
  ↓
Founder exporte body_md → traducteur traduit le markdown
  ↓
legal_pages(slug='cgv', locale='ar', body_md='...', status='draft')
  ↓
Founder publie → visible sur /ar/legal/cgv
```

## Comment lire les fichiers de ce dossier

**Ordre suggéré** (cumulé ~30 min) :

1. **README.md** (10 min) : tu y es.
2. **translation-tables.sql** (5 min) : si tu es DBA / dev, le DDL est explicite.
3. **translation-keys-inventory.csv** (5 min) : ouvrir dans Excel ou VSCode, voir la diversité des clés.
4. **content-extraction.md** (5 min) : si tu vas extraire les strings.
5. **migration-historique.md** (5 min) : si tu pilotes la migration.
6. **workflow-translation.md** (3 min) : si tu vas dialoguer avec le traducteur.
7. **seed-translations.md** (2 min) : si tu mets en place le dev local.

## Personae adressés

| Persona | Quels fichiers | Pourquoi |
|---|---|---|
| **Lead technique** | tous | Décide go/no-go data layer |
| **Dev backend** | `translation-tables.sql`, `seed-translations.md` | Implémente migrations + seed |
| **Dev frontend** | `content-extraction.md`, `translation-keys-inventory.csv` | Extrait les strings |
| **Founder / PO** | `workflow-translation.md`, `migration-historique.md` | Pilote le contenu + traducteur |
| **Traducteur externe** | `workflow-translation.md` (chapitre dédié) | Comprend son rôle |
| **QA** | `migration-historique.md` (§ tests), inventory CSV | Valide la coverage |

## Conventions du dossier

- **SQL** : valide PostgreSQL 16 (Neon prod). Compatible Drizzle migrations.
- **TypeScript** : strict mode, conventions FemiGlow (cf. `02-design-conception/naming-conventions.md`).
- **CSV** : compatible Excel + Google Sheets (UTF-8 BOM, séparateur virgule, quote double).
- **Markdown** : sections numérotées, tableaux Markdown, code blocks fenced.
- **Niveau detail** : exhaustif. Si on supprime ce sous-dossier, on ne peut pas reconstruire la stratégie data.

## Anti-patterns recensés à travers le sous-dossier

1. **Hardcoder une locale dans une table** : utiliser FK `i18n_locales(code)` partout.
2. **Stocker du markdown long dans `messages.json`** : préférer `legal_pages.body_md`.
3. **Exporter sans versioning** : chaque export CSV doit avoir un timestamp + hash + scope.
4. **Importer sans diff visible** : afficher avant/après dans l'admin avant `commit`.
5. **Skip review du founder** : automatiser le pipeline mais TOUJOURS exiger un valid humain avant `published`.
6. **Pas de fallback** : ne jamais retourner `undefined` ou `null` pour une string visible.
7. **Trop de churn sur les clés** : renommer = casser 3 locales + risque de drift. Faire le moins possible.

## Métriques data à tracker dès Phase 1

| Métrique | Où | Cible |
|---|---|---|
| Nombre de clés UI extraites | `messages/fr.json` lint | 600-800 |
| % coverage FR | `pnpm i18n:coverage --locale=fr` | 100% |
| % coverage AR | idem | ≥ 90% V1, 100% V2 |
| % coverage EN | idem | ≥ 90% V1, 100% V2 |
| Nombre de bindings CMS par locale | `SELECT locale, COUNT(*) FROM component_field_bindings GROUP BY locale` | Croissance ~stable |
| Fallbacks servis / jour | Sentry log `cms.fallback_served` | < 100 / jour |
| Pages légales traduites | `SELECT slug, locale, status FROM legal_pages WHERE status='published'` | 9 templates × 3 locales |
| Temps moyen export → import (J+0 trad) | Audit log `i18n.export`, `i18n.import` | < 7 jours |

## Références croisées

- Stack et options : [`01-options-techniques/comparaison-libraries.md`](../01-options-techniques/comparaison-libraries.md)
- Architecture cible : [`02-design-conception/architecture-cible.puml`](../02-design-conception/architecture-cible.puml)
- Data model détaillé : [`02-design-conception/data-model.md`](../02-design-conception/data-model.md)
- Naming conventions : [`02-design-conception/naming-conventions.md`](../02-design-conception/naming-conventions.md)
- Content translation backend : [`03-backend/content-translation.md`](../03-backend/content-translation.md)
- Translation store backend : [`03-backend/translation-store.md`](../03-backend/translation-store.md)
- API routes admin i18n : [`03-backend/api-routes.md`](../03-backend/api-routes.md)
- Plan d'action global : [`08-plan-action/phases.md`](../08-plan-action/phases.md)
- Runbook ajout langue : [`09-runbook/ajouter-nouvelle-langue.md`](../09-runbook/ajouter-nouvelle-langue.md)
- Tests data : [`07-tests/data-tests.md`](../07-tests/data-tests.md)

## Risques et mitigations data

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Drift entre `messages/fr.json` et `i18n_translation_values` | Moyenne | Confusion debug | CLI `sync-keys` qui détecte et propose merge |
| FK violation au seed (`fallback_locale` invalide) | Faible | Migration échoue | Ordre du seed par `sort_order` ASC ; tests unit |
| Traducteur retourne un CSV mal formaté (placeholders cassés) | Moyenne | Plurals broken en prod | Validation regex à l'import + diff visible avant commit |
| Founder oublie de promouvoir drafts en published | Moyenne | Locale incomplète en prod | Dashboard `/admin/i18n/queue` alerte drafts > 7j |
| Cache stale après publish | Faible | Visiteur voit ancien contenu | `revalidateTag('i18n-${locale}')` + audit log |
| Pages légales body_md trop volumineuses pour CSV | Faible | Export pénible | Export markdown séparé via `/api/admin/legal/export?locale=fr` |
| ESLint rule trop stricte casse l'admin | Moyenne | DX dégradée | Whitelist `**/admin/**` jusqu'à V2 |

## Décisions à valider par le founder avant Phase 1

1. **Currency MAD uniquement V1** : pas de conversion runtime EUR/USD. OK ?
2. **`en` désactivé au seed** : activation Phase 5 seulement. OK ?
3. **AR = MSA**, pas darija (sauf chat). OK ?
4. **Workflow CSV manuel V1** : pas de TMS payant. Revue après 3 mois. OK ?
5. **Admin reste FR uniquement V1** : pas d'i18n côté backoffice. OK ?
6. **Pas de `i18n_translation_keys` DB seed V1** : JSON files source of truth, DB sync optionnel. OK ?
7. **Fallback chain ar→fr, en→fr, fr→null** : simple à 1 niveau. OK ?

## Roadmap data — vue d'ensemble

```
Sprint 0 (Phase 0) — Étude validée
  ├─ Décisions ADR sur stockage hybride
  └─ Validation founder des 7 décisions ci-dessus

Sprint 1 (Phase 1) — Foundation data
  ├─ Migration 0076 i18n_locales appliquée dev → staging → prod
  ├─ Script seed-i18n.ts opérationnel
  ├─ Backfill component_field_bindings + legal_pages + seo_overrides
  ├─ Script extract-strings.ts MVP testé sur 5 fichiers
  └─ Documentation translateur partagée

Sprint 2 (Phase 2) — Content extraction
  ├─ Extraction complète des 600-800 strings via AST
  ├─ Review humaine + clés normalisées
  ├─ messages/fr.json à 100%
  ├─ ESLint rule en gate CI
  └─ Refactor des composants (1 par 1)

Sprint 3 (Phase 3) — CMS multilingue
  ├─ UI admin saisie par locale
  ├─ Repo + Service avec fallback
  ├─ Clone bindings FR → AR draft
  └─ Workflow founder ↔ traducteur cadencé

Sprint 4 (Phase 4) — Premier cycle traduction
  ├─ Export CSV admin (UI + CMS)
  ├─ Traducteur AR livre Vague 1 (P0)
  ├─ Import + QA staging
  └─ Publish AR

Sprint 5 (Phase 5) — Activation EN
  ├─ Locale EN enabled=true
  ├─ Traducteur EN livre P0+P1
  ├─ QA + publish
  └─ Sitemap multilingue activé

Sprint 6+ (Phase 6+) — Monitoring + iterations
  ├─ Coverage dashboard production
  ├─ Sentry alerts missing keys
  ├─ Workflow rétro-feedback
  └─ Préparation V2 TMS si volume justifie
```

## Volumétrie estimée par table

| Table | Lignes V1 (3 locales) | Lignes V2 (5 locales) |
|---|---|---|
| `i18n_locales` | 3 | 5 |
| `i18n_translation_keys` (V2) | 600-800 | 600-800 |
| `i18n_translation_values` (V2) | 1800-2400 | 3000-4000 |
| `component_field_bindings` (déjà existante) | 200 (fr) × 3 = ~600 | ~1000 |
| `legal_pages` (déjà existante) | 9 × 3 = 27 | 45 |
| `seo_overrides` (déjà existante) | ~10 × 3 = 30 | 50 |

**Total estimé V1** : ~2500 lignes nouvelles (négligeable comparé à `tracking_events_log` qui fait des millions).

## Checklist Phase 1 — data layer

- [ ] Migration `0076_i18n_locales.sql` créée et testée
- [ ] Seed `seed-i18n.ts` exécuté en dev → 3 locales seedées (fr, ar, en)
- [ ] `messages/fr.json` initial créé avec les 600+ clés extraites
- [ ] Script `extract-strings.ts` opérationnel + intégré pnpm command
- [ ] `component_field_bindings.locale` backfill FR à 100%
- [ ] `legal_pages.locale` backfill FR à 100%
- [ ] `seo_overrides.locale` backfill FR à 100%
- [ ] FK contraintes sur `locale` colonne dans 3 tables existantes
- [ ] RLS policies actives sur `i18n_locales` (lecture publique, écriture admin)
- [ ] Export CSV admin fonctionnel (`/api/admin/i18n/export`)
- [ ] Import CSV admin fonctionnel (`/api/admin/i18n/import`)
- [ ] Audit log `i18n.export` et `i18n.import` opérationnel
- [ ] Tests unit `i18n_locales` repo (lookup, fallback chain)
- [ ] Tests unit script extraction (cas borderlines couverts)
- [ ] View `v_i18n_coverage` accessible côté admin
- [ ] Documentation traducteur lisible (`workflow-translation.md`)
- [ ] Glossaire FemiGlow distribué au traducteur
- [ ] Style guide par locale validé par founder
- [ ] Slack channel `#i18n-translation` créé

## Notes de versioning

- **2026-05-27** — Création initiale (Claude, sprint i18n strategy).
- À mettre à jour à chaque modification structurelle du data layer.

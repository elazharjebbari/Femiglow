# Architecture cible

> Vision après application du fix complet (T6).

## 1. Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  ADMIN /admin/legal                                       │
│                                                                           │
│  /admin/legal              → liste des pages (filtrée, sans orphelins)   │
│  /admin/legal/[slug]/edit  → éditeur markdown + live preview             │
│  /admin/legal/template-vars→ list + create + edit vars  ✨ NEW: create   │
│  /admin/legal/new          → wizard création                             │
│  /admin/legal/placements   → où afficher les pages                       │
│  /admin/legal/redirects    → règles de redirection                       │
│  /admin/legal/health       → score qualité (link checker)                │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  API /api/admin/legal                                    │
│                                                                           │
│  POST /api/admin/legal/template-vars   ✨ NEW (create new var)          │
│  PUT /api/admin/legal/template-vars/:key   (update value)                │
│  POST /api/admin/legal/[slug]/publish   (publish workflow)               │
│  POST /api/admin/legal/seed-defaults   (seed 9 pages from docs/legal/)   │
│  DELETE /api/admin/legal/cleanup-e2e   ✨ NEW (cleanup orphelins)       │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     DB tables                                            │
│                                                                           │
│  legal_pages                                                              │
│  ┌──────────────────────────┐                                            │
│  │ id, slug, title, body_md │  ← templates avec {{KEY}}                  │
│  │ status, version          │                                             │
│  │ require_legal_review     │                                             │
│  │ created_at, updated_at   │                                             │
│  └──────────────────────────┘                                            │
│                                                                           │
│  legal_template_vars                                                      │
│  ┌──────────────────────────┐                                            │
│  │ id, key, label, value    │  ← APRÈS RENAME (CONTACT_*, HOST_*, etc.) │
│  │ is_required, description │                                             │
│  │ sort_order               │                                             │
│  └──────────────────────────┘                                            │
│                                                                           │
│  legal_pages_history                                                      │
│  ┌──────────────────────────┐                                            │
│  │ snapshots de chaque      │                                             │
│  │ version publiée          │                                             │
│  └──────────────────────────┘                                            │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              PUBLIC /legal/[slug]                                         │
│                                                                           │
│  - SSR markdown → HTML                                                    │
│  - substituteVars({{KEY}} → value)                                        │
│  - presetVarsForPage : VERSION, LAST_UPDATED auto ✨ NEW                  │
│  - mode 'public' : fallback [KEY] si var manquante                        │
│  - Vars sensibles (ICE, RC) → remplacées par bloc "info sur demande"     │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. Différentiel avant/après

### 2.1 Vars `legal_template_vars`

| Avant | Après |
|---|---|
| 17 vars dont 6 drift avec templates | 17 vars renommées + 7 vars ajoutées = 24 vars |
| `COMPANY_EMAIL` (drift) | `CONTACT_EMAIL` ✅ |
| `COMPANY_PHONE` (drift) | `CONTACT_PHONE` ✅ |
| `HOSTING_ADDRESS` (drift) | `HOST_ADDRESS` ✅ |
| `HOSTING_NAME` (drift) | `HOST_NAME` ✅ |
| `HOSTING_PHONE` (drift) | `HOST_CONTACT` ✅ |
| `CNDP_DECLARATION` (drift) | `CNDP_DECLARATION_REF` ✅ |
| — | + `COOLING_OFF_DAYS` |
| — | + `CURRENCY` |
| — | + `DATA_RETENTION_YEARS` |
| — | + `DELIVERY_PARTNER` |
| — | + `PAYMENT_PROVIDERS` |
| — | + `SUPPORT_HOURS` |
| — | (VERSION devient preset, pas en DB) |

### 2.2 Templates pages publiées

| Page | Avant (vars sensibles présentes) | Après (anonymisé) |
|---|---|---|
| `mentions-legales` | ICE, RC, COMPANY_ADDRESS, COMPANY_CAPITAL, DIRECTOR_NAME en clair | Bloc "info sur demande" + email contact |
| `cgv` | ICE, COMPANY_RC, COMPANY_NAME en clair | COMPANY_NAME + bloc "info juridique sur demande" |
| `confidentialite` | ICE, COMPANY_RC, COMPANY_ADDRESS, COMPANY_FORM | Identité minimale + bloc "info sur demande" |
| `retours-remboursements` | COMPANY_NAME, COMPANY_ADDRESS, COOLING_OFF_DAYS | COMPANY_NAME, COOLING_OFF_DAYS, "info sur demande" |

### 2.3 Helpers `vars.ts`

| Avant | Après |
|---|---|
| `presetVars(now)` — 3 presets | `presetVars(now)` — 3 presets (inchangé) |
| — | ✨ `presetVarsForPage(page, now)` — `VERSION` + `LAST_UPDATED` dérivés |

### 2.4 Endpoints API

| Avant | Après |
|---|---|
| `PUT /api/admin/legal/template-vars/[key]` | (inchangé) |
| — | ✨ `POST /api/admin/legal/template-vars` (create new var) |
| — | ✨ `DELETE /api/admin/legal/cleanup-e2e` (cleanup orphelins) |

### 2.5 UI

| Avant | Après |
|---|---|
| `template-vars` : list + edit value | + bouton "+ Nouvelle variable" + modal/form |
| `/admin/legal` : 14 pages affichées | 9 pages (5 orphelines supprimées) |

## 3. Couches affectées

### 3.1 Backend (cœur du fix)

- **Migration SQL** : `0075_legal_vars_rename_and_add.sql` — rename 6 + INSERT 7
- **Helpers** :
  - `vars.ts` (+ `presetVarsForPage`)
  - `template-vars-helpers.ts` (nouveau, logique create-var)
- **Endpoints** : `template-vars/route.ts` (+ POST), `cleanup-e2e/route.ts` (nouveau)
- **Feature flag** : `legal/feature-flag.ts` (nouveau, `LEGAL_VARS_V2`)

### 3.2 Frontend (UI + cosmétique)

- **`template-vars/page.tsx`** : section "+ Nouvelle variable" en tête
- **`<CreateVarForm />`** : nouveau client component avec validation Zod
- Pages publiques `/legal/*` : rendu mis à jour via presets

### 3.3 Templates seed source

- `docs/legal-pages/60-content/mentions-legales.md` : refonte
- `docs/legal-pages/60-content/cgv.md` : ICE/RC retirés ou "sur demande"
- `docs/legal-pages/60-content/confidentialite.md` : idem
- `docs/legal-pages/60-content/retours-remboursements.md` : idem

### 3.4 Data layer

- Migration appliquée local + staging + prod (3 envs)
- Cleanup E2E orphelins (5 rows DELETE local + staging + prod)
- Backfill : aucun (les valeurs existantes restent intactes lors du rename)

### 3.5 Tests

- Vitest unit : 4 tests (presetVarsForPage, publish post-rename, create-var endpoint, invariant cross-table)
- MSW : 2 tests (create-var flow, publish post-fix)
- Playwright `@legal-purity` : 5 specs
- Smoke : 1 script

### 3.6 Code marketing (anonymisation)

- `(marketing)/maison/page.tsx` : 1 occurrence
- `(marketing)/contact/page.tsx` : 2 occurrences
- `(marketing)/kit/page.tsx` : 1 occurrence
- `(marketing)/rituel/page.tsx` : 1 occurrence
- `api/rituals/policy/route.ts` : 1 occurrence
- `admin/rituals/best-practices/page.tsx` : 3 occurrences (laissé selon ADR-008)

## 4. Diagramme de séquence — publish après fix

```
Admin              Edit page              Publish API         DB
  │                  │                        │                 │
  │ Edit body_md     │                        │                 │
  ├─────────────────►│                        │                 │
  │ Save             │                        │                 │
  ├─────────────────►│ POST .../update        │                 │
  │                  ├───────────────────────►│ UPDATE legal_pages
  │                  │                        ├────────────────►│
  │                  │ 200 OK                 │                 │
  │                  │◄───────────────────────┤                 │
  │ Click "Publier"  │                        │                 │
  ├─────────────────►│ POST .../publish       │                 │
  │                  ├───────────────────────►│                 │
  │                  │                        │ detectMissingVars(body_md, vars+presets)
  │                  │                        ├─────┐           │
  │                  │                        │     │ presetVarsForPage adds VERSION
  │                  │                        ◄─────┘           │
  │                  │                        │ missing = [] ✅ │
  │                  │                        │                 │
  │                  │                        │ INSERT history + UPDATE status='published'
  │                  │                        ├────────────────►│
  │                  │ {version: 2, …} ✅     │                 │
  │                  │◄───────────────────────┤                 │
                                          ★ Page publiée
                                          ★ /legal/cgu accessible
                                          ★ HTML rendu sans vars manquantes
```

## 5. Invariants à respecter

- **I1** : aucune valeur ne disparait lors du rename (UPDATE in-place préserve)
- **I2** : `LEGAL_VARS_V2=false` → comportement strictement identique à l'avant
- **I3** : toutes les vars utilisées dans `body_md` sont définies en DB OU presets (testé en CI)
- **I4** : aucune page publiée ne contient `[KEY]` (fallback public) après le fix
- **I5** : aucune page publiée n'affiche un ICE de 15 chiffres ni un RC `Ville-NNNNN` (testé en Playwright)
- **I6** : `grep -ri "souheila" apps/web/src/app/(marketing)/` retourne 0 résultat (testé)
- **I7** : la table `legal_pages` ne contient aucune row `e2e-test-*` > 7 jours (cron)

## 6. Cas limites considérés

| Cas | Traitement |
|---|---|
| Rename impacte une valeur custom que la fondatrice a saisie | UPDATE préserve `value`, change uniquement `key` → safe |
| Page utilise une var non définie après migration | Fallback `[KEY]` (existant) — pas de crash, juste visible |
| 2 vars renommées au même nom (collision) | Impossible : le rename est 1:1 et chaque target est unique |
| Migration rolled back après deploy | Feature flag off → queries reviennent au naming legacy. Schéma OK car valeurs préservées |
| Pages e2e-test créées en prod par run smoke | DELETE filtré par `slug LIKE 'e2e-test-%' AND status='draft' AND age>7d` ne touchera pas les pages metier |
| Juriste rejette anonymisation après deploy | Re-publish manuel des pages avec version précédente (history table) |

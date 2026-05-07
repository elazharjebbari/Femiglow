# 17 — Onboarding & robustesse (6 améliorations purement locales)

> *Spec et runbook : 6 améliorations purement locales, zéro
> dépendance externe ajoutée. Onboarding accéléré, traçabilité
> complète, robustesse renforcée.*

---

## 1. Vue d'ensemble

Trois axes, six features ; total ~ 7 jours d'effort. Aucune
dépendance cloud, API externe ou server-side.

| Axe                | Features                                              | Effort |
| ------------------ | ----------------------------------------------------- | ------ |
| **Onboarding**     | Q3 Templates · L1 Bulk import CSV                      | 2 j    |
| **Traçabilité**    | Q1 Diff visuel · L8 Snapshot Git auto                  | 3 j    |
| **Robustesse**     | L6 Linter post-génération · Q5 Zod renforcée           | 2 j    |

## 2. Architecture cible

```
apps/web/src/lib/tracking/gtm/
├── templates.ts              ★ Q3 — presets prédéfinis
├── csv-import.ts             ★ L1 — parser CSV → GtmConfigPerEnv
├── linter.ts                 ★ L6 — vérif container produit
├── snapshot.ts               ★ L8 — écriture infra/gtm/container.*.json
├── config-schema.ts          ◐ Q5 — Zod renforcée (cross-env checks)
├── builders.ts               ◐ L6 — invocation linter
└── exporter.ts               ◐ L6 — expose lint warnings dans GtmExport

apps/web/src/components/admin/tracking/gtm/
├── GtmTemplatePicker.tsx     ★ Q3 — bouton "Partir d'un template"
├── GtmCsvImport.tsx          ★ L1 — modale upload CSV
├── GtmConfigDiff.tsx         ★ Q1 — diff visuel côte à côte
├── GtmLinterReport.tsx       ★ L6 — affiche les warnings/erreurs
├── GtmConfigForm.tsx         ◐ intégration template + csv import
└── GtmConfigClient.tsx       ◐ branche le diff et l'audit

infra/gtm/                    ★ L8 — snapshots Git versionnés
├── container.production.json
├── container.stage.json
├── container.preview.json
└── container.dev.json

apps/web/src/app/api/admin/tracking/gtm/
└── snapshot/route.ts         ★ L8 — POST déclenche écriture fichier
```

## 3. Spécifications par feature

### 3.1 Q3 — Templates de configs

**Objectif** : un nouvel admin onboarde sa GTM en 5 minutes au
lieu d'une heure.

**Templates V1** (4) :

```ts
type GtmTemplate = {
  id: string;
  name: string;
  description: string;
  audience: 'maroc-ecommerce' | 'sandbox' | 'b2b-saas' | 'minimal';
  perEnv: GtmConfigPerEnv;
};
```

| ID                    | Cible                                          | Pré-remplit                                                        |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| `maroc-ecommerce`     | E-commerce B2C Maroc (FemiGlow standard)       | Currency MAD, GA4 + Meta + TikTok + Snap + Pin sur prod, GA4 seul ailleurs |
| `sandbox`             | Tests / debug                                   | Tout en GA4 dev avec ID factice, autres providers vides             |
| `b2b-saas`            | SaaS / lead-gen                                | Currency EUR, GA4 + Meta + Ads sur prod, focus lead conversions     |
| `minimal`             | Démarrage progressif                            | GA4 prod seul, autres envs vides                                    |

**UX** : bouton "Partir d'un template" en haut du formulaire,
modale de choix avec preview des valeurs pré-remplies.

### 3.2 L1 — Bulk import CSV

**Objectif** : coller un CSV (export tableur) et auto-remplir.

**Format CSV attendu** :

```csv
env,variable,value
production,ga4MeasurementId,G-PROD0000
production,metaPixelId,11111111111
production,googleAdsConvLabels.purchase,AW-XXX/abc123
stage,ga4MeasurementId,G-STAGE000
preview,ga4MeasurementId,G-PREV0000
dev,ga4MeasurementId,
```

**Règles** :
- Header optionnel (si absent, on assume `env,variable,value`)
- Quote support (`"valeur,avec,virgules"`)
- Lignes vides ignorées
- Variables inconnues → warning, ignorées
- Envs non listés → restent inchangés (merge, pas overwrite global)
- Conv labels : notation pointée `googleAdsConvLabels.purchase`

**UX** : modale avec textarea (paste), aperçu des valeurs détectées
par env, boutons Annuler / Appliquer.

### 3.3 Q1 — Diff visuel

**Objectif** : comparer 2 versions de config visuellement.

**Composant `<GtmConfigDiff>`** :
- Prend deux `GtmConfigVersion`
- Affiche un tableau 4 colonnes : champ, val A, val B, statut
- Surligne les lignes qui diffèrent en sauge `#A8C4A6/15`
- Filtre "Différences seulement" / "Tout afficher"
- Sticky header environnement

**UX** : bouton "Voir le diff" sur chaque version archivée → modale
plein écran avec sélecteur "Comparer avec : [active|version-X]".

**Pas de nouvelle route API** : le diff est calculé côté client à
partir de deux GET `/configs/:id`.

### 3.4 L8 — Snapshot Git auto

**Objectif** : chaque activation de version écrit `infra/gtm/container.<env>.json`
versionné dans Git → historique complet, blame, revert facile.

**Mécanisme** :

```
[admin clique Activer]
    ↓
POST /api/admin/tracking/gtm/configs/[id]/activate
    ↓
gtmConfigStore.activate()
    ↓
[hook post-activate] → snapshot.writeAll()
    ↓
4 fichiers écrits :
  infra/gtm/container.production.json
  infra/gtm/container.stage.json
  infra/gtm/container.preview.json
  infra/gtm/container.dev.json
    ↓
[admin commit dans Git si sur dev local]
```

**Comportement** :
- En **production runtime** (Vercel) : skip (read-only filesystem). Log info.
- En **dev local** : écrit les 4 fichiers, l'admin commit dans Git.
- Filename inclut sha256 dans le header JSON pour audit.
- Endpoint dédié `POST /api/admin/tracking/gtm/snapshot` pour
  forcer l'écriture sans changement d'active (utile post-modif catalog).

**Sécurité** : écriture uniquement dans `infra/gtm/` (path traversal
protégé). Pas d'accès en dehors.

### 3.5 L6 — Linter post-génération

**Objectif** : détecter les containers invalides avant qu'ils
ne sortent.

**Règles V1** :

| Code              | Sévérité | Description                                                       |
| ----------------- | -------- | ----------------------------------------------------------------- |
| `orphan_trigger`  | warning  | Trigger défini sans tag qui le référence                          |
| `tag_no_trigger`  | error    | Tag sans `firingTriggerId` (sera ignoré par GTM)                  |
| `duplicate_name`  | error    | Deux tags / triggers / variables avec le même nom                 |
| `setup_unknown`   | error    | `setupTag` référence un tag inexistant                            |
| `var_orphan`      | info     | Variable jamais utilisée par un tag (potentiel mort)              |
| `trigger_unused`  | info     | Trigger non référencé (déjà couvert par orphan_trigger en partie) |
| `pixel_id_blank`  | warning  | Pixel ID vide en prod alors que provider activé                   |
| `convlabel_format`| warning  | Conv label sans format `AW-XXX/abc`                               |

**API** :

```ts
type LintReport = {
  errors: LintIssue[];
  warnings: LintIssue[];
  infos: LintIssue[];
  ok: boolean;  // true si errors.length === 0
};

type LintIssue = {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  refType: 'tag' | 'trigger' | 'variable' | 'config';
  refName: string;
  hint?: string;
};
```

**Intégration** :
- `gtmExporter.build()` retourne désormais `lintReport` en plus de `container/pretty/...`
- Affichage `<GtmLinterReport>` dans l'onglet Export en bas, plié par défaut, déplié si errors > 0
- En CLI `gtm-generate.ts` : si errors > 0, exit code 1 (sauf flag `--no-lint`)

### 3.6 Q5 — Zod renforcée

**Objectif** : refuser les configs aberrantes au moment de la
sauvegarde.

**Règles cross-env ajoutées** :

| Règle                                                              | Sévérité | Action                                  |
| ------------------------------------------------------------------ | -------- | --------------------------------------- |
| Pixel prod identique à un Pixel dev/sandbox connu (`*-DEV*`, `*-SANDBOX*`) | error    | Reject 400 avec message clair           |
| `enabledProviders` includes `meta` mais `metaPixelId` vide         | warning  | Accepter mais surfacer dans linter       |
| `googleAdsConvLabels.purchase` défini mais `googleAdsCustomerId` vide | error    | Reject : Conv labels sans customer = inutile |
| Toutes les valeurs prod identiques à stage (copier-coller raté)    | warning  | Accepter mais surfacer                   |
| GA4 ID vide en prod alors que `enabledProviders` includes `google_ga4` | error    | Reject — incohérence garantie            |

**Implémentation** : Zod `superRefine` sur `gtmConfigPerEnvSchema`.

## 4. Données

Pas de nouvelle table. On étend les types existants :

```ts
// types.ts (étendu)
export interface GtmExport {
  container: GtmContainer;
  pretty: string;
  minified: string;
  stats: GtmStats;
  meta: GtmMeta;
  env: GtmEnvironment;
  lintReport: LintReport;            // ★ nouveau
}
```

## 5. UI / UX

### 5.1 Onglet Configurations — augmenté

```
┌───────────────────────────────────────────────────────────────┐
│ [📋 Partir d'un template] [📥 Importer CSV] [+ Nouvelle vide] │
├───────────────────────────────────────────────────────────────┤
│ Nom : [______________________]                                 │
│ Notes : [______________________]                                │
│                                                                │
│ [Tableau 4 colonnes envs × 12 variables]                       │
│ [boutons Tous / Pub. par ligne]                                │
│                                                                │
│ ── Validation cross-env ────────────────────                  │
│ ⚠ Meta activé mais Pixel ID vide en preview                  │
│ ✗ GA4 ID vide en prod (provider activé)                      │
│                                                                │
│ [Créer la version]                                             │
└───────────────────────────────────────────────────────────────┘
```

### 5.2 Diff version

```
┌───────────────────────────────────────────────────────────────┐
│ Comparaison v3 (active) ↔ v2 archivée                         │
│ Filter: [☑ Différences seulement] [Tout]                      │
│                                                                │
│ │ Variable          │ v3 (active)   │ v2 archivée  │ Δ      │
│ │ prod.ga4_id       │ G-PROD0001    │ G-PROD0000   │ ●     │
│ │ prod.meta_pixel   │ 22222222222   │ 11111111111  │ ●     │
│ │ stage.ga4_id      │ G-STAGE000    │ G-STAGE000   │ —     │
└───────────────────────────────────────────────────────────────┘
```

### 5.3 Linter Report

```
┌───────────────────────────────────────────────────────────────┐
│ ▾ Validation du container — 2 warnings, 0 erreur              │
│                                                                │
│ ⚠ tag_no_trigger : "Aux JS — Page Type" n'a pas de trigger    │
│   astuce : ajoute le trigger PV — All Pages                   │
│                                                                │
│ ⚠ pixel_id_blank : Meta Pixel ID vide en stage                │
│   astuce : utilise les boutons "Pub." pour propager           │
└───────────────────────────────────────────────────────────────┘
```

## 6. Charte / design

- Sauge `#A8C4A6/15` pour les lignes modifiées du diff
- Champagne `#C8A876` pour les hashes / IDs sensibles
- Stone-50/200 standard pour le reste
- Toutes les modales utilisent `<GtmFullscreenPreview>` réutilisable
- Animations conformes aux keyframes existantes (`fg-fade-in`, `fg-pop-in`)

## 7. Backend / sécurité

### 7.1 Snapshot Git

- Path traversal protégé : seul `infra/gtm/<safe-name>.json` est autorisé
- Lecture seule en prod (Vercel) : try/catch silencieux + log
- Atomicity : write to temp + rename
- Permissions : audit `tracking_gtm.snapshot_write`

### 7.2 CSV import

- Pas d'eval, parser pur regex/split
- Limite 1000 lignes max (anti-DoS)
- Quote handling propre
- Variables inconnues → warning silencieux, pas crash

### 7.3 Linter

- Pure function (pas de side-effect)
- Synchronous, < 50 ms sur 100 tags
- Désactivable via `--no-lint` en CLI

## 8. Tests

### 8.1 Unit Vitest

| Fichier                    | Cas | Couvre |
| -------------------------- | --- | ------ |
| `templates.test.ts`        | 6   | 4 templates × validation Zod + valeurs cohérentes |
| `csv-import.test.ts`       | 12  | parsing happy path, quotes, lignes vides, var inconnue, conv labels pointés |
| `linter.test.ts`           | 18  | 8 règles × happy + bad path |
| `snapshot.test.ts`         | 6   | path traversal, atomicity, prod skip |
| `config-schema.test.ts`    | 10  | superRefine cross-env (les 5 règles) |

### 8.2 Intégration Vitest

| Fichier                                  | Cas |
| ---------------------------------------- | --- |
| `GtmTemplatePicker.test.tsx`             | 4   |
| `GtmCsvImport.test.tsx`                  | 6   |
| `GtmConfigDiff.test.tsx`                 | 8   |
| `GtmLinterReport.test.tsx`               | 5   |
| Update `GtmConfigForm.test.tsx`          | +3  |
| Update `GtmExportClient.test.tsx`        | +2  |

### 8.3 E2E Playwright

| Spec                                              | Cas |
| ------------------------------------------------- | --- |
| `admin-tracking-gtm-onboarding.spec.ts` (★ nouveau) | 5  |

Total ajout : ~ 70 nouveaux cas Vitest + 5 specs Playwright.

## 9. Plan d'action — runbook

À exécuter dans le worktree `gtm-vars-viz`.

### Phase 1 — Robustesse backend (~ 2 j)

| ID         | Tâche                                                                |
| ---------- | -------------------------------------------------------------------- |
| ROB-001    | Créer `lib/tracking/gtm/linter.ts` avec les 8 règles                 |
| ROB-002    | Tests unitaires `linter.test.ts` (18 cas)                            |
| ROB-003    | Étendre `gtmExporter.build()` pour retourner `lintReport`            |
| ROB-004    | Étendre `config-schema.ts` avec `superRefine` (5 règles cross-env)   |
| ROB-005    | Tests `config-schema.test.ts` (10 cas)                               |
| ROB-006    | Mettre à jour `gtm-generate.ts` CLI : exit 1 si errors, flag `--no-lint` |

### Phase 2 — Onboarding (~ 2 j)

| ID         | Tâche                                                                |
| ---------- | -------------------------------------------------------------------- |
| ONB-001    | Créer `lib/tracking/gtm/templates.ts` (4 templates)                  |
| ONB-002    | Tests `templates.test.ts` (6 cas)                                    |
| ONB-003    | Créer `lib/tracking/gtm/csv-import.ts` (parser)                       |
| ONB-004    | Tests `csv-import.test.ts` (12 cas)                                  |
| ONB-005    | Composant `GtmTemplatePicker.tsx` (modale + 4 cards)                 |
| ONB-006    | Composant `GtmCsvImport.tsx` (textarea + preview + apply)            |
| ONB-007    | Intégration dans `GtmConfigForm.tsx` (2 boutons header)              |
| ONB-008    | Tests RTL des composants                                              |

### Phase 3 — Traçabilité (~ 3 j)

| ID         | Tâche                                                                |
| ---------- | -------------------------------------------------------------------- |
| TRC-001    | Créer `lib/tracking/gtm/snapshot.ts` (write atomic, path-safe)        |
| TRC-002    | Tests `snapshot.test.ts` (6 cas)                                     |
| TRC-003    | Hook post-activate dans `config-store.ts`                             |
| TRC-004    | Route `POST /api/admin/tracking/gtm/snapshot` (force write)            |
| TRC-005    | Composant `GtmConfigDiff.tsx` (diff visuel)                          |
| TRC-006    | Tests `GtmConfigDiff.test.tsx` (8 cas)                                |
| TRC-007    | Composant `GtmLinterReport.tsx`                                       |
| TRC-008    | Tests `GtmLinterReport.test.tsx` (5 cas)                              |
| TRC-009    | Intégration diff dans `GtmConfigVersionList` (bouton "Voir diff")     |
| TRC-010    | Intégration linter dans `GtmExportClient` (bas de page)               |
| TRC-011    | E2E Playwright `admin-tracking-gtm-onboarding.spec.ts` (5 specs)      |

### Phase 4 — Validation finale (~ 0.5 j)

| ID         | Tâche                                                                |
| ---------- | -------------------------------------------------------------------- |
| VAL-001    | Suite Vitest complète verte                                           |
| VAL-002    | Typecheck propre                                                     |
| VAL-003    | Lint propre                                                          |
| VAL-004    | Playwright list compile                                               |
| VAL-005    | Commit + log                                                          |

## 10. Critères d'acceptation V1

1. Un nouvel admin sélectionne un template → 4 envs × 12 champs sont
   pré-remplis cohérents.
2. Un admin colle un CSV → les valeurs sont fusionnées (pas écrasées),
   les variables inconnues sont signalées en warning.
3. L'admin clique "Voir diff" sur une version archivée → diff côte à côte
   avec filtre "Différences seulement".
4. Activer une version → 4 fichiers `infra/gtm/container.*.json` écrits
   en local (skip silencieux en prod Vercel).
5. Le panneau "Validation du container" en bas de l'onglet Export montre
   les warnings/erreurs du linter.
6. Une config avec `enabledProviders=['google_ga4']` mais `ga4MeasurementId=''`
   en prod est rejetée à la sauvegarde (Zod 400).
7. Tous les tests Vitest verts (zéro régression).
8. Typecheck + ESLint propres.
9. Playwright specs compilent.

## 11. Hors scope (V2+)

- Diff de containers générés (pas seulement de configs)
- Branches Git auto-créées sur chaque activation (overkill)
- Rollback automatique si linter errors > 0 sur la version active
- Templates communautaires partagés
- Visualisation des connexions cross-env dans le diff
- Linter rules custom configurables par admin

## 12. Lecture suivante

- [16 — Configs versionnées + visualisation](16-vars-config-and-viz.md)
  — sur quoi cette spec s'appuie
- [14 — Export depuis l'admin](14-admin-export.md) — onglet Export à enrichir
- [10 — Automatisation](10-automatisation.md) — CLI à mettre à jour avec linter

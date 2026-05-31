# 16 — Configurations versionnées + visualisation dynamique

> *Spec et runbook : édition des variables (Pixel IDs, Conv labels…)
> avec partage cross-environnement, versioning des configs avec
> historique, et onglet visualisation du container.json généré
> directement depuis le JSON.*

---

## 1. Objectifs

Trois capacités demandées :

| Capacité                                                                         | Pourquoi                                                                                       |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Configurer les valeurs des variables (Pixel IDs, Conv labels…) depuis l'admin    | Télécharger un container `container.json` **100 % prêt à importer** sans repasser par l'env file |
| Versionner les configurations + historique de suivi                               | Audit, rollback rapide, comparaison entre versions, onboarding                                  |
| Saisir un même pixel pour PROD + STAGE + PREVIEW + DEV en un clic                | Cas réel : on commence avec un seul Pixel ID partagé pour tester partout                        |
| Onglet visualisation dynamique généré du JSON                                    | Lecture humaine d'une config GTM, téléchargement SVG/PNG/code Mermaid, sans dépendre de l'UI Google |

## 2. Architecture cible

```
/admin/tracking/gtm                         (page Next.js)
├── Sous-onglet : Export        (existant V1.1 — enrichi pour consommer une config)
├── Sous-onglet : Configurations (★ nouveau)
│   ├── Formulaire d'édition (Pixel IDs, Conv labels, Currency…)
│   ├── Toggle "appliquer à tous les environnements"
│   ├── Liste des versions (v1, v2, …) avec activation/duplication/suppression
│   └── Diff visuel entre 2 versions
└── Sous-onglet : Visualisation (★ nouveau)
    ├── Sélecteur d'environnement + config
    ├── Graphe SVG dynamique généré depuis le container.json
    └── Téléchargement SVG / PNG / code Mermaid

Backend (lib/tracking/gtm/) :
├── builders.ts          (existant — accepte déjà GtmEnvConfig en override)
├── config-store.ts      (★ nouveau — CRUD versions de config)
├── exporter.ts          (existant — accepte ?configId)
├── viz/
│   ├── descriptor.ts    (★ nouveau — JSON → graphe)
│   ├── layout.ts        (★ nouveau — placement SVG)
│   └── mermaid.ts       (★ nouveau — JSON → Mermaid)

Couche data : tracking_settings (clé JSONB existante)
└── key = "gtm.config_versions"
    └── value = { activeId: string; versions: GtmConfigVersion[] }
```

## 3. Modèle de données

### 3.1 `GtmConfigVersion`

```ts
type GtmConfigVersion = {
  id: string;                          // UUID v4
  name: string;                        // "v1 — pixels initiaux"
  notes: string | null;                // changelog éditeur
  createdAt: string;                   // ISO 8601
  createdBy: string;                   // adminId
  perEnv: {
    production: GtmEnvConfig;
    stage: GtmEnvConfig;
    preview: GtmEnvConfig;
    dev: GtmEnvConfig;
  };
};

type GtmEnvConfig = {
  ga4MeasurementId: string;
  metaPixelId: string;
  tiktokPixelId: string;
  snapPixelId: string;
  pinterestTagId: string;
  googleAdsCustomerId: string;
  googleAdsConvLabels?: {
    purchase?: string;                  // "AW-XXX/abc123"
    lead?: string;
    signup?: string;
    initCheckout?: string;
  };
  defaultCurrency: string;              // "MAD"
  cookieDomain: string;                 // "auto"
  enabledProviders: ProviderKind[];
};
```

### 3.2 Stockage

Une seule entrée `tracking_settings` :

```jsonc
{
  "key": "gtm.config_versions",
  "value": {
    "activeId": "uuid-v3",
    "versions": [
      { "id": "uuid-v1", "name": "v1 …", "perEnv": {...}, ... },
      { "id": "uuid-v2", "name": "v2 …", ... },
      { "id": "uuid-v3", "name": "v3 …", ... }
    ]
  }
}
```

> **Choix** : pas de table dédiée. `tracking_settings` (JSONB) suffit
> pour le volume attendu (≤ 50 versions historiques). Évolution
> possible vers une table dédiée si > 200 versions ou besoin de
> requêtes fines.

### 3.3 Limites

| Limite                                | Valeur     |
| ------------------------------------- | ---------- |
| Versions conservées                   | 50 (FIFO)  |
| Taille d'une version                  | < 4 kB     |
| Taille totale du setting              | < 200 kB   |
| Versions actives simultanées          | 1          |
| Soft-delete                           | non (purge directe, FIFO sur les anciennes) |

## 4. Spécifications fonctionnelles

### 4.1 Formulaire de config

Champs **par environnement** (4 colonnes : prod / stage / preview / dev) :

- GA4 Measurement ID (`G-...`)
- Meta Pixel ID
- TikTok Pixel ID
- Snap Pixel ID
- Pinterest Tag ID
- Google Ads Customer ID
- Google Ads Conv Label — Purchase
- Google Ads Conv Label — Lead
- Google Ads Conv Label — Sign Up
- Google Ads Conv Label — Init Checkout
- Default Currency
- Cookie Domain
- Providers activés (multi-select)

**Toggle "appliquer à tous les environnements"** : copie la valeur du
champ courant dans les autres colonnes de la même ligne.

**Toggle "appliquer aux N environnements actifs"** (raccourci) :
copie vers prod + stage + preview seulement (skip dev).

### 4.2 Versions

Liste verticale, plus récente en haut. Pour chaque version :

| Colonne          | Contenu                                                |
| ---------------- | ------------------------------------------------------ |
| Statut           | ✓ Active / archivée                                    |
| Nom              | "v3 — switch Meta prod → mobile pixel"                 |
| Auteur           | adminId truncated                                       |
| Créée            | timestamp relatif                                       |
| Notes            | extrait du changelog                                    |
| Actions          | Activer · Dupliquer · Voir diff vs active · Supprimer  |

### 4.3 Diff

Comparaison côte à côte de deux versions (déroulé par champ).
Surbrillance des lignes modifiées en sauge. Pour V1 : diff JSON
brut (pretty) avec coloration ligne par ligne.

### 4.4 Téléchargement avec config

Sur l'onglet Export, ajout d'un sélecteur "Config" qui liste les
versions disponibles. Le bouton Télécharger génère le `container.json`
en passant `?configId=...` à la route API.

### 4.5 Visualisation

Sous-onglet **Visualisation** :

- Sélecteur env + config (même pattern que Export)
- Graphe SVG dynamique (cf. §5)
- Boutons :
  - **Télécharger SVG** (download direct)
  - **Télécharger PNG** (canvas → blob)
  - **Copier le code Mermaid**
  - **Plein écran**

## 5. Visualisation dynamique du container

### 5.1 Structure cible

Représentation **par dossier** avec relations triggers ↔ tags :

```
┌─────────────────────────────────────────────────────────────┐
│ 00 — Configuration                                          │
│   [GA4 Cfg] ← (PV — All Pages)                              │
│                                                             │
│ 01 — Page & Engagement                                      │
│   [GA4 Evt — page_view]    ← (CE — page_view)               │
│   [GA4 Evt — scroll_depth] ← (CE — scroll_depth)            │
│   [GA4 Evt — click]        ← (CE — click)                    │
│   …                                                         │
│                                                             │
│ 02 — E-commerce                                             │
│   [GA4 Evt — purchase]     ← (CE — purchase)                │
│   [Meta Evt — Purchase]    ← (CE — purchase)  + Setup [Meta Init] │
│   …                                                         │
│                                                             │
│ 08 — Chat assistant                                         │
│   [GA4 Evt — chat_widget_open] ← (CE — chat_widget_open)    │
│   [Meta Evt — ChatEngagement]  ← (CE — chat_widget_open)    │
│   …                                                         │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Layout SVG

- Largeur fixe : 1280 px (responsive scale, mais base 1280)
- Hauteur dynamique : ~ 60 px par tag + 80 px par folder header
- Folders empilés verticalement
- Dans chaque folder : tags listés en cards de 60 × 28 px
- Triggers en pastilles arrondies à gauche du tag
- Lignes pointillées pour les setupTag (init dependencies)
- Couleurs par catégorie de folder :
  - 00 Configuration : ciel
  - 01 Page : crème
  - 02 E-commerce : sauge clair
  - 03 Lead : pétale
  - 04 Conversions : champagne
  - 05 FemiGlow : sable
  - 06 Consent : sauge
  - 07 Helpers : stone
  - 08 Chat : sauge profond

### 5.3 Pourquoi pas de lib ?

- Évite d3 / cytoscape / reactflow (~ 200 kB chacun)
- SVG layout simple par grille, lisible
- Pas d'interactivité forte requise V1 (zoom, drag) : c'est une
  carte de lecture, pas un éditeur
- En V2 : si zoom/drag nécessaire → switch vers `@xyflow/react`

### 5.4 Téléchargement

| Format | Méthode                                            |
| ------ | -------------------------------------------------- |
| SVG    | `<svg>` sérialisé → blob → download                |
| PNG    | `<svg>` → `<canvas>` via `Image()` → toBlob → download |
| Mermaid | génération côté backend, returned as string       |

## 6. Spécification API

### 6.1 `GET /api/admin/tracking/gtm/configs`

```jsonc
{
  "activeId": "uuid",
  "versions": [{ "id": "uuid", "name": "v1…", "createdAt": "...", "createdBy": "..." }]
}
```

### 6.2 `GET /api/admin/tracking/gtm/configs/:id`

```jsonc
{
  "id": "uuid",
  "name": "v3",
  "notes": "...",
  "createdAt": "...",
  "createdBy": "...",
  "perEnv": { "production": { ... }, "stage": { ... }, ... }
}
```

### 6.3 `POST /api/admin/tracking/gtm/configs`

Body : `Omit<GtmConfigVersion, 'id' | 'createdAt' | 'createdBy'>`
Retourne la version créée.

### 6.4 `PATCH /api/admin/tracking/gtm/configs/:id/activate`

Active la version (passe-la en `activeId`).

### 6.5 `DELETE /api/admin/tracking/gtm/configs/:id`

Supprime la version (refus si c'est l'active).

### 6.6 `GET /api/admin/tracking/gtm/container?configId=...`

(extension de la route existante) — utilise la config si fournie,
sinon defaults.

### 6.7 `GET /api/admin/tracking/gtm/visualization`

Query : `env`, `configId?`, `format = 'json' | 'mermaid'`

```jsonc
// format=json
{
  "descriptor": {
    "folders": [
      { "id": "F-00", "name": "00 — Configuration", "color": "ciel",
        "items": [
          { "kind": "tag", "name": "GA4 Cfg — Production",
            "triggers": ["PV — All Pages"], "setupTags": [] }
        ]
      },
      ...
    ]
  },
  "stats": { tags, triggers, variables }
}

// format=mermaid
"flowchart LR\n  ..."
```

## 7. UX / charte

- Onglet actif souligné stone-900 (cohérent avec sous-nav existante)
- Formulaire dense, alignement vertical strict
- Boutons "Appliquer à tous" en sauge `#A8C4A6/15` avec icône broadcast
- Diff : ajouts vert profond `#4F6B4D`, suppressions rouge profond `#8C3A3A`
- Visualisation : palette douce, pas de néon
- Toutes les actions destructives ont confirmation (Supprimer une version)
- A11y : tous les inputs ont `<label>`, le diff a `aria-label="Différences entre v2 et v3"`

## 8. Considérations

### 8.1 Frontend

- React Server Component pour la page (charge active config + liste versions au mount)
- Client Components seulement pour les zones interactives (formulaire, diff, visualisation)
- Zustand-free : `useState` + `useTransition` suffisent
- Persistance locale : aucune (la source de vérité est la base)

### 8.2 Backend

- Module `lib/tracking/gtm/config-store.ts` : Drizzle queries sur
  `tracking_settings`, parse Zod, validation
- Mutations atomiques (lock optimiste : version conflictuelle si
  modification concurrente détectée — ETag léger via hash)
- Audit log : `tracking.tracking_gtm.config_create`, `.config_activate`,
  `.config_delete`

### 8.3 Sécurité

- Toutes les routes admin auth `iron-session`
- Validation Zod stricte des Pixel IDs avant persistance (regex par provider)
- Aucune fuite de Conv Label dans les logs (les logs masquent les valeurs > 8 chars)
- Audit log conserve uniquement les noms de version, jamais les valeurs

### 8.4 Performance

- Lecture de la config : 1 SQL hit, < 5 ms
- Génération container : < 200 ms (existant)
- Génération viz JSON descriptor : < 30 ms
- Render SVG : < 100 ms côté client pour 75 tags
- Cache HTTP 60 s sur GET configs (la liste, pas le détail)

### 8.5 Évolutivité

- Bonus futurs : tags / triggers ajoutables manuellement par config
  (pour des cas spéciaux non couverts par le catalogue)
- Phase 2 : push API direct depuis l'UI avec la config active
- Phase 2 : import d'un JSON existant (cas migration)
- Phase 2 : export CSV des Pixel IDs (pour tableur ops)

## 9. Plan d'action — tickets `GTM-CFG-XXX` et `GTM-VIZ-XXX`

### Phase 1 — Config Store (~ 1.5 j)

| ID         | Tâche                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| GTM-CFG-001 | Schémas Zod `gtmEnvConfigSchema` + `gtmConfigVersionSchema`                     |
| GTM-CFG-002 | Service `lib/tracking/gtm/config-store.ts` (list, get, save, activate, delete)  |
| GTM-CFG-003 | Settings key `gtm.config_versions` (clé `tracking_settings`)                     |
| GTM-CFG-004 | Tests unitaires Vitest du config-store (10+ cas)                                |

### Phase 2 — API (~ 1 j)

| ID         | Tâche                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| GTM-CFG-005 | Route `GET /api/admin/tracking/gtm/configs`                                      |
| GTM-CFG-006 | Route `GET /api/admin/tracking/gtm/configs/:id`                                  |
| GTM-CFG-007 | Route `POST /api/admin/tracking/gtm/configs`                                     |
| GTM-CFG-008 | Route `PATCH /api/admin/tracking/gtm/configs/:id/activate`                       |
| GTM-CFG-009 | Route `DELETE /api/admin/tracking/gtm/configs/:id`                               |
| GTM-CFG-010 | Étendre `GET .../container` pour accepter `?configId=...`                        |
| GTM-CFG-011 | Audit log entries (`config_create`, `config_activate`, `config_delete`)          |

### Phase 3 — Frontend Configurations (~ 2 j)

| ID         | Tâche                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| GTM-CFG-012 | Sous-onglets dans `/admin/tracking/gtm` (Export · Configurations · Visualisation) |
| GTM-CFG-013 | Composant `GtmConfigForm` (4 colonnes envs, 12 champs)                           |
| GTM-CFG-014 | Bouton "Appliquer à tous les envs" + "envs actifs"                               |
| GTM-CFG-015 | Composant `GtmConfigVersionList` (liste avec actions)                             |
| GTM-CFG-016 | Composant `GtmConfigDiff` (deux colonnes pretty)                                  |
| GTM-CFG-017 | Sélecteur de config dans Export tab                                              |
| GTM-CFG-018 | Confirmation modale pour delete                                                  |
| GTM-CFG-019 | Tests RTL des composants (15+ cas)                                                |
| GTM-CFG-020 | Tests intégration MSW (CRUD complet via API)                                      |

### Phase 4 — Visualisation backend (~ 1 j)

| ID         | Tâche                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| GTM-VIZ-001 | `lib/tracking/gtm/viz/descriptor.ts` — JSON → graph descriptor                   |
| GTM-VIZ-002 | `lib/tracking/gtm/viz/mermaid.ts` — descriptor → Mermaid flowchart                |
| GTM-VIZ-003 | Route `GET /api/admin/tracking/gtm/visualization`                                 |
| GTM-VIZ-004 | Tests unitaires descriptor + mermaid (10+ cas)                                    |

### Phase 5 — Visualisation frontend (~ 2 j)

| ID         | Tâche                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| GTM-VIZ-005 | Composant `GtmGraphCanvas` (SVG layout par folder)                                |
| GTM-VIZ-006 | Composant `GtmGraphFolder` (header + cards items)                                 |
| GTM-VIZ-007 | Composant `GtmGraphCard` (tag + triggers + setupTag arrows)                       |
| GTM-VIZ-008 | Composant `GtmVisualization` (orchestration : env+config selector + graph)        |
| GTM-VIZ-009 | Téléchargement SVG (sérialisation + blob)                                         |
| GTM-VIZ-010 | Téléchargement PNG (canvas via Image)                                              |
| GTM-VIZ-011 | Copie Mermaid (clipboard)                                                          |
| GTM-VIZ-012 | Mode plein écran (réutilise `GtmFullscreenPreview`)                                |
| GTM-VIZ-013 | Tests RTL (10+ cas)                                                                |

### Phase 6 — Tests E2E + doc (~ 1 j)

| ID         | Tâche                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| GTM-CFG-021 | Playwright spec : créer config → activer → télécharger                            |
| GTM-VIZ-014 | Playwright spec : ouvrir viz → télécharger SVG → copier Mermaid                   |
| GTM-CFG-022 | Mise à jour CHANGELOG.md                                                          |
| GTM-CFG-023 | Mise à jour README sommaire (lien vers ce doc)                                    |

### Estimation

| Phase | Charge   |
| ----- | -------- |
| 1 — Config Store        | 1.5 j |
| 2 — API                 | 1 j   |
| 3 — Frontend configs    | 2 j   |
| 4 — Viz backend         | 1 j   |
| 5 — Viz frontend        | 2 j   |
| 6 — Tests E2E + doc     | 1 j   |
| **Total**               | **~ 8.5 jours** |

## 10. Runbook — exécution V1

À exécuter dans le worktree `gtm-vars-viz`.

```sh
# 1. Schemas + store
pnpm tsx -e "console.log('phase 1 — store')"
# => créer lib/tracking/gtm/config-schema.ts
# => créer lib/tracking/gtm/config-store.ts
# => écrire les tests config-store.test.ts

# 2. API
# => créer api/admin/tracking/gtm/configs/route.ts
# => créer api/admin/tracking/gtm/configs/[id]/route.ts
# => créer api/admin/tracking/gtm/configs/[id]/activate/route.ts
# => étendre api/admin/tracking/gtm/container/route.ts

# 3. Sous-onglets + form
# => créer page /admin/tracking/gtm avec layout 3 onglets
# => créer GtmConfigForm.tsx, GtmConfigVersionList.tsx, GtmConfigDiff.tsx

# 4. Viz backend
# => créer lib/tracking/gtm/viz/{descriptor,mermaid}.ts
# => créer api/admin/tracking/gtm/visualization/route.ts

# 5. Viz frontend
# => créer GtmGraphCanvas + sous-composants
# => créer GtmVisualization (orchestrateur)

# 6. Tests
pnpm test src/lib/tracking/gtm
pnpm test src/components/admin/tracking/gtm
./node_modules/.bin/playwright test --list e2e/admin-tracking-gtm-configs.spec.ts
./node_modules/.bin/tsc --noEmit
```

## 11. Critères d'acceptation V1

1. Un admin peut créer une config (4 envs × 12 champs).
2. Un admin peut activer "appliquer à tous les envs" et la valeur
   se propage instantanément (UI + DB).
3. La liste des versions est triée par date desc avec badge "active".
4. L'admin peut activer une version → toutes les générations
   `?configId=` la consomment.
5. L'admin peut supprimer une version (sauf l'active).
6. L'admin peut comparer 2 versions en diff côte à côte.
7. L'admin peut télécharger un container avec une config spécifique
   (filename inclut le hash de config sha8).
8. L'onglet Visualisation montre le graphe SVG par folder, lisible.
9. L'admin peut télécharger SVG, PNG, ou copier Mermaid.
10. Le mode plein écran fonctionne pour la viz.
11. Tests unit + intégration verts. Typecheck propre. 0 régression.

## 12. Hors scope (V2+)

- Édition manuelle de tags/triggers/variables custom
- Push direct via GTM API depuis l'UI avec la config active
- Import d'un container existant pour réutiliser ses pixels
- Mode comparatif visualisation (diff entre 2 visualisations)
- Pan/zoom sur la viz (besoin de `@xyflow/react`)

## 13. Risques

| Risque                                               | Mitigation                                      |
| ---------------------------------------------------- | ----------------------------------------------- |
| Conflit de modification concurrente (2 admins)       | ETag léger sur version (hash), refus 409        |
| Setting `tracking_settings` qui dépasse les 200 kB    | FIFO 50 versions, alerte si > 80 %               |
| Téléchargement PNG très lourd sur grands containers   | Limite 4096 × 4096 px, downscale au-delà         |
| Visualisation illisible en mobile                     | Forcée à un layout vertical < 768 px             |
| Config invalide acceptée                              | Validation Zod stricte (regex Pixel IDs)         |
| Fuite d'admin Conv Label dans les logs                | Logger redact les valeurs > 8 caractères         |

## 14. Lecture suivante

- [14 — Export depuis l'admin](14-admin-export.md) — V1 dont on
  étend le sous-onglet Export
- [15 — UI/UX V1.1](15-ui-ux-improvements.md) — design system
  des composants admin GTM
- [10 — Automatisation](10-automatisation.md) — Phase 5 ter
  enrichie par cette spec

# 18 — Système de tracking unifié : analyse conceptuelle

> **Statut :** Proposition conceptuelle (Étape A)
> **Auteur :** Architecture FemiGlow
> **Date :** 2026-05-14
> **Audience :** Product, Lead Dev, Admin marketing, QA
> **Successeur :** Étape B — Dossier technique détaillé (data / backend / frontend / UX / UI / tests)

---

## Préambule — TL;DR en 60 secondes

Aujourd'hui FemiGlow expose **cinq sous-systèmes** côté admin pour piloter le tracking (Pixel, Mapping, GTM Sync, Valider Import GTM, Export GTM). Chacun a été ajouté à un moment différent, avec sa propre source de vérité, son propre format et sa propre UI. Le résultat opérationnel observé :

- **Doublons d'événements GA4** après import successif de deux JSON dans le même container GTM (le « JSON mapper » avec placeholders `G-PROD0000` + le « JSON GTM » avec la vraie variable `{{CONST - GA4 Measurement ID}}`).
- **Trois endroits** où le Pixel Meta ID est saisi (provider DB, config GTM, snippet HTML).
- **Deux chaînes d'export** GTM qui produisent des conteneurs JSON différents pour la même intention.
- **Aucun lien de version** entre la matrice de mapping et la configuration GTM (un mapping peut être activé avec une config absente / périmée).

Ce document propose **quatre approches conceptuelles** pour résoudre ce problème, les compare honnêtement, puis **recommande une approche hybride** (Source of Truth + Wizard-First) avec une feuille de route conceptuelle. Pas de plongée technique ici — juste assez de détail pour que l'on puisse trancher avant de produire le dossier technique (Étape B).

---

## 1. État des lieux — Ce que l'on a déjà

### 1.1 Le symptôme déclencheur

Après avoir importé séquentiellement dans le container GTM `GTM-M8K7V88D` :
- `tag_assistant_femiglow_maroc_com_2026_05_14.json` (export GTM officiel)
- Un export « mapper » du sous-système Mapping de FemiGlow

… le panel Tag Assistant montre **239 tags uniques, chacun déclenché 6 fois** par interaction. Les paramètres révèlent que chaque tag a deux versions de chaque valeur :
- Version A : référence variable propre — `{{CONST - GA4 Measurement ID}}`
- Version B : placeholder littéral — `G-PROD0000`, `AW-REPLACE_WITH_YOUR_GOOGLE_ADS_ID`

Les placeholders `G-PROD0000` viennent de [builders.ts:45](apps/web/src/lib/tracking/gtm/builders.ts:45) (`ENV_DEFAULTS.production`) et n'ont jamais été remplacés. **C'est un symptôme**, pas la cause. La cause est architecturale : il existe deux chaînes d'export qui se prennent pour des sources de vérité concurrentes.

### 1.2 Carte des cinq sous-systèmes

| Sous-système | Mission affichée | Source de vérité | Route admin | API principale |
|---|---|---|---|---|
| **Pixel** | Snippet client + dispatch CAPI Meta/TikTok/etc. | Table DB `trackingProviders` | `/admin/tracking/pixels` | `/api/track/pixels` |
| **Mapping** | Matrice événement → nom mappé par provider | Table DB `eventMappingVersions` (JSONB) | `/admin/tracking/events/mappings` | `/api/admin/tracking/events/mappings/...` |
| **GTM Sync** | Détection de drift (ce que client envoie vs. ce que l'admin attend) | Tables `gtmSentinelPings`, `gtmDriftState` | `/admin/tracking/gtm/sync-status` | `/api/admin/tracking/gtm/sync-status` |
| **Valider Import GTM** | Lint paire { configJson, mappingJson } | Stateless (input → output) | `/admin/tracking/gtm/validate-pair` | `/api/admin/tracking/gtm/validate-pair` |
| **Export GTM** | Génération du JSON container GTM | Code (`builders.ts`) **et** matrice mapping (`gtm-export.ts`) | `/admin/tracking/gtm` (3 onglets) | `/api/admin/tracking/gtm/container` |

### 1.3 Les frictions racines (au-delà du symptôme)

**F1. Deux chaînes d'export qui se croisent.**
- `apps/web/src/lib/tracking/gtm/exporter.ts` → `builders.ts` (code-driven : templates statiques).
- `apps/web/src/lib/tracking/mappings/gtm-export.ts` → `buildGtmContainer()` (matrix-driven : depuis la version mapping).
- Aucune des deux n'est canonique. Selon le chemin emprunté par l'admin, on télécharge l'un OU l'autre — et leurs sorties divergent.

**F2. Trois magasins pour le même identifiant.**
Pour le Meta Pixel ID : `trackingProviders.pixelId` (DB) + `GtmConfigVersion.perEnv.production.metaPixelId` (settings JSONB) + littéraux hardcodés dans des HTML snippets. Aucun n'est canonique. Mettre à jour l'un ne propage rien aux autres.

**F3. Pas de versionning croisé Config × Mapping.**
On peut activer un mapping v8 alors que la config GTM active est v3, ce qui produit un export incohérent. Le drift detector le détecte *a posteriori*, mais aucune contrainte ne l'empêche *a priori*.

**F4. Validation tardive.**
La validation se fait **après** export (linter sur le container produit) ou **après** upload utilisateur (pair-validator). Aucun garde-fou pendant l'édition — un admin peut sauver une matrice incohérente et ne le découvrir qu'au moment du download.

**F5. UX cloisonnée par sous-système.**
L'admin doit naviguer entre 4 routes distinctes (`/pixels`, `/events/mappings`, `/gtm`, `/gtm/validate-pair`) pour piloter UN concept marketing : « comment FemiGlow envoie ses événements aux outils analytics ». Chaque route a son propre vocabulaire et ses propres conventions visuelles.

**F6. Fallback silencieux dans le resolver.**
[resolver.ts:28](apps/web/src/lib/tracking/mappings/resolver.ts:28) applique une cascade : DB version active → cache RAM → code legacy `event-mapping.ts`. En cas d'erreur DB, le système retombe sur le code legacy sans signaler clairement à l'admin que ses intentions sont *masquées*.

---

## 2. Vision cible — Ce qu'on cherche

### 2.1 Principes directeurs

1. **Une seule source de vérité par concept.** Un Pixel ID est défini *une* fois. Un mapping est défini *une* fois. Un export reflète l'état combiné de ces sources.
2. **Versionning unifié.** Une version est une photo cohérente { mapping + config + providers }. On active une version, pas trois objets indépendants.
3. **Validation continue.** L'admin ne peut pas sauver / activer une version incohérente. Les erreurs s'affichent pendant l'édition, pas après le download.
4. **Un seul export, un seul import.** Plus jamais de deux JSON à fusionner manuellement dans GTM.
5. **Pré-remplissage intelligent.** Quand l'admin saisit une nouvelle config (env = staging), les IDs déjà connus (production) sont proposés en autocomplete, modifiables.
6. **Interopérabilité native.** Le sous-système de validation lit la même source que l'export. Le drift detector lit la même version que celle exportée. Pas de drift entre les sous-systèmes eux-mêmes.

### 2.2 Critères de succès mesurables

| Critère | Aujourd'hui | Cible |
|---|---|---|
| Nombre de routes admin pour piloter le tracking | 4 | 1 (avec onglets ou steps) |
| Nombre de magasins pour le Meta Pixel ID | 3 | 1 |
| Nombre de chaînes d'export GTM | 2 | 1 |
| Temps moyen pour publier une nouvelle config (admin novice) | inconnu (> 15 min observés) | < 5 min |
| Doublons d'événements GA4 après import standard | possibles | impossibles par construction |
| Indication visuelle de drift avant publication | aucune | bloquante (refus de publish) |

---

## 3. Espace de solutions — Quatre approches conceptuelles

Je présente quatre directions architecturales radicalement différentes. Chacune est viable. L'objectif est de **forcer l'arbitrage** plutôt que de glisser vers la première idée plausible.

---

### Approche A — « Big Bang » : Unified Tracking Studio

> **Métaphore :** un IDE marketing dédié. Une SPA admin riche avec panneaux latéraux, prévisualisation live, éditeur de matrice, debugger d'événements.

**Description.** On remplace les 4 routes existantes par une page unique `/admin/tracking/studio` qui contient *tout* : éditeur de mapping (centre), inspecteur de config par env (droite), preview JSON live (panneau extensible), historique versions (en bas), test runner d'événements (modal). Chaque modification est répercutée instantanément dans tous les panneaux. La sauvegarde crée une version atomique { mapping + config + providers }.

**Forces.**
- L'admin a tout sous les yeux : impossible d'oublier de mettre à jour un côté.
- Pédagogique : voir le JSON se former en live démystifie le système.
- Permet du « refactoring » de tracking (renommer un event partout en un clic).

**Faiblesses.**
- Charge cognitive élevée pour un admin novice. Premier contact intimidant.
- Demande beaucoup de travail UI (split panes, virtualisation, syncing).
- Difficile à tester (interactions multiples, état partagé profond).
- Peu adapté aux mobiles / tablettes (vise écran 24"+).

**Pertinence pour FemiGlow.** Moyenne. L'équipe admin n'est pas une équipe dédiée tracking (un seul opérateur principal côté Maroc). On surcalibre l'outil pour un volume d'usage modéré.

---

### Approche B — « Tracking Plan » : Source of Truth centralisée

> **Métaphore :** un fichier de configuration que tout le système lit. L'admin édite *un seul document* qui décrit l'intention complète. Les autres sous-systèmes deviennent des projections.

**Description.** On introduit un objet métier **`TrackingPlan`** qui contient *tout* : la matrice de mapping, les configs per-env (pixel IDs, measurement IDs, conversion labels), les triggers, l'état d'activation. Une seule table DB. Une seule entité versionnée. Toutes les UI deviennent des vues sur cet objet :
- Pixel = vue filtrée sur `plan.providers.meta` + `plan.events[*].mappings.meta`.
- Export GTM = projection déterministe `plan → container.json`.
- Drift Sync = comparaison `plan.activeVersion.bundleId` vs. ping.
- Validation = lint du `plan` lui-même.

L'admin n'a plus à se soucier de cohérence : tout vient du même document. L'export est un *side-effect* automatique du plan actif.

**Forces.**
- Cohérence par construction (impossible d'avoir un mapping sans sa config).
- Versionning trivial (snapshot le plan entier).
- Export déterministe : `plan@v42` → toujours le même JSON.
- Modèle mental simple à expliquer : « le plan est la vérité ».

**Faiblesses.**
- Migration risquée : il faut convertir les données existantes (3 tables → 1).
- Édition d'un gros document = surface d'erreur large. Besoin de UIs de focus (vues filtrées).
- Si on persiste en JSONB, les contraintes d'intégrité référentielle deviennent applicatives (Zod, pas Postgres).

**Pertinence pour FemiGlow.** Forte. Le projet n'a pas une volumétrie qui justifierait des tables relationnelles fines. Le JSONB Postgres + Zod côté serveur suffit. L'approche est alignée avec ce qui existe déjà (mappings sont déjà JSONB).

---

### Approche C — « Composable Pipeline » : Adapter pattern + pipeline déclaratif

> **Métaphore :** Unix pipes pour le tracking. Chaque étape (résolution → enrichissement → dispatch → export) est un module pur qui prend une entrée et produit une sortie.

**Description.** On garde les 5 sous-systèmes mais on les unifie *par contrat* : chacun expose une interface `TrackingModule` standardisée. Une orchestration centrale (le « Tracking Kernel ») charge tous les modules, expose un pipeline configurable. L'admin édite la *configuration* du pipeline, pas les modules eux-mêmes.

```
Event → [Resolver] → [Enricher (consent, identity)] → [Dispatcher (Meta, GA4, ...)] → [Exporter (GTM, debug, replay)]
```

**Forces.**
- Très extensible : ajouter un nouveau provider = ajouter un module.
- Testable module par module.
- Permet du « replay » : rejouer des événements stockés dans un pipeline modifié.
- Open-source friendly (chaque module est isolé).

**Faiblesses.**
- Abstraction élevée pour un besoin d'admin marketing. L'opérateur veut « mettre à jour le Pixel Meta », pas « configurer le module dispatcher dans le pipeline ».
- L'UI doit toujours exister (et reste à inventer) au-dessus du pipeline.
- Effort de refactor important sans gain UX immédiat.

**Pertinence pour FemiGlow.** Moyenne. Pertinente si on prévoit de supporter beaucoup de providers tiers à terme (10+). Aujourd'hui on a Meta, TikTok, GA4 (via GTM), Google Ads (via GTM). L'investissement est disproportionné.

---

### Approche D — « Wizard-First » : Expérience guidée comme couche d'abstraction

> **Métaphore :** un assistant qui pose des questions en langage métier et configure tout en coulisse. Le modèle de données reste éclaté, mais l'admin ne le voit jamais.

**Description.** On garde les structures actuelles (Pixel + Mapping + Config + Sync + Export) mais on construit **au-dessus** un parcours utilisateur unique : *« Configurer mon tracking »*. C'est un wizard multi-étapes :
1. Quels outils je veux tracker ? (cases à cocher : GA4, Meta, TikTok, Ads…)
2. Mes identifiants pour chaque outil (formulaire pré-rempli si déjà en DB).
3. Quels événements je veux envoyer à chacun ? (matrice simplifiée avec presets).
4. Vérifier (preview JSON + validation visuelle).
5. Publier (génère mapping + config + déclenche drift snapshot).

L'admin ne touche jamais aux sous-systèmes individuels. Une « édition avancée » reste possible pour les experts.

**Forces.**
- Onboarding ultra-rapide. Un novice publie un tracking complet en < 5 min.
- Faible risque de migration : on garde les structures existantes, on rajoute une couche.
- Diminue l'erreur humaine (le wizard valide à chaque step).
- Démontre la valeur produit immédiatement.

**Faiblesses.**
- Sous-systèmes éclatés persistent en coulisse : la dette technique reste.
- Un admin avancé qui touche aux sous-systèmes individuels peut casser ce qu'a fait le wizard.
- Risque de wizards qui mentent (le wizard dit « tout va bien » mais le drift detector détecte un problème caché).

**Pertinence pour FemiGlow.** Forte sur le court terme (livrer vite de la valeur), faible sur le long terme (ne règle pas les frictions architecturales).

---

### Synthèse — Tableau comparatif

| Critère | A. Studio | B. Tracking Plan | C. Pipeline | D. Wizard-First |
|---|---|---|---|---|
| **Effort de mise en œuvre** | Très élevé | Élevé | Élevé | Moyen |
| **Risque de migration** | Moyen | Élevé | Élevé | Faible |
| **Cohérence par construction** | Moyenne | Très forte | Forte | Faible (cosmétique) |
| **Onboarding admin novice** | Faible | Moyen | Faible | Très fort |
| **Maintenabilité long terme** | Moyenne | Très forte | Forte | Faible |
| **Mobile / Tablette admin** | Faible | Bon | Bon | Très bon |
| **Capacité d'audit / replay** | Moyenne | Forte | Très forte | Faible |
| **Score global subjectif (sur 10)** | 5 | 8 | 6 | 7 |

---

## 4. Proposition finale — Hybride B + D

**Recommandation :** combiner l'**approche B (Tracking Plan, source de vérité)** comme socle architectural avec l'**approche D (Wizard-First, expérience guidée)** comme première UI.

> 🎯 La couche basse (data + backend) est refondue selon B → cohérence, versionning, export déterministe.
> 🎯 La couche haute (UX) est livrée selon D → wizard d'onboarding qui couvre 90% des usages.
> 🎯 Une UI « expert » optionnelle (à la A) permet le pilotage avancé sur les 10% restants.

Cette combinaison capture les forces de B (cohérence) et de D (UX immédiate), sans assumer leurs faiblesses respectives (B seule = courbe d'apprentissage, D seule = dette persistante).

---

### 4.1 Vue d'ensemble — L'objet `TrackingPlan`

L'**unique** entité métier devient `TrackingPlan` (versionnée). Chaque plan contient :

```
TrackingPlan
├── meta
│   ├── id (uuid)
│   ├── name ("Production v8", "Test campagne mai 2026")
│   ├── status (draft | active | archived)
│   ├── createdAt, createdBy, activatedAt
│   └── parentVersion (généalogie)
├── providers
│   ├── ga4 : { measurementId, apiSecret?, enabled }
│   ├── googleAds : { customerId, conversions: [{ label, type }], enabled }
│   ├── meta : { pixelId, capiToken?, testEventCode?, enabled }
│   ├── tiktok : { pixelId, accessToken?, enabled }
│   └── ... (un slot par provider supporté)
├── envProfiles
│   ├── production : { containerId: "GTM-XXX", overrides: {...} }
│   ├── staging    : { containerId: "GTM-YYY", overrides: {...} }
│   └── dev        : { containerId: null, overrides: {...} }
├── events  (la matrice de mapping)
│   └── [eventName] : {
│         enabled: bool,
│         mappings: { ga4: {...}, meta: {...}, ... },
│         triggers: [...],
│         consent: { ad_storage, analytics_storage }
│       }
└── bundleId  (hash déterministe du plan — utilisé par drift detector)
```

**Chaque sous-système devient une projection lecture-seule** du plan actif :
- Le snippet Pixel client = projection `plan.providers.meta` + `plan.events[*].mappings.meta`.
- Le container GTM exporté = projection `plan.envProfiles[env]` + `plan.providers` + `plan.events`.
- Le drift status = comparaison `plan.bundleId` vs. ping reçu.

---

### 4.2 Aspect Data — Une table, un schéma

**Magasin unique.** Table `trackingPlans` (Postgres) :
- `id`, `name`, `status`, `createdAt`, `createdBy`, `activatedAt`, `parentVersion`
- `plan` JSONB (l'objet TrackingPlan complet, sans `meta`)
- `bundleId` text (calculé déterministe à chaque save)
- Contrainte : un seul `status = 'active'` à la fois (unique partial index).

**Migration depuis l'existant.** Script one-shot qui lit `trackingProviders` + `eventMappingVersions.active` + `trackingSettings('gtm.config_versions').active` et produit un `TrackingPlan` initial nommé « Imported 2026-05-14 », activé immédiatement (drop-in replacement).

**Audit trail unique.** Table `trackingPlanAudit` (qui? quoi? quand? `diff` JSONB). Remplace `eventMappingAudit` et les rares logs ad-hoc.

**Schéma Zod canonique.** Un seul `TrackingPlanSchema` exporté depuis `apps/web/src/lib/tracking/plan/schema.ts`. Tous les sous-systèmes l'importent.

---

### 4.3 Aspect Backend — Un service, une API REST

**Service unique :** `TrackingPlanService` (un fichier `apps/web/src/lib/tracking/plan/service.ts`) expose :
- `getActive()` → plan actif (cache RAM, invalidé à chaque save)
- `getById(id)`
- `list({ status })`
- `create({ from? })` → clone du plan actif ou d'un plan donné
- `update(id, patch)` → save partiel, recalcule `bundleId`
- `validate(plan)` → résultat Zod + lint métier (cohérence env, présence IDs, etc.)
- `activate(id)` → transactionnel : désactive l'actif, active le nouveau, snapshot drift
- `archive(id)` → soft delete

**API REST :**
- `GET    /api/admin/tracking/plans` (liste)
- `POST   /api/admin/tracking/plans` (create)
- `GET    /api/admin/tracking/plans/:id`
- `PATCH  /api/admin/tracking/plans/:id` (édition)
- `POST   /api/admin/tracking/plans/:id/activate`
- `POST   /api/admin/tracking/plans/:id/validate` (lint en cours d'édition)
- `GET    /api/admin/tracking/plans/:id/export?env=production&format=gtm` ← **UNIQUE export**
- `GET    /api/admin/tracking/plans/:id/sync-status`

Les anciens endpoints (`/pixels`, `/events/mappings/*`, `/gtm/container`, `/gtm/validate-pair`) deviennent des proxies temporaires qui lisent du plan actif, jusqu'à dépréciation complète.

**Export unique.** Une seule fonction `buildContainer(plan, env)` qui construit le JSON GTM. Plus de double chaîne. Tests snapshots gelés sur la fonction unique.

---

### 4.4 Aspect Frontend — Un store, des vues

**Store client unique :** `useTrackingPlanStore` (Zustand). Charge le plan actif au mount, expose :
- `plan`, `isDirty`, `validationErrors`, `bundleId`
- Actions : `updateField(path, value)`, `revert()`, `save()`, `activate()`

**Composants :**
- `TrackingPlanWizard` (D) → parcours guidé multi-step.
- `TrackingPlanExpert` (B / A léger) → édition libre par sections (Providers, Events, Envs).
- Sous-composants partagés : `ProviderCard`, `EventMatrixRow`, `EnvProfileForm`, `ExportPreview`.

**Routes consolidées :**
- `/admin/tracking` → home (statut, drift, dernière activation).
- `/admin/tracking/plans` → liste versions.
- `/admin/tracking/plans/:id/edit` → wizard OU expert (toggle).
- `/admin/tracking/plans/:id/preview` → preview du JSON exporté.
- `/admin/tracking/sync` → drift detector dashboard (lecture seule, info-only).

Les anciennes routes redirigent (`/admin/tracking/pixels` → `/admin/tracking/plans/active/edit?focus=providers.meta`).

---

### 4.5 Aspect UX — Le parcours admin

#### 4.5.1 Persona principal

**Amal**, responsable marketing FemiGlow Maroc. Vient du tableur. Comprend GA4 et le Pixel Meta dans les grandes lignes. **N'est pas développeuse.** Veut :
- Configurer le tracking d'une campagne en 5 min.
- Tester avant de pousser en prod.
- Voir tout de suite si quelque chose ne va pas.

#### 4.5.2 Flux principal — « Mettre à jour le tracking »

```
1. Amal arrive sur /admin/tracking
   → Carte « Plan actif : Production v8 » avec statut santé (vert/orange/rouge).
   → Bouton primaire : "Modifier mon tracking" (ouvre wizard).
   → Bouton secondaire : "Voir l'historique des versions".

2. Clic sur "Modifier" → Wizard 5 étapes (cf. 4.7).

3. À la fin : preview JSON + "Activer cette version" + "Garder en brouillon".

4. Si activate → snapshot drift, nouveau bundleId, message confirmation.
```

#### 4.5.3 Flux secondaire — « Comprendre un drift »

```
1. Bandeau rouge en haut de /admin/tracking : "Le tracking client ne correspond pas".
2. Clic → /admin/tracking/sync → diff visuel (admin attend X, client envoie Y).
3. Recommendations : « Importer la dernière version dans GTM », « Vérifier le déploiement web ».
4. Bouton "Re-télécharger le container actif".
```

#### 4.5.4 Flux expert — « Édition fine »

```
1. Amal active le mode expert (toggle en haut du wizard).
2. UI passe à 3 colonnes : navigation sections | éditeur formulaire | preview JSON live.
3. Toutes les sections accessibles directement (pas séquentielles).
4. Validation continue (erreurs en rouge à côté des champs).
5. Mêmes boutons "Activer / Brouillon" qu'en mode wizard.
```

---

### 4.6 Aspect UI Design — Langage visuel

**Tonalité :** outil sérieux mais accessible. Pas un dashboard analytics agressif. S'inspire des outils de configuration (Stripe Dashboard, Linear Settings) — clarté, hiérarchie, respiration.

**Système de couleurs :**
- Statut santé : vert sauge (FemiGlow brand), orange ambre (warning), rouge brique (error).
- Sections : neutres beiges/crèmes (cohérence brand) avec accents rose pour CTAs primaires.

**Hiérarchie typographique :**
- H1 Cormorant (titres pages) — déjà existant.
- H2/H3 Inter semibold (cards et sections).
- Code/JSON : police monospace (JetBrains Mono) avec syntax highlighting léger.

**Composants clefs :**
- **Card de statut** (en home) : icône grande, statut texte, métriques compactes, bouton primaire.
- **Stepper horizontal** (wizard) : numéros encerclés, ligne de progression, état (à venir / en cours / complété).
- **Pill provider** : logo, nom, état (activé / désactivé / mal configuré), tap pour focus.
- **Matrice événements** : tableau virtualisé, cellules cliquables, dropdown inline.
- **Preview JSON** : panneau extensible, copy button, expand all / collapse all, search.
- **Diff viewer** (drift) : split view ou inline, colorisé.

**Mobile :**
- Le wizard fonctionne en colonne unique sur mobile (single-step at a time, navigation par swipe).
- L'éditeur expert n'est pas optimisé mobile (3 colonnes desktop only) — un message redirige vers wizard.

**Accessibilité :**
- Couleur de statut redoublée par icône (jamais juste la couleur).
- Tous les inputs ont un label visible + description courte.
- Navigation clavier : Tab + Enter dans toutes les étapes du wizard.
- Lecteurs d'écran : `aria-live` sur les messages de validation, `aria-current="step"` sur l'étape active.

---

### 4.7 Aspect Wizards — Les étapes clés

Le wizard `TrackingPlanWizard` est le cœur de l'expérience. 5 étapes principales + 2 transversales.

```
┌──────────────────────────────────────────────────────────────────┐
│  Étape 1/5 — Choisir mes outils                                  │
│                                                                  │
│  Quels services dois-je tracker depuis FemiGlow ?                │
│                                                                  │
│  ☑ Google Analytics 4         (déjà configuré dans v7)           │
│  ☑ Google Ads conversions     (déjà configuré dans v7)           │
│  ☑ Meta Pixel                 (déjà configuré dans v7)           │
│  ☐ TikTok Pixel                                                  │
│  ☐ Snapchat Pixel                                                │
│  ☐ Pinterest Tag                                                 │
│                                                                  │
│                                            [Continuer →]         │
└──────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────┐
│  Étape 2/5 — Identifiants                                        │
│                                                                  │
│  Google Analytics 4                                              │
│   Measurement ID : [G-5VHP17SDZM            ]  ← pré-rempli      │
│                                                                  │
│  Google Ads                                                      │
│   Customer ID    : [AW-987654321            ]                    │
│   Labels de conv. : ⊕ lead-form / purchase / view-content        │
│                                                                  │
│  Meta Pixel                                                      │
│   Pixel ID       : [1234567890123456        ]                    │
│   CAPI token     : [•••••••••••• (chiffré)   ]                   │
│                                                                  │
│                              [← Retour]  [Continuer →]           │
└──────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────┐
│  Étape 3/5 — Événements à envoyer                                │
│                                                                  │
│  Preset rapide :  [Standard FemiGlow ▾]  ou  Custom              │
│                                                                  │
│  Événement          GA4    Ads    Meta                           │
│  ─────────────────  ─────  ─────  ─────                          │
│  lead_form_submit   ✓      ✓ lead ✓                              │
│  add_to_cart        ✓      –      ✓                              │
│  purchase           ✓      ✓ buy  ✓                              │
│  view_content       ✓      –      ✓                              │
│  ... (étendre)                                                   │
│                                                                  │
│  [Voir tous les événements]                                      │
│                              [← Retour]  [Continuer →]           │
└──────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────┐
│  Étape 4/5 — Environnements                                      │
│                                                                  │
│  Production    Container GTM : [GTM-M8K7V88D]                    │
│                Overrides     : (aucun)                           │
│                                                                  │
│  Staging       Container GTM : [GTM-AAAAAAA]                     │
│                Overrides     : measurementId = G-TEST...         │
│                                                                  │
│  Dev (local)   Désactivé (envoie uniquement vers GA4 debug)      │
│                                                                  │
│                              [← Retour]  [Continuer →]           │
└──────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────┐
│  Étape 5/5 — Vérifier et publier                                 │
│                                                                  │
│  Résumé                                                          │
│   • 4 outils activés (GA4, Ads, Meta, TikTok)                    │
│   • 18 événements mappés                                         │
│   • 3 environnements configurés                                  │
│                                                                  │
│  Validation : ✓ Aucune erreur, 2 avertissements (cf. détails)    │
│                                                                  │
│  [Aperçu du JSON exporté ▾]                                      │
│  [Différences avec la version active ▾]                          │
│                                                                  │
│        [← Retour]  [Sauver en brouillon]  [Activer maintenant]   │
└──────────────────────────────────────────────────────────────────┘
```

**Étapes transversales :**
- **Onboarding (premier accès)** : modal d'introduction qui explique les concepts (« plan », « activation », « drift ») avec illustrations.
- **Réimportation** : modal accessible depuis le dashboard pour ré-générer le JSON d'un plan déjà activé (utile si admin a perdu le fichier).

---

## 5. Mécanisme auto-prefill (autocomplete) GA4 / Ads / GTM

C'était une demande explicite : *« les balises GA4, Google Ads, GTM doivent être automatiquement feed dans les deux JSON »*.

Avec l'approche B + D, le sujet devient simple : **il n'y a plus deux JSON**. L'unique JSON exporté contient déjà les vrais IDs (lus depuis `plan.providers`). Le pré-remplissage joue à un autre niveau : **lors de la création d'une nouvelle version de plan**.

### 5.1 Sources d'autocomplete

Quand Amal crée un nouveau plan (ou édite l'env staging d'un plan existant) :

1. **Source primaire :** dernier plan actif (`getActive()`). Tous les IDs sont pré-remplis.
2. **Source secondaire :** historique des plans archivés (last-write-wins par champ).
3. **Source tertiaire :** une table optionnelle `trackingDefaults` (key-value) que l'admin peut alimenter (« mon vrai measurement ID prod », « mon vrai pixel ID prod »).

L'autocomplete propose les valeurs **dans cet ordre**, avec un badge indicateur (« depuis Production v8 », « depuis defaults »).

### 5.2 Override visible

Chaque champ pré-rempli affiche un petit tag « auto-rempli ». Si l'admin saisit autre chose, le tag passe à « modifié ». Pour revenir à la valeur auto, un bouton ↺ apparaît.

### 5.3 Garde-fou « placeholder »

Le validator refuse **catégoriquement** les patterns connus de placeholders (`G-PROD0000`, `AW-REPLACE_WITH_*`, `1234567890123456`, etc.) avec un message explicite : *« Cet identifiant ressemble à une valeur de démonstration. Remplacez-le avant d'activer. »* Ce filtre vit côté serveur (impossible à contourner depuis l'UI) et empêche par construction la régression observée actuellement.

---

## 6. Export unique — Le contrat

### 6.1 Une seule fonction, un seul format

```
exportPlan(plan: TrackingPlan, env: 'production' | 'staging' | 'dev') → GtmContainerJson
```

Cette fonction est **déterministe** : même plan + même env = même JSON octet-pour-octet (hash vérifiable). Elle est testée par snapshots Vitest.

Le JSON produit suit le format GTM officiel (`exportFormatVersion: 2`) avec :
- `variable[]` : variables Constant pour chaque ID (GA4 measurement, Pixel Meta, Ads Customer…) — référencées partout par `{{nom}}`.
- `tag[]` : tags pour chaque événement activé pour chaque provider activé.
- `trigger[]` : un Custom Event trigger par eventName + un PageView pour les snippets initiaux.
- `builtInVariable[]` : standard.

### 6.2 Plus de double import

L'admin télécharge **un** fichier JSON. Elle l'importe dans GTM (option « Overwrite » la première fois, « Merge » jamais). Fin. Plus de « JSON mapper + JSON GTM ».

### 6.3 Compatibilité descendante

Pendant la phase de migration, l'ancien endpoint `/api/admin/tracking/events/mappings/:id/export-gtm` continue de fonctionner mais émet un warning header `X-Deprecated-Endpoint: use /api/admin/tracking/plans/:id/export`. Il est supprimé après une fenêtre de 60 jours (cf. plan d'action en étape B).

---

## 7. Migration & coexistence — Stratégie non-cassante

### 7.1 Phases

```
Phase 0 — Préparation                                  (1-2 jours)
  • Création table trackingPlans + schéma Zod.
  • Script de migration : trackingProviders + mappings + configs → 1 plan.
  • Tests snapshot sur le plan migré.

Phase 1 — Backend unifié                               (3-5 jours)
  • Endpoints /api/admin/tracking/plans/* en READ-ONLY.
  • Anciens endpoints intacts, lecture-seule depuis plan via adapter.
  • Export unique testé en parallèle des deux anciens.

Phase 2 — Frontend wizard                              (4-7 jours)
  • Route /admin/tracking + wizard 5 étapes.
  • Anciennes routes redirigent vers wizard pré-rempli.

Phase 3 — Mode expert + activation                     (3-5 jours)
  • Édition libre (3 colonnes).
  • Endpoints PATCH + activate fonctionnels.
  • Soft delete des anciens stores (lecture-seule).

Phase 4 — Cleanup                                      (60 jours après v1)
  • Suppression anciennes routes / endpoints / composants.
  • Suppression tables anciennes (avec backup).
  • Update docs gtm/* (les anciens fichiers archivés dans docs/gtm/legacy/).
```

### 7.2 Garde-fous pendant la transition

- Feature flag `tracking.unified-plan` côté admin (rollback rapide possible).
- Tests E2E qui pilotent **les deux** chemins (ancien + nouveau) jusqu'à phase 4.
- Alerte si plan actif et mapping actif (legacy) divergent en bundleId.

---

## 8. Risques & arbitrages assumés

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Bug de migration (perte d'IDs) | Moyenne | Élevé | Dry-run obligatoire + diff verbeux + backup automatique pré-migration |
| Wizard trop simplifié pour les cas avancés | Moyenne | Moyen | Mode expert dispo dès phase 3 + escape hatch « édition JSON brut » optionnelle |
| Performance JSONB sur plans très lourds | Faible | Moyen | Plans actuels < 100 KB → marge confortable ; pagination lecture audit si besoin |
| Adoption admin lente (peur du nouveau) | Moyenne | Moyen | Communication interne + screencast de 2 min + ancienne UI dispo en lecture-seule pendant 60j |
| Doublon résiduel après import GTM | Faible | Élevé | Le validator refuse placeholders + l'admin a un seul JSON à importer + recommandation GTM "Overwrite" documentée |
| Mode expert sur mobile non-utilisable | Acceptée | Faible | Decision UX : édition avancée = desktop only. Banner sur mobile renvoie vers wizard. |

---

## 9. Annexes

### A. Glossaire

| Terme | Définition |
|---|---|
| **TrackingPlan** | Objet métier unique qui décrit l'intention tracking complète (providers + events + envs). Versionné. |
| **bundleId** | Hash déterministe d'un plan. Utilisé par le drift detector pour vérifier que client et admin sont alignés. |
| **Provider** | Un service externe destinataire des événements (GA4, Meta, TikTok…). |
| **Event mapping** | La correspondance entre un événement FemiGlow et son nom chez un provider. |
| **Drift** | Écart entre ce que l'admin a publié et ce que le client web envoie réellement. |
| **Env profile** | Surcharge des IDs et options par environnement (production / staging / dev). |
| **Wizard** | Parcours guidé multi-step pour novices. Mode par défaut. |
| **Mode expert** | UI 3 colonnes pour admin avancé. Toggle depuis le wizard. |

### B. Glossaire visuel — Maquettes ASCII des écrans clés

**Home `/admin/tracking`**

```
┌─────────────────────────────────────────────────────────────────┐
│  Tracking FemiGlow                                              │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ Plan actif       │  │ Synchronisation  │                     │
│  │ Production v8    │  │ ✓ OK             │                     │
│  │ Activé 12/05     │  │ Dernier ping 2m  │                     │
│  │ 4 outils, 18 evt │  │                  │                     │
│  │ [Modifier]       │  │ [Détails]        │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                 │
│  Historique des versions                                        │
│  ──────────────────────                                         │
│  • Production v8  (actif)                                       │
│  • Production v7  (archivé 10/05)                               │
│  • Test campagne mai 2026 (brouillon)                           │
│                                                                 │
│                                          [+ Nouveau plan]       │
└─────────────────────────────────────────────────────────────────┘
```

**Mode expert `/admin/tracking/plans/:id/edit?mode=expert`**

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Production v9 (brouillon)                  [Wizard] [Expert ●]  [Sauver] │
├────────────────────┬─────────────────────────────────┬────────────────────┤
│  Sections          │  Édition                        │  Preview JSON      │
│                    │                                 │                    │
│  • Outils          │  Événement : lead_form_submit   │  {                 │
│  • Identifiants    │  ────────────────────           │   "container": {   │
│  • Événements (18) │  GA4 :  ☑ envoyer comme         │     "tag": [       │
│    > lead_form_..  │         [generate_lead       ]  │       { ... },     │
│    > add_to_cart   │  Ads :  ☑ envoyer comme         │       { ... },     │
│    > purchase      │         conversion [lead-form] │       ...          │
│    > ...           │  Meta : ☑ envoyer comme         │     ]              │
│  • Environnements  │         standard event [Lead]   │   }                │
│  • Validation (2⚠) │  TT :   ☐ désactivé             │  }                 │
│                    │                                 │                    │
│                    │  ⚠ Aucun nom mappé pour Meta    │  [Copier] [Diff]   │
│                    │     en mode Custom              │                    │
│                    │                                 │                    │
└────────────────────┴─────────────────────────────────┴────────────────────┘
```

---

## Conclusion

L'approche hybride **B (Tracking Plan) + D (Wizard-First)** offre la meilleure combinaison force / risque pour FemiGlow :
- Elle règle la **cause racine** (deux chaînes d'export, IDs fragmentés) sans rajouter une couche d'abstraction sans valeur immédiate.
- Elle livre une **expérience admin moderne** dès la phase 2 (wizard fonctionnel).
- Elle est **migrable progressivement** sans coupure ni big-bang risqué.
- Elle empêche **par construction** la régression actuelle (doublons d'événements GA4).

Une fois cette proposition conceptuelle validée, l'**étape B** produira le dossier technique complet avec sous-dossiers `data/`, `backend/`, `frontend/`, `analytics/`, `ui/`, `ux/`, `design/`, `ergonomics/`, `plans/` (conception, dev, action), `architecture/`, `runbook/`, et **la batterie de tests** (Jest unit, Playwright E2E, MSW intégration) couronnée d'un **test ultime d'intégration** qui valide qu'un parcours complet (création plan → activation → export → import GTM simulé → événement → réception GA4 simulée) fonctionne de bout en bout.

---

*Fin du document conceptuel. Prochain artefact : étape B (dossier technique complet).*

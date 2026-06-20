# Charte UX & qualité — Admin Emails (barème relevé 2026-06-20)

> **Pourquoi ce document.** Le plan `07` + la stratégie `05` sont forts sur la
> CORRECTION (gates G1–G9 : batteries, grille réseau, conformité contrats,
> a11y, anti-flaky). L'évaluation multi-agents du 2026-06-20 a montré 6 angles
> morts vis-à-vis du barème exigé : **design de très haut calibre**,
> **assistance à la saisie (autocomplétion partout)**, **sécurité**,
> **performance/optimal**, **observabilité/débogabilité**, **modularité &
> évolutivité**. Cette charte érige ces 6 axes en **critères vérifiables** et
> en **6 gates supplémentaires G10–G15**, bloquants au même titre que G1–G9.
>
> **Portée.** Tout le sous-système `admin/emails/**` (+ `lib/mail/**`). Les
> phases déjà livrées (P0–P2) seront ramenées au standard par une passe de
> rattrapage (cf. P3.0 du plan) ; les phases P3–P5 naissent conformes.
>
> **Positionnement design assumé.** L'admin emails est un **sous-système
> utilitaire dense** (cockpit d'opérateur), distinct de la charte éditoriale du
> site public : sans-serif système, palette **stone-neutre** + tons sémantiques,
> densité élevée, raccourcis clavier. Ce n'est pas une dérive — c'est un choix
> documenté ici, pour qu'il soit cohérent au lieu d'accidentel.

---

## Partie A — Design de très haut calibre (gate G10)

> Principe : **« consommer le socle » ne suffit pas.** Le calibre se prouve par
> des tokens uniques, une hiérarchie réelle, des états dessinés, des
> micro-interactions et une non-régression visuelle — pas par l'absence de bug.

### A.1 Source unique de tokens (`ui/tokens.ts`) — scoping-safe

`tailwind.config` reste **gelé** (risque de débordement sur le site public).
On n'introduit donc PAS d'alias `semantic.*` dans la config : on centralise les
**chaînes de classes Tailwind** déjà employées dans **un seul module TS**
`components/admin/emails/ui/tokens.ts`, consommé par tout le sous-système.

```ts
// Échelle d'INTENSITÉ de ton (subtle | solid), pas de nuances 50/100/200 ad hoc.
export const TONE = {
  neutral:  { subtle: 'bg-stone-100 text-stone-700',   solid: 'bg-stone-800 text-white' },
  success:  { subtle: 'bg-emerald-50 text-emerald-700', solid: 'bg-emerald-700 text-white' },
  warning:  { subtle: 'bg-amber-50 text-amber-800',     solid: 'bg-amber-600 text-white' },
  danger:   { subtle: 'bg-rose-50 text-rose-700',       solid: 'bg-rose-700 text-white' },
  info:     { subtle: 'bg-sky-50 text-sky-700',         solid: 'bg-sky-700 text-white' },
} as const;
export const TYPO = { pageTitle:'text-2xl font-semibold tracking-tight text-stone-900',
  cardHeading:'text-sm font-medium text-stone-700', label:'text-xs font-medium text-stone-600',
  meta:'text-xs text-stone-500', mono:'font-mono text-xs tabular-nums' } as const;
export const SPACE = { page:'max-w-6xl', section:'space-y-6', card:'p-4', field:'space-y-1.5' } as const;
export const RADIUS = { card:'rounded-md', control:'rounded', pill:'rounded-full' } as const;
export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-1' as const;
export const MOTION = { enter:'motion-safe:transition motion-safe:duration-150 motion-safe:ease-out' } as const;
```

- **`Pill.TONE_CLS` et `common/StatusBadge.STATUS_META` consomment `TONE`** (une
  seule source ; aujourd'hui dupliquées 50/700 vs 100/800).
- **Verrou (cliquet, décroissant)** : un test échoue si une classe `bg-`/`text-`
  /`border-` de **couleur** (hors `stone-` neutre) apparaît **hors de
  `tokens.ts`** dans `components/admin/emails/**` et `app/admin/emails/**`.
  Étend le verrou existant `F01-U-065/066` (qui ne couvrait que `sage/red/blue`).

### A.2 Primitives socle obligatoires (anti-duplication)

Aujourd'hui les classes de bouton/carte/focus sont **recopiées inline** dans
ConfirmDialog, EmptyState, toast, KpiCards, FilteredTable. On extrait 6
primitives testées dans `ui/`, et un **verrou** interdit le markup ad hoc :

| Primitive | Contrat |
|---|---|
| `Button` | variants `primary\|secondary\|danger\|ghost` × `sm\|md` ; `busy` → `aria-busy` + libellé dédié + 1 invocation ; `data-variant` |
| `IconButton` | `aria-label` OBLIGATOIRE (type-level) |
| `Field` | `label` (TYPO.label) + aide + erreur inline + slot input ; `id`/`aria-describedby` câblés |
| `Card` | `RADIUS.card` + `border-stone-200` + `SPACE.card` |
| `Skeleton` | `role="status"` + `sr-only` + arbre `aria-hidden` (jamais un spinner sur une liste) |
| `Banner` | tones (TONE) + slots icône/titre/corps/action ; `role` selon sévérité ; **tout bandeau dérive de Banner** (F10, dégradations) |

- **Verrou** : aucune classe de bouton/carte/focus inline hors de ces primitives
  (whitelist cliquet décroissante).
- **Iconographie** : `lucide-react` pour les icônes d'**action** (tree-shaking
  par icône, budget d'import vérifié) ; l'emoji reste réservé à la **couleur
  fonctionnelle de statut** et porte **`aria-hidden`** systématiquement (test
  recensant les emoji et exigeant `aria-hidden` sur leur conteneur).

### A.3 Doctrine d'états (vide / chargement / erreur) — DESSINÉS

- **Vide** → `EmptyState` (icône + titre + copy + CTA). Jamais un tableau vide muet.
- **Chargement** → `Skeleton` structurel (colonnes fantômes de table, cartes KPI
  fantômes). **Jamais** un spinner générique sur une liste.
- **Erreur** → message `role="alert"` **dessiné** (Banner danger), état utilisateur
  préservé, action de reprise. (Reprend l'oracle « zéro faux succès » de G2.)

### A.4 Micro-interactions & focus

- Transitions d'entrée **motion-safe** (`MOTION.enter`, < 200 ms) sur dialog,
  listbox/combobox, toast, apparition de bandeau/chips. **0 apparition sèche.**
- `prefers-reduced-motion` respecté (déjà global) — gardé par `motion-safe:`.
- **Focus ring unique** (`FOCUS`) ; test axe `focus-visible` sur chaque primitive.

### A.5 Responsive (dense → adaptatif)

Chaque écran déclare son comportement aux 3 breakpoints (≤375 / 768 / desktop) :
- **Tables denses** (cockpit, liste campagnes, events) : bascule
  grille→stack/cartes au breakpoint, colonnes prioritaires, overflow maîtrisé.
- **Wizards** : stepper horizontal→vertical, récap latéral→accordéon, pickers natifs.
- **Panneaux** (variables templates, FlowView) : drawer/onglet < 1024 px.

### A.6 Non-régression visuelle — la couche D

- Nouvelle **couche de batterie `D`** (id `Fxx-D-nnn`) : oracles de design
  traçables au même titre que U/C/I/E/A.
- **Snapshots Playwright par écran refondu, aux 3 viewports**, baseline validée à
  la revue de phase. (Aurait capté les contrastes `stone-400` AVANT l'E2E.)
- **Revue de design opposable** (checklist §A.7), verdict écrit archivé au journal.

### A.7 Checklist de revue de design (signée par phase — gate G10)

1. Espacement = **uniquement** des pas de `SPACE` (0 valeur magique).
2. Typo = **uniquement** des rôles de `TYPO` (0 `text-2xl`/`p-5` dispersé).
3. Couleur = **uniquement** `TONE` (0 hex brut, 0 classe one-off, 0 nuance ad hoc).
4. États vide/chargement/erreur **dessinés** (§A.3).
5. Micro-interactions + focus visible (§A.4).
6. Responsive aux 3 breakpoints prouvé (snapshot §A.6).

---

## Partie B — Assistance à la saisie : autocomplétion PARTOUT (gate G11)

> Principe : **aucun champ « assistable » laissé en saisie libre nue.** Si une
> valeur est énumérable, existante en base, dérivable ou contrainte de format,
> l'opérateur est ASSISTÉ. L'absence d'assistance doit être **justifiée par écrit**.

### B.1 Inventaire d'assistance (CSV transverse)

`technique/10-inventaire-assistance.csv` (nouveau) liste **chaque champ** du
programme avec : `ecran, champ, type, assiste(O/N), mecanisme
(autocomplete|suggestions|smart_default|inline_validation|format_hint),
nav_clavier(O/N), justification_si_non`. **Critère G11 : 0 champ assistable en
saisie nue sans justification écrite, chacun avec son test.**

### B.2 Mécanismes (par ordre de préférence)

1. **Autocomplétion typeahead** sur entité existante (`EntityCombobox`) :
   recherche serveur paginée, surlignage du terme, tri par récence/usage,
   clavier (flèches/Entrée/Échap), a11y combobox (`role`, `aria-activedescendant`).
2. **Smart default** : valeur la plus probable pré-remplie (email admin connecté,
   fenêtre dashboard mémorisée, raison de suppression fréquente, dernier créneau).
3. **Validation inline** progressive (avant POST) + **format hint** sous le champ.
4. **Insertion de jetons** (merge-tags `{{ … }}`) : menu d'autocomplétion des
   variables disponibles + signalement des variables inconnues.

### B.3 Verrou de couverture `EntityCombobox` (cliquet décroissant)

Test listant les `<input>` de recherche/sélection d'entité dans le périmètre
**non** encapsulés par `EntityCombobox` (whitelist décroissante, même mécanique
que les verrous existants). Cible finale : whitelist vide.

### B.4 Champs assistables identifiés (extrait — détail dans chaque Fxx)

- **F05** : email test-send (smart default admin + datalist récents), nom de
  campagne (suggestions), template Listmonk (typeahead), filtre des listes,
  merge-tags sujet/preheader/corps, datetime (« demain 9h »), id Listmonk orpheline (select).
- **F06** : `testContact` dry-run (autocomplete admin + récents), slug (dérivé +
  unicité live), sélecteur d'événement (typeahead catalogue), durées (presets).
- **F07** : slug (slugify live + dispo), `recipient`/`contextEmail` (combobox de
  leads avec nb commandes), `customVars` (Prettify + autocomplete des clés).
- **F09** : email (endpoint `recipients/suggest`), nom d'event (combobox `DISTINCT`).
- **F10** : (peu de saisie) — re-poll ciblé, pas de champ libre.

---

## Partie C — Les 8 dimensions comme critères vérifiables

> Chaque dimension cesse d'être un vœu : elle est rattachée à un gate et à un
> mécanisme de vérification.

| Dimension | Critère vérifiable | Gate |
|---|---|---|
| **Modulaire** | 0 import croisé entre sections ; primitives socle réutilisées (pas de markup dupliqué) ; barrel `ui/index.ts` stable | G15 |
| **Évolutif** | contrats Zod versionnés ; conformité sur **tous** les endpoints (pas seulement touchés) ; maps de domaine exhaustives (ajout d'un statut/raison/trigger ne casse rien en silence) ; `payload_json` wizard versionné + tolérance legacy | G15 |
| **Déboggable** | chaque action d'écriture émet `logger.info('<domaine>.<action>', {champs})` **sans** champ `event` (collision) ; correlation-id front↔route↔domaine ; chemins d'erreur tracés ; `data-tone`/`data-variant`/`data-state` sur primitives | G14 |
| **Maintenable** | tests préfixés par ID (croisement CSV↔code) ; factories only ; cliquets décroissants ; charte de design unique ; ADR pour décisions non-évidentes | G10/G15 |
| **Sécurisé** | authz par endpoint (401/403) ; Zod ; caps+bornes sur bulk ; sanitization HTML (TPL-F11) ; anti CSV formula-injection ; `frame-ancestors` ; redaction PII des logs/messages upstream ; rate-limit des envois assistés ; 0 secret en clair ; `/security-review` sur le diff de phase | G12 |
| **Fiable** | grille réseau 6/6 ; idempotence (idempotency_key, snapshotKey, `ON CONFLICT`) ; reapers ; tests de **concurrence** (TOCTOU soft-delete, optimistic-lock autosave, double-POST) | G2/G12 |
| **Fonctionnel** | scénarios métier E2E `SM-Fxx` verts ; le scénario PHARE de chaque Fxx est réellement servi (ex. bulk-by-filter livré, pas multi-pages manuel) | G8 |
| **Optimal** | budget par écran : bundle gz, nb requêtes DB/page, **p95 latence route** ; index (trigram/fonctionnel) ; débounce ; cache TTL chiffré + testé ; streaming borné des exports | G13 |

---

## Partie D — Gates supplémentaires (G10–G15)

> À reporter dans `05-strategie-tests.md §5` (table des gates) et appliqués par
> le runbook `08 §5` (gate de fin de phase) + revue par PR.

| Gate | Seuil | Où / Comment |
|---|---|---|
| **G10 DESIGN** | checklist §A.7 signée + snapshots visuels 3 viewports verts + tokens respectés (verrou couleur) | revue de phase + CI (couche D) |
| **G11 ASSISTANCE** | inventaire `10-inventaire-assistance.csv` à jour ; 0 champ assistable nu non justifié ; verrou `EntityCombobox` décroissant | revue + CI (cliquet) |
| **G12 SÉCURITÉ** | checklist sécurité (§C ligne « sécurisé ») verte ; `/security-review` sur le diff de phase sans finding bloquant ; batterie `Fxx-S-nnn` verte | fin de phase + PR |
| **G13 PERFORMANCE** | budgets déclarés (bundle/DB/p95) **non dépassés** ; `next build` échoue si bundle dépasse ; assertions EXPLAIN/borne de temps en intégration | CI + intégration |
| **G14 OBSERVABILITÉ** | 100 % des actions d'écriture de la phase émettent leur log structuré (test sur logger espionné) + correlation-id propagé | revue + CI (tests d'émission) |
| **G15 MODULARITÉ** | 0 import croisé (lint AST) ; conformité contrats **totale** (pas seulement endpoints touchés) ; maps exhaustives ; barrel `ui/` | CI + revue |

### Nouvelles couches de batterie

- **`D` (design)** : `Fxx-D-nnn` — snapshots visuels, contrastes, tokens, responsive.
- **`S` (sécurité)** : `Fxx-S-nnn` — sanitization, CSV-injection, authz exhaustive,
  rate-limit, redaction PII, concurrence sécurité.
- (`U/C/I/E/A` inchangées.) Schéma d'ID & comptage mécanique : cf. `05 §6`.

---

## Partie E — Conséquences sur le plan & le runbook

1. **Nouvelle étape `P3.0 — Socle design & assistance v2`** (avant que F05/F07 ne
   consomment) : extraire `tokens.ts` + primitives (Button/IconButton/Field/
   Card/Skeleton/Banner) + `EntityCombobox` promu socle + baseline snapshots +
   verrous (couleur, primitives, combobox) + migration des écrans P0–P2 au standard
   (dette FilteredTable.formatDate, StatusBadge↔Pill, focus ring). Pilote = même
   doctrine que P1.5 : on valide le socle v2 sur 1 écran déjà livré avant de généraliser.
2. **Chaque étape Fxx de P3–P5** voit ses gates étendus à `G10–G15` (cf. `07`).
3. **Runbook `08`** : §5 gagne 5 revues (design, assistance, sécurité, observabilité,
   perf) ; §7 journal gagne la colonne « verdict design + assistance » ; §8 clôture
   gagne les critères G10–G15.
4. **Chaque `Fxx/05-plan-implementation.md`** reçoit une section « Enrichissement
   barème relevé » (design/assistance/sécurité/observabilité/perf/concurrence).

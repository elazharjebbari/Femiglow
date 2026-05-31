# 13 — Wizard design — spécification UI/UX exhaustive

> *Référence designer pour chaque composant, bloc, graphique,
> figure, dashboard et stat du module Analytics Insights.
> Niveau de détail : pixel-perfect, états complets, interactions,
> micro-animations, hiérarchie typographique, a11y.*

---

## Sommaire

- [§1 Système global](#1-système-global)
- [§2 Tokens de design](#2-tokens-de-design)
- [§3 Layouts](#3-layouts)
- [§4 Composants de structure](#4-composants-de-structure)
- [§5 Filtres & contrôles](#5-filtres--contrôles)
- [§6 Refresh indicator](#6-refresh-indicator)
- [§7 Tabs](#7-tabs)
- [§8 KPI cards](#8-kpi-cards)
- [§9 Charts — anatomies détaillées](#9-charts--anatomies-détaillées)
- [§10 Tables](#10-tables)
- [§11 Drawers de drill-down](#11-drawers-de-drill-down)
- [§12 États transverses](#12-états-transverses)
- [§13 Micro-animations](#13-micro-animations)
- [§14 Voix éditoriale](#14-voix-éditoriale)
- [§15 A11y](#15-a11y)
- [§16 Responsive — règles strictes](#16-responsive--règles-strictes)
- [§17 Patterns d'erreurs UI](#17-patterns-derreurs-ui)
- [§18 Index visuel des dashboards](#18-index-visuel-des-dashboards)

---

## 1. Système global

### 1.1 Philosophie

> Une console de lecture. Pas un terrain de jeu.

| Principe                            | Traduction concrète                                                       |
| ----------------------------------- | ------------------------------------------------------------------------- |
| **Silence visuel d'abord**          | Hairlines plutôt que bordures, espace blanc plutôt que séparateurs lourds |
| **Chiffre = roi**                   | Les nombres dominent par leur taille et leur poids tabulaire              |
| **Couleur = signal, pas décoration**| Une couleur n'apparaît que si elle porte une information                   |
| **Action = explicite**              | Les CTA sont nommés (pas d'icône seule sans label)                        |
| **Lecture = direction**             | Hiérarchie verticale stricte : KPI → tendance → détail → drill            |
| **Pas de friction inutile**         | Filtres en URL, refresh en 1 clic, export en 1 clic                       |

### 1.2 Grille

| Breakpoint   | Container max | Gutter | Colonnes |
| ------------ | ------------- | ------ | -------- |
| `< 640 px`   | 100 % - 32 px | 16 px  | 4         |
| `640-1024`   | 100 % - 48 px | 20 px  | 8         |
| `1024-1280`  | 1024 px       | 24 px  | 12        |
| `≥ 1280 px`  | 1280 px       | 24 px  | 12        |

**Padding vertical** d'une page admin : `24 px` mobile, `32 px` desktop.

### 1.3 Z-index

| Layer                 | Valeur |
| --------------------- | ------ |
| Base (page)           | 0      |
| Sticky filters bar    | 10     |
| Tooltips              | 30     |
| Drawer drill-down     | 40     |
| Modal exports         | 50     |
| Toasts                | 60     |

---

## 2. Tokens de design

### 2.1 Couleurs (extension du système admin)

```css
/* Surfaces */
--insights-page-bg:           #FBF8F1;  /* fond global crème admin */
--insights-card-bg:           #FFFFFF;  /* cartes KPI, panneaux */
--insights-card-bg-subtle:    #FAF8F2;  /* hover de table, section info */
--insights-overlay-bg:        rgba(44, 42, 40, 0.32); /* overlay drawer */

/* Hairlines & dividers */
--insights-hairline:          #E5E2DD;
--insights-hairline-strong:   #D6D3CA;

/* Texte */
--insights-text-primary:      #2C2A28;  /* encre */
--insights-text-secondary:    #6B6863;  /* labels, sous-titres */
--insights-text-tertiary:     #9A9690;  /* meta info, timestamps */
--insights-text-muted:        #B8B4AD;  /* watermarks, désactivés */

/* Séries (charts & cartes) */
--insights-series-1:          #2C2A28;  /* events (encre) */
--insights-series-2:          #A8C4A6;  /* sessions (sauge) */
--insights-series-3:          #C8A876;  /* conversions (champagne) */
--insights-series-4:          #E2B6B2;  /* bounce (pétale rose) */
--insights-series-5:          #8FA4C7;  /* secondaires (ciel) */

/* Signaux */
--insights-signal-positive:    #3F5B41;  /* sauge profond — variation positive désirée */
--insights-signal-negative:    #8C3A3A;  /* pétale rouge — variation indésirable */
--insights-signal-neutral:     #6B6863;  /* gris encre */
--insights-signal-warning:     #B27F3E;  /* orange ombré */
--insights-signal-info:        #4A6486;  /* bleu nuit */

/* Heatmap (gradient sauge) */
--insights-heat-min:          #F0F4ED;  /* sauge très diluée */
--insights-heat-max:          #5A7A58;  /* sauge profonde */

/* Focus */
--insights-focus-ring:        #2C2A28;
--insights-focus-offset:      2px;
```

### 2.2 Typographie

```css
--insights-font-sans:        'Inter', system-ui, sans-serif;
--insights-font-tabular:     'Inter', system-ui, sans-serif; /* + font-feature-settings 'tnum' */
--insights-font-display:     'Fraunces', Georgia, serif;     /* uniquement empty states éditoriaux */

--insights-text-xs:          11px / 16px;
--insights-text-sm:          12px / 18px;
--insights-text-base:        13px / 20px;
--insights-text-md:          14px / 22px;
--insights-text-lg:          16px / 24px;
--insights-text-xl:          20px / 28px;
--insights-text-2xl:         28px / 34px;  /* KPI value */
--insights-text-3xl:         36px / 44px;  /* KPI value emphatique */
```

| Usage                     | Token                                             |
| ------------------------- | ------------------------------------------------- |
| Titres de page            | `text-xl` / 600 / encre                            |
| Titres de panneau         | `text-md` / 600 / encre                            |
| Sous-titres / labels      | `text-xs` / 500 / uppercase / `letter-spacing: 0.06em` / secondary |
| KPI value                 | `text-2xl` / 600 / tabular / encre                 |
| KPI variation             | `text-sm` / 500 / tabular / signal                 |
| Tableau cellule           | `text-base` / 400 / encre                          |
| Tableau header            | `text-xs` / 600 / uppercase / secondary            |
| Tooltips                  | `text-sm` / 500 / encre                            |
| Empty state titre         | `text-lg` / 500 / Fraunces / encre                  |
| Meta (timestamp, etc.)    | `text-xs` / 400 / tertiary                          |

### 2.3 Espacements

```css
--insights-space-0:           0;
--insights-space-1:           4px;
--insights-space-2:           8px;
--insights-space-3:           12px;
--insights-space-4:           16px;
--insights-space-5:           20px;
--insights-space-6:           24px;
--insights-space-8:           32px;
--insights-space-10:          40px;
--insights-space-12:          48px;
--insights-space-16:          64px;
```

### 2.4 Rayons

```css
--insights-radius-sm:         4px;   /* badges, chips */
--insights-radius-md:         8px;   /* cartes, panneaux */
--insights-radius-lg:         12px;  /* drawers, modals */
--insights-radius-pill:       9999px; /* segments, statut */
```

### 2.5 Élévation

```css
--insights-shadow-none:       none;
--insights-shadow-hairline:   0 0 0 1px var(--insights-hairline);    /* cartes par défaut */
--insights-shadow-soft:       0 1px 2px rgba(44, 42, 40, 0.04),
                              0 0 0 1px var(--insights-hairline);    /* hover de carte */
--insights-shadow-drawer:     0 -8px 32px rgba(44, 42, 40, 0.12);    /* drawer mobile */
--insights-shadow-modal:      0 16px 48px rgba(44, 42, 40, 0.16);    /* modal export */
```

### 2.6 Durées d'animation

```css
--insights-motion-fast:       120ms;  /* tooltips, hover */
--insights-motion-base:       240ms;  /* draw chart, fade in */
--insights-motion-slow:       400ms;  /* drawer slide */
--insights-motion-count-up:   600ms;  /* KPI count-up */

--insights-ease-out:          cubic-bezier(0.16, 1, 0.3, 1);
--insights-ease-in-out:       cubic-bezier(0.65, 0, 0.35, 1);
```

### 2.7 Largeurs de stroke / line

```css
--insights-stroke-hairline:   1px;
--insights-stroke-line:       1.5px;  /* timeseries lines */
--insights-stroke-line-bold:  2px;    /* highlighted series */
--insights-stroke-axis:       1px;
--insights-stroke-grid:       0.5px;  /* dashed grid */
```

---

## 3. Layouts

### 3.1 Layout général page `/admin/analytics/insights`

```
┌─ AdminShell (existant) ─────────────────────────────────────────────┐
│                                                                     │
│  ┌─ Page header ────────────────────────────────────────────────┐  │
│  │  H1 "Analytics Insights"             RefreshIndicator (sticky) │
│  │  meta "X événements / 7 derniers jours"                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Filters bar (sticky) ──────────────────────────────────────┐  │
│  │  [Période] [Env] [Device] [Locale] [Source] [+]    [Reset]   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Tabs ───────────────────────────────────────────────────────┐  │
│  │  Overview · Pages · Composants · Sections · Funnel             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Tab content ───────────────────────────────────────────────┐  │
│  │  (variable selon onglet)                                      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Page footer ───────────────────────────────────────────────┐  │
│  │  meta "Données du XX-XX-XXXX au YY-YY-YYYY"                  │  │
│  │  meta "Refreshed at HH:MM · cf. /admin/analytics/insights/runs" │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Mesures clés** :
- Page header → marge bottom `space-6`
- Filters bar → marge bottom `space-4`, padding vertical `space-3`
- Tabs → marge bottom `space-6`, séparateur hairline en dessous
- Section gap (entre 2 panneaux dans un onglet) → `space-8`
- Card padding interne → `space-6`

### 3.2 Layout — onglet Overview

```
[Row 1] Bandeau KPI                                  ← 6 cartes en ligne
[Row 2] Time-series principale (full width)          ← carte large, 320 px high
[Row 3] Heatmap (col-span-7) + Top events (col-span-5)  ← split 7/5
[Row 4] Distribution device (col-span-4) + Distribution traffic source (col-span-4) + Distribution locale (col-span-4)  ← split 4/4/4
```

### 3.3 Layout — onglet Pages

```
[Row 1] Bandeau mini-KPI Pages (4 chiffres)
[Row 2] Top 30 pages — table large (full width)
[Row 3] Treemap pages × engagement (full width, 360 px high)
[Row 4] Évolution des 5 pages les plus visitées (line chart small multiples)
```

### 3.4 Layout — onglet Composants

```
[Row 1] Bandeau mini-KPI Composants (4 chiffres)
[Row 2] Top 50 composants — table (full width)
[Row 3] Composants morts (col-span-6) + Mapping composants ↔ events (col-span-6, sankey light)
```

### 3.5 Layout — onglet Sections

```
[Row 1] Bandeau mini-KPI Sections (3 chiffres)
[Row 2] Bar chart horizontal — sections par durée (col-span-7)
        Table sections (col-span-5)
[Row 3] Heatmap section × jour (full width, optionnel V2)
```

### 3.6 Layout — onglet Funnel

```
[Row 1] Bandeau mini-KPI Funnel (5 étapes en mini-cards)
[Row 2] Sankey funnel (full width, 360 px high)
[Row 3] Drop-offs détaillés — table (col-span-7) + Évolution conversion 30j (col-span-5)
```

---

## 4. Composants de structure

### 4.1 `<Card>`

**Anatomie** :

```
┌─────────────────── 8 px radius, hairline 1px ──────────────────┐
│                                                                  │
│  ┌─ Header ──────────────────────────────────────────────┐      │
│  │  Title (text-md, 600)            [Action button(s)]    │      │
│  │  Subtitle (text-xs, 500, uppercase, secondary)         │      │
│  └────────────────────────────────────────────────────────┘      │
│  ┌─ Hairline ────────────────────────────────────────────┐      │
│  └────────────────────────────────────────────────────────┘      │
│  ┌─ Body ────────────────────────────────────────────────┐      │
│  │  (chart, table, etc.)                                  │      │
│  └────────────────────────────────────────────────────────┘      │
│  ┌─ Footer (optional) ───────────────────────────────────┐      │
│  │  meta info / [Action secondaire]                       │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Mesures** :
- Padding header : `space-5` × `space-6`
- Padding body : `space-6`
- Padding footer : `space-3` × `space-6`, fond `--insights-card-bg-subtle`
- Hairline interne : `--insights-hairline`

**Variantes** :
- `Card.Plain` — sans header
- `Card.Compact` — padding `space-4`
- `Card.Bordered` — bordure complète au lieu de hairline (utilisé pour "danger")
- `Card.Featured` — hairline en `--insights-series-3` (champagne) pour mettre en avant

**États** :
- `default` : hairline
- `hover` (si interactive) : `shadow-soft` + `transform: translateY(-1px)` (160 ms)
- `loading` : opacity 0.6 + skeleton à l'intérieur

### 4.2 `<SectionHeader>`

```
┌─────────────────────────────────────────────────┐
│  H2 — text-lg, 600                               │
│  Subtitle — text-sm, 400, secondary              │
│                                  [Action / Link] │
└─────────────────────────────────────────────────┘
```

**Mesures** :
- Margin bottom `space-4`
- H2 + subtitle : gap `space-1`
- Action alignée à droite (`flex justify-between`)

### 4.3 `<Hairline>`

Simple `<div role="separator" />` :
- Hauteur 1 px
- Couleur `--insights-hairline`
- Margin vertical `space-4` ou `space-6` selon contexte

### 4.4 `<MetaText>`

Petit texte de meta-info (timestamp, source, etc.) :
- `text-xs`, 400, tertiary
- Icône optionnelle 12 × 12 px à gauche, gap `space-1`

---

## 5. Filtres & contrôles

### 5.1 `<FiltersBar>`

**Anatomie** :

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ⊕   │
│  │Période ▾│  │ Env  ▾│  │Device▾│  │Locale▾│  │Source ▾│   Plus│
│  │  7j     │  │ all  │  │ all   │  │ all   │  │  all   │   filt│
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘     │
│                                                          [Reset] │
└──────────────────────────────────────────────────────────────────┘
```

**Mesures** :
- Hauteur fixe : `40 px`
- Padding interne `space-2 space-3`
- Gap entre filtres : `space-2`
- Background `--insights-card-bg`
- Hairline bottom seule
- Sticky `top: 64 px` (sous header admin)

### 5.2 `<FilterSelect>` (chip-button)

**Composant** : bouton stylé en pill plat, qui ouvre un popover.

```
┌───────────────────────────────┐
│ Période · 7j ▾                │   ← collapsed
└───────────────────────────────┘

┌───────────────────────────────┐   ← expanded (popover ancré)
│ ○ Aujourd'hui                  │
│ ○ Hier                         │
│ ● 7 derniers jours              │
│ ○ 30 derniers jours             │
│ ○ 90 derniers jours             │
│ ─────────────────────────────  │
│ ○ Personnalisé…                │
│ ─────────────────────────────  │
│ ○ Tout l'historique            │
└───────────────────────────────┘
```

**États** :
- `default` : fond `--insights-card-bg`, hairline, encre
- `hover` : fond `--insights-card-bg-subtle`, hairline strong
- `active` (popover ouvert) : hairline `--insights-text-primary`
- `applied` (valeur ≠ default) : hairline `--insights-series-3` (champagne) + bullet point champagne à gauche du label

**Anatomie label** :
```
[Label clé] · [Valeur] [▾]
```

Si la valeur est `all` ou égale au default, on affiche juste `[Label clé] [▾]`.

### 5.3 Custom date range

Apparaît dans le popover `Période` quand "Personnalisé" est cliqué :

```
┌──────────────────────────────┐
│ ○ Personnalisé…              │
│   ┌─────────┐  ┌─────────┐   │
│   │ Du      │  │ Au      │   │
│   │ JJ/MM/AA│  │ JJ/MM/AA│   │
│   └─────────┘  └─────────┘   │
│   [Annuler]  [Appliquer]     │
└──────────────────────────────┘
```

**Validation** :
- `From > To` → bouton Appliquer désactivé + message inline
- `> 365 jours` → message inline rouge sobre

### 5.4 `<FiltersResetButton>`

Bouton text seul, visible uniquement si ≥ 1 filtre est appliqué.

```
[Reset filtres]
```

- `text-xs`, 500, secondary
- Hover : underline
- Click : router.replace sans params

### 5.5 Plus de filtres `+`

Bouton compact `⊕ Plus` qui ouvre un popover avec les filtres avancés
(consent state, experiment_id, traffic_medium…).

---

## 6. Refresh indicator

### 6.1 Vue d'ensemble

Composant **toujours visible**, en haut à droite de la page header.
Son rôle : indiquer la fraîcheur des données + fournir l'accès au
refresh manuel + au toggle.

### 6.2 Anatomie collapsed (default)

```
┌──────────────────────────────────────────┐
│ ●  Mis à jour il y a 7 min   ▾            │
└──────────────────────────────────────────┘
```

- Bullet à gauche (8 × 8 px) : `--insights-signal-positive` si success récent
- Texte : `text-sm`, 500, encre
- Caret droite ouvre un panneau

### 6.3 Anatomie expanded

```
┌─────────────────────────────────────────────────────────────────┐
│ Refresh status                                                  │
│                                                                 │
│ ●  Dernier run : succès                                         │
│    Il y a 7 min  ·  durée 23 s  ·  1 245 events agrégés         │
│                                                                 │
│ Auto · toutes les 15 min                       [● ON]   [OFF]   │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ [Refresh maintenant]                  Voir les 10 derniers runs │
└─────────────────────────────────────────────────────────────────┘
```

**Mesures** :
- Largeur 360 px desktop, 100% mobile
- Padding `space-5`
- Box-shadow `shadow-soft`
- Animation slide down 240 ms

### 6.4 États du bullet

| État               | Couleur                         | Animation               |
| ------------------ | ------------------------------- | ----------------------- |
| success récent     | `--insights-signal-positive`     | aucune                  |
| success > 30 min   | `--insights-text-secondary`      | aucune                  |
| running            | `--insights-signal-info`         | pulse 1.6 s loop        |
| failed             | `--insights-signal-negative`     | aucune (ou shake initial) |
| disabled           | `--insights-text-muted`          | aucune                  |

### 6.5 Variantes textuelles

| État     | Texte collapsed                                | Texte expanded (header)          |
| -------- | ---------------------------------------------- | -------------------------------- |
| success  | "Mis à jour il y a 7 min"                       | "Dernier run : succès"           |
| running  | "Calcul en cours…"                              | "Calcul en cours"                 |
| failed   | "Refresh échoué — vu il y a 22 h"               | "Dernier run : échec"             |
| disabled | "Refresh manuel uniquement"                     | "Auto désactivé"                  |
| firstRun | "Premier calcul en cours…"                      | "Premier calcul"                  |

### 6.6 Toggle ON/OFF

Switch pill segmenté (pas un toggle iOS) :

```
[● ON]   [OFF]    ← état ON
[ON]   [● OFF]    ← état OFF
```

- Pill segmenté 64 × 28 px
- Segment actif : fond `--insights-text-primary`, texte blanc
- Segment inactif : fond transparent, texte secondary
- Transition glissée 240 ms

### 6.7 Bouton "Refresh maintenant"

Button primaire :
- Hauteur 36 px
- Padding `space-3 space-4`
- Background `--insights-text-primary`
- Couleur texte blanc
- Icône optionnelle ⟳ 14 px à gauche
- État `loading` : spinner blanc + label "Calcul en cours…", désactivé

### 6.8 Lien "Voir les 10 derniers runs"

Lien text-only :
- `text-xs`, 500, secondary, underline
- Click → drawer historique runs (V2)

### 6.9 Animation panel expanded

```
@keyframes slide-down {
  0%   { opacity: 0; transform: translateY(-8px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

---

## 7. Tabs

### 7.1 Anatomie

```
┌──────────────────────────────────────────────────────────────────┐
│  Overview   Pages   Composants   Sections   Funnel                │
│  ─────────                                                        │
└──────────────────────────────────────────────────────────────────┘
```

- 5 onglets en ligne, chacun :
  - Padding `space-2 space-4`
  - `text-sm`, 500
  - Encre par défaut, `--insights-text-primary` quand actif
  - Bottom-border 2 px `--insights-text-primary` quand actif (animée)
- Hairline bottom complète au niveau de la barre

**Animation underline** : translateX + scaleX en 240 ms ease-out
quand on change d'onglet.

### 7.2 Pattern ARIA

Repris du module GTM (déjà éprouvé) :
- Container `role="tablist"` direct sans `<ul>`
- `role="tab"` + `aria-selected` + `aria-controls={panelId}`
- `tabIndex` 0 si actif, -1 sinon
- Flèches ←/→ pour naviguer
- `id` généré via `useId().replace(/[^a-zA-Z0-9-]/g, '')`

### 7.3 Mobile (< 768 px)

Bascule en menu déroulant compact :

```
┌────────────────────────────────┐
│ Onglet : Overview ▾             │
└────────────────────────────────┘
```

Tap → bottom sheet liste des 5 onglets.

---

## 8. KPI cards

### 8.1 Anatomie d'une KPI Card

```
┌─────────────────────────────────────────┐
│ TOTAL EVENTS                             │   ← label uppercase, 11px
│                                          │
│ 12 437                                   │   ← value, 28px tabular
│                                          │
│ ↗ +14 %  vs 7 jours préc.                │   ← variation 12px tabular
└─────────────────────────────────────────┘
   ↑                                        ↑
   16px padding                              16px padding
```

**Mesures** :
- Hauteur fixe : 120 px
- Padding `space-4 space-5`
- Background `--insights-card-bg`
- Hairline 1 px
- Border-radius 8 px

### 8.2 Hiérarchie typographique

| Élément        | Tokens                                                            |
| -------------- | ----------------------------------------------------------------- |
| Label          | `text-xs`, 500, uppercase, letterspacing 0.06em, secondary         |
| Value          | `text-2xl`, 600, tabular, encre                                    |
| Variation      | `text-sm`, 500, tabular, signal                                     |
| "vs 7 jours…"  | `text-xs`, 400, tertiary                                            |

### 8.3 Variation — sémantique des couleurs

| Variation     | Métrique souhaitable          | Couleur                       | Glyphe |
| ------------- | ----------------------------- | ----------------------------- | ------ |
| > 0           | events / sessions / conv.     | `--insights-signal-positive`  | ↗      |
| < 0           | events / sessions / conv.     | `--insights-signal-negative`  | ↘      |
| > 0           | bounce / drop-off              | `--insights-signal-negative`  | ↗      |
| < 0           | bounce / drop-off              | `--insights-signal-positive`  | ↘      |
| = 0           | toutes                         | `--insights-signal-neutral`   | →      |
| undefined     | (1ère période)                  | masqué                        | —      |

### 8.4 Variantes

- **Compact** (40 px hauteur réduite, value `text-xl`) : pour bandeau Funnel
- **Featured** (hauteur 140 px, hairline champagne) : pour KPI primaire
- **Loading** : skeleton — 3 barres grises shimmer
- **Empty** : value en `--`, variation masquée
- **Stack** (deux valeurs) : value principale + sub-value 14 px

### 8.5 Bandeau de KPI cards

6 cartes alignées horizontalement, gap `space-4`, distribution
`grid-cols-6` desktop / `grid-cols-3` tablet / `grid-cols-2` mobile.

### 8.6 Animation count-up

- Durée : 600 ms
- Easing : `ease-out cubic`
- Steps : 30 (50 fps)
- Reduced motion : skip → afficher la valeur finale

---

## 9. Charts — anatomies détaillées

### 9.1 Time-series — `<EventsTimeSeries>`

#### 9.1.1 Anatomie

```
┌─────────────────────────────────────────────────────────────┐
│ Évolution sur 7 derniers jours       Events · Sess · Conv ⓘ │
│                                                              │
│  2 000 ┤                                                      │
│        ┤   ╭─╮                                                │
│  1 500 ┤  ╱   ╲     ╭─╮                                       │
│        ┤ ╱     ╲   ╱   ╲                                      │
│  1 000 ┤╱       ╲_╱     ╲___                                  │
│        ┤_______________________ Sessions ___________________  │
│    500 ┤_______________________ Conversions _________________ │
│        ┤                                                      │
│      0 ┤───────────────────────────────────────────────────── │
│        Lun     Mar     Mer     Jeu     Ven     Sam     Dim    │
└─────────────────────────────────────────────────────────────┘
```

#### 9.1.2 Mesures

| Élément              | Valeur                                    |
| -------------------- | ----------------------------------------- |
| Hauteur viewBox      | 320                                        |
| Largeur viewBox      | 800 (scale via CSS width 100 %)            |
| Margin top           | 16                                         |
| Margin right         | 16                                         |
| Margin bottom        | 36 (espace pour les labels X)              |
| Margin left          | 48 (espace pour les valeurs Y)             |
| Stroke ligne         | 1.5 px                                     |
| Stroke axes          | 1 px hairline                              |
| Grid lines           | dashed 0.5 px hairline (5 ticks)           |

#### 9.1.3 Séries

3 séries superposées :
1. **events** — `--insights-series-1` (encre), 1.5 px
2. **sessions** — `--insights-series-2` (sauge), 1.5 px
3. **conversions** — `--insights-series-3` (champagne), 1.5 px

**Aire sous la ligne** : optionnel, opacité 0.08, dégradé top-down.

#### 9.1.4 Points

Cercles aux dates :
- Rayon 0 par défaut (pas visibles)
- Rayon 4 px au hover (tween 120 ms)
- Stroke 2 px white, fill series

#### 9.1.5 Tooltip au hover (V1.1, V1 = `<title>` natif)

Vertical line traversant l'axe Y au hover, +bulle :

```
       │  Vendredi 02 mai
       │  Events       1 950
       │  Sessions       520
       │  Conversions      7
       │
```

Tooltip ancré à droite ou gauche selon position du curseur,
offset 12 px.

#### 9.1.6 Légende

Au-dessus à droite, 3 chips horizontaux :

```
[●] Events  [●] Sessions  [●] Conversions
```

- Bullet 8 × 8 px de la couleur de la série
- Click sur un chip → toggle la série (opacité 0.2 si désactivée)

#### 9.1.7 États

- **vide** : `<EmptyState>` "Aucune donnée pour cette fenêtre."
- **1 point** : afficher juste un cercle, pas de path
- **30 points** : path normal
- **60 points** : path + tick X tous les 5 jours
- **365 points** : path + tick X mensuels

### 9.2 Heatmap — `<ActivityHeatmap>`

#### 9.2.1 Anatomie

```
        00 01 02 03 04 ··· 22 23
   Lun  ░  ░  ░  ░  ░  ▓  ▓  ░    ← ligne par jour
   Mar  ░  ░  ░  ░  ░  ▓  █  ░
   Mer  ░  ▒  ▓  ▓  █  ▓  ▒  ░
   Jeu  ░  ▓  ▓  ▓  █  ▓  ▒  ░
   Ven  ░  ▓  ▓  █  ▓  ▓  ▒  ░
   Sam  ▒  ▓  ▓  █  ▓  ▓  ▒  ▒
   Dim  ▒  ▒  ▓  ▓  ▒  ░  ░  ░

   Faible ░░░ ▒▒▒ ▓▓▓ ███ Élevé   ← légende dégradée
```

#### 9.2.2 Mesures

| Élément          | Valeur                          |
| ---------------- | ------------------------------- |
| Cell width       | 16 px                           |
| Cell height      | 22 px                           |
| Gap entre cells  | 2 px                            |
| Y-label width    | 36 px (Lun, Mar…)                |
| X-label height   | 18 px                            |
| Total width      | 36 + 24 × (16 + 2) = 468 px       |
| Total height     | 18 + 7 × (22 + 2) = 186 px        |

#### 9.2.3 Couleurs

Gradient unique sauge :
- Min (count = 0) : `--insights-heat-min` (`#F0F4ED`)
- Max (count = max global) : `--insights-heat-max` (`#5A7A58`)
- Interpolation linéaire (en lab si possible, sinon RGB)

#### 9.2.4 Tooltip natif `<title>` enfant

```
Lundi 14 h · 327 events
```

Format : `<JOUR> <HEURE> h · <COUNT> events`

#### 9.2.5 Hover

Cell hover :
- Outline 1.5 px `--insights-text-primary`
- Légère élévation translation (-1 px Y)

#### 9.2.6 États

- **vide** : afficher quand même la grille avec opacité 0.05 partout + libellé "Pas d'activité enregistrée"
- **un seul cluster d'heures** : ne pas changer le rendu, le gradient s'étire naturellement

### 9.3 Top events — `<TopEventsTable>`

Cf. §10 pour le pattern table générique.

Colonnes :
| # | Event           | Volume | %     | Δ 7j  | Conv. |
| - | --------------- | ------ | ----- | ----- | ----- |
|   | bulle event     | 4 320  | 35 %  | ↗ +12 | non    |

- Bulle event : pill `--insights-card-bg-subtle` avec event_name en
  monospace 12 px
- Δ 7j : signal couleur
- Conv. : badge "oui" en champagne ou "non" en muted

### 9.4 Treemap — `<PagesTreemap>`

#### 9.4.1 Anatomie

```
┌──────────────────────────────────┬──────────────┐
│   /                                │  /kit        │
│   8 240 PV                          │  3 410 PV   │
│                                    │              │
│                                    ├──────────────┤
│                                    │  /journal    │
│                                    │  1 220 PV   │
├──────────────────────────────────┴──────────────┤
│   /panier        │   /commander    │  /maison    │
│   890 PV          │   540 PV       │  410 PV    │
└──────────────────────────────────────────────────┘
```

#### 9.4.2 Algorithme de layout

Squarified treemap (algorithme Bruls) :
1. Trier les pages par volume desc
2. Splitter en lignes en minimisant le ratio max/min
3. Garde un aspect ratio < 2 par cellule autant que possible

#### 9.4.3 Cellule

```
┌─ rectangle, fill = engagement gradient ─┐
│  /kit                                    │   ← page route, 13px 600
│  3 410 PV · 67 % engagement              │   ← meta 11px secondary
│                                          │
└──────────────────────────────────────────┘
```

**Couleur** : opacité du fond proportionnelle à l'engagement (scroll_75/page_views).
- 0 % engagement : fond `--insights-heat-min`
- 80 %+ engagement : fond `--insights-heat-max`

**Petites cellules** (< 80 px²) : afficher juste la route, masquer la meta.

#### 9.4.4 Hover

- Stroke 2 px `--insights-text-primary` autour de la cellule
- Tooltip native `<title>` : "/kit · 3 410 visites · 67 % engagement · 31 conversions"

#### 9.4.5 Click

Ouvre `<PageDetailDrawer>`.

### 9.5 Sankey funnel — `<FunnelSankey>`

#### 9.5.1 Anatomie

```
view_item   ━━━━━━━━━━━━━━━━━━━━  12 400  (100 %)
                  ╲_______________________
                                          ╲ 7 600 perdus
add_to_cart  ━━━━━━━━━━━━━━━  4 800  (38.7 %)
                  ╲_______________________
                                          ╲ 2 700 perdus
begin_checkout  ━━━━━━━  2 100  (43.7 %)
                  ╲_______________________
                                          ╲ 520 perdus
add_payment_info  ━━━━━━ 1 580  (75.2 %)
                  ╲_______________________
                                          ╲ 340 perdus
purchase  ━━━━ 1 240  (78.5 %)
```

#### 9.5.2 Mesures

| Élément                       | Valeur                          |
| ----------------------------- | ------------------------------- |
| Hauteur viewBox               | 360                              |
| Largeur viewBox               | 800                              |
| Largeur stage band             | proportionnelle au volume        |
| Hauteur stage                  | 40 px                             |
| Gap inter-stage                | 32 px                             |
| Largeur drop-off label         | 80 px                             |

#### 9.5.3 Bandes

- Stage band : rectangle plein, fill `--insights-series-3` (champagne)
- Drop-off band : trapèze gris translucide qui descend vers la
  droite, fill `--insights-text-tertiary` opacité 0.2

#### 9.5.4 Labels par étape

```
purchase ━━━━ 1 240 (78.5 %)
       ↑       ↑       ↑
       nom    volume   conversion vs précédente
```

- Nom : monospace 12 px secondary
- Volume : tabular 13 px 600 encre
- Conversion : `text-xs` 500 secondary
- Drop-off : "↘ -340 perdus" `text-xs` 500 `--insights-signal-negative`

#### 9.5.5 Animation

Stages dessinés successivement, chacun en 200 ms ease-out, total
5 × 200 = 1000 ms à l'arrivée. Reduced-motion : tout afficher
instantanément.

### 9.6 Bar chart horizontal — `<SectionsBarChart>`

#### 9.6.1 Anatomie

```
section-rituel        ████████████████████  4m 32s
section-kit-detail    ███████████████        3m 18s
section-journal-extr. ████████████           2m 24s
section-temoignages   █████                   1m 12s
section-faq           ███                       38s
section-newsletter    ██                        22s
```

#### 9.6.2 Mesures

| Élément              | Valeur                          |
| -------------------- | ------------------------------- |
| Bar height           | 24 px                            |
| Gap between bars     | 8 px                             |
| Label width          | 200 px (max-width tronquée…)     |
| Value width          | 80 px                            |
| Bar fill             | `--insights-series-2` (sauge)    |
| Bar bg               | `--insights-card-bg-subtle`      |

#### 9.6.3 Tri

- Default : durée desc
- Click sur header (V2) : tri par sessions

### 9.7 Mini line — `<SparklineCell>`

Pour les cellules de tableau (mini évolution sur 7j) :
- Largeur 80 px
- Hauteur 24 px
- Stroke 1 px `--insights-series-2`
- Pas de label, juste la forme

### 9.8 Donut compact — `<DistributionRing>`

Pour distributions device / locale / source :

#### 9.8.1 Anatomie

```
       ╭─────╮
      ╱       ╲          Mobile      62 %  ████
     │   62%   │          Desktop     31 %  ██
      ╲       ╱           Tablet       6 %  ▏
       ╰─────╯           Inconnu      1 %  ▏
```

#### 9.8.2 Mesures

- Donut radius : outer 64 px, inner 48 px
- Légende à droite avec 4 entrées max (autres groupés en "Autres")
- Couleurs par défaut : sauge / champagne / encre / muted

### 9.9 Distribution bar — `<DistributionBar>`

Variante linéaire d'une donut, plus compacte (pour mobile) :

```
█████████████████  ████████  ▏  Mobile 62 % · Desktop 31 % · Tablet 6 %
```

Une barre 100 % de large, segmentée par couleur.

---

## 10. Tables

### 10.1 Anatomie générique `<TopTable>`

```
┌─ Header de table ─────────────────────────────────────────────┐
│ Top 30 pages        [Tri: par visites ▾]      [Exporter CSV]   │
└─────────────────────────────────────────────────────────────────┘
┌─ Tableau ─────────────────────────────────────────────────────┐
│ ROUTE        │ VISITES │ SESS  │ ENGMT │ CONV │ BOUNCE │   ⌗   │
├──────────────┼─────────┼───────┼───────┼──────┼────────┼───────┤
│ /            │  8 240  │ 5 100 │ 42 %  │  12  │ 38 %   │  →    │
│ /kit         │  3 410  │ 2 800 │ 67 %  │  31  │ 22 %   │  →    │
│ /journal/…   │  1 220  │   940 │ 58 %  │   4  │ 31 %   │  →    │
│ …                                                                │
└─────────────────────────────────────────────────────────────────┘
┌─ Footer ──────────────────────────────────────────────────────┐
│ 30 sur 240 lignes · [Voir tout]                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Mesures

| Élément                | Valeur                                |
| ---------------------- | ------------------------------------- |
| Row height             | 44 px                                  |
| Header height          | 32 px                                  |
| Cell padding           | `space-3 space-4`                       |
| Hairline entre rows    | 1 px `--insights-hairline`              |
| Row hover bg           | `--insights-card-bg-subtle`             |
| Row clickable cursor   | pointer, padding-right `space-2`         |
| Last column (chevron)  | 24 px width, centré                     |

### 10.3 Header

- `text-xs`, 600, uppercase, secondary
- Cliquable si triable (curseur pointer + caret indicator ▲ / ▼)
- Indicateur de tri actif : caret en `--insights-text-primary`
- Caret inactive : muted

### 10.4 Cellules

- Texte cellule : `text-base`, 400, encre
- Cellule numérique : tabular nums, alignée à droite
- Cellule pourcent : tabular nums, alignée à droite, suffixe " %" (espace insécable)
- Cellule pill (badge, tag) : pill 4 px radius, padding `space-1 space-2`
- Cellule sparkline : 80 × 24 px, padding bottom 8 px

### 10.5 Tri

- Click header → tri asc/desc/none cyclique
- Persistance dans l'URL (`?sort=pageViews&dir=desc`)
- Animation : pas de ré-ordonnancement animé V1 (snap). V2 : FLIP.

### 10.6 Pagination

- Default : afficher 30 lignes, footer "30 sur N · [Voir tout]"
- Voir tout : déplie jusqu'à 100 lignes
- Au-delà : virtualisation (V2, react-virtuoso)

### 10.7 Variantes de table

- **`<DenseTable>`** : row height 36 px, cell padding `space-2 space-3` — pour funnel drop-offs, runs history
- **`<TableWithSparkline>`** : ajoute une colonne 80 px sparkline
- **`<TableWithBadgePill>`** : ajoute une colonne avec une pill colorée (status, conversion)
- **`<TableWithTrendArrow>`** : ajoute une colonne signal "↗ +12 %"

### 10.8 États

- **loading** : 5 rows skeleton shimmer
- **empty** : message inline `<EmptyState>` "Aucune donnée pour cette fenêtre."
- **1 row** : affichage normal sans pagination
- **error** : message inline rouge sobre + bouton "Réessayer"

### 10.9 Click sur ligne

- Pour pages / composants : ouvre `<DetailDrawer>`
- Cursor pointer + chevron `→` en dernière colonne
- Hover : background subtle + chevron `→` en encre

### 10.10 Export CSV inline

Bouton text dans le header `[Exporter CSV]` :
- `text-xs` 500 secondary
- Hover : underline
- Click : POST à l'API export, reçoit le fichier

---

## 11. Drawers de drill-down

### 11.1 Anatomie générique `<DetailDrawer>`

```
┌──────────────────────────────────────────────────────────────────┐
│                                              ← overlay 32 % opacity│
│                                                                    │
│                                                                    │
│                  ┌─ Drawer (slide right) ─────────────────────────┐│
│                  │                                                  ││
│                  │ ← Retour                          ✕ Fermer      ││
│                  │                                                  ││
│                  │ Page                                              ││
│                  │ /kit                                              ││
│                  │ 3 410 visites · 67 % engagement                   ││
│                  │ ──────────────────────────────────────────────── ││
│                  │                                                  ││
│                  │ ┌─ KPI mini ──────┬─────────────┬─────────────┐  ││
│                  │ │ Visites         │ Sessions    │ Conversions │  ││
│                  │ │ 3 410           │ 2 800       │ 31           │  ││
│                  │ └─────────────────┴─────────────┴─────────────┘  ││
│                  │                                                  ││
│                  │ Évolution 7j (mini line)                         ││
│                  │ ╱╲___╱╲___                                       ││
│                  │                                                  ││
│                  │ Top events sur cette page                        ││
│                  │ ┌──────────────────────────────────────────┐    ││
│                  │ │ Event              Volume    %             │    ││
│                  │ │ page_view          3 410     100 %         │    ││
│                  │ │ cta-recevoir-rit.  1 800      53 %         │    ││
│                  │ │ scroll_depth         820      24 %         │    ││
│                  │ │ chat_widget_open     610      18 %         │    ││
│                  │ │ …                                          │    ││
│                  │ └──────────────────────────────────────────┘    ││
│                  │                                                  ││
│                  │ Composants déclencheurs (3)                       ││
│                  │ ┌──────────────────────────────────────────┐    ││
│                  │ │ • cta-recevoir-rituel  ················ │    ││
│                  │ │ • kit-image-galerie    ················ │    ││
│                  │ │ • kit-faq-accordeon    ················ │    ││
│                  │ └──────────────────────────────────────────┘    ││
│                  │                                                  ││
│                  │ ──────────────────────────────────────────────  ││
│                  │ [Voir conversions de cette page]                  ││
│                  │ [Exporter CSV]                                    ││
│                  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### 11.2 Mesures

| Élément              | Valeur                                |
| -------------------- | ------------------------------------- |
| Drawer width         | 480 px desktop / 100 % mobile          |
| Padding              | `space-6` desktop / `space-4` mobile   |
| Hauteur              | 100 vh                                  |
| Background           | `--insights-card-bg`                    |
| Shadow               | `--insights-shadow-modal`               |
| Animation slide      | translateX 100 % → 0 en 320 ms ease-out |
| Overlay              | `--insights-overlay-bg`, fade 240 ms     |

### 11.3 Header du drawer

```
← Retour                          ✕ Fermer
Page                                       ← kicker, 11px uppercase
/kit                                       ← title, text-xl 600
3 410 visites · 67 % engagement            ← meta, text-sm secondary
```

- Retour : visible si on a un parent contextuel, sinon masqué
- Fermer : icône 20 × 20 px, encre
- Padding sticky top du drawer

### 11.4 Sections du body

Chaque section :
- `<SectionHeader>` (text-md 600 + meta optionnel)
- Hairline ou margin space-6
- Content de la section (table, chart, list)

### 11.5 Footer du drawer

```
─────────────────────
[Action primaire]                        ← button principal
[Exporter CSV]  [Voir tout]              ← actions secondaires
```

- Sticky bottom
- Background `--insights-card-bg-subtle`
- Padding `space-4 space-6`

### 11.6 Variantes

- **`<PageDetailDrawer>`** — pour une page
- **`<ComponentDetailDrawer>`** — pour un composant
- **`<SectionDetailDrawer>`** — pour une section (V2)
- **`<RunDetailDrawer>`** — pour un run de refresh (V2)

### 11.7 Comportement clavier

- `Esc` ferme le drawer
- Focus trap : tab ne sort pas du drawer
- Focus initial : sur le bouton "Fermer"
- Restauration du focus à l'élément déclencheur

---

## 12. États transverses

### 12.1 Empty state

```
┌─────────────────────────────────────────────┐
│                                             │
│         ╭───────────╮                        │
│         │  visuel   │   ← icône 64 × 64 px   │
│         ╰───────────╯                        │
│                                             │
│         Aucune donnée pour cette            │
│         fenêtre.                             │
│                                             │
│         La maison observe en silence.       │
│         Étend la période pour voir          │
│         plus loin.                           │
│                                             │
│         [Étendre à 30 jours]                 │
│                                             │
└─────────────────────────────────────────────┘
```

**Mesures** :
- Hauteur min 240 px
- Centré horizontalement
- Padding `space-8`
- Visuel : illustration sobre (cercle vide, point de fuite)
- Title : `text-lg` Fraunces 500
- Body : `text-sm` 400 secondary
- CTA : button secondary

**Variantes** :
- **Window vide** : "Étend la période"
- **Filtre trop strict** : "Relâche les filtres"
- **First run** : "Premier calcul en cours…"
- **Erreur** : "Une erreur est survenue. Réessayer ?"

### 12.2 Loading state

#### 12.2.1 Skeleton shimmer

- Background : `--insights-loading-pulse` (`#F2F1ED`)
- Animation : pulse opacity 0.6 → 1 → 0.6 en 1.4 s loop
- Forme : rectangles ou pills aux dimensions du contenu final

#### 12.2.2 Skeleton KPI Card

```
┌─────────────────────┐
│ ▒▒▒▒▒▒▒▒▒          │   ← label skeleton
│                      │
│ ▒▒▒▒▒▒              │   ← value skeleton
│                      │
│ ▒▒▒▒▒▒▒▒▒▒          │   ← variation skeleton
└─────────────────────┘
```

#### 12.2.3 Skeleton table

```
┌─────────────────────────────────────────────┐
│ ▒▒▒▒▒  ▒▒▒▒  ▒▒▒  ▒▒▒  ▒▒▒  ▒▒▒              │
├─────────────────────────────────────────────┤
│ ▒▒▒▒▒▒▒▒▒▒  ▒▒▒▒▒  ▒▒▒  ▒▒▒  ▒▒▒  ▒▒▒        │
│ ▒▒▒▒▒▒▒▒  ▒▒▒▒▒  ▒▒▒  ▒▒▒  ▒▒▒  ▒▒▒          │
│ ▒▒▒▒▒▒▒▒▒▒  ▒▒▒▒▒  ▒▒▒  ▒▒▒  ▒▒▒  ▒▒▒        │
│ …                                            │
└─────────────────────────────────────────────┘
```

5 rows, hauteurs identiques au final.

#### 12.2.4 Skeleton chart

Pour time-series / heatmap :
- Rectangle aux dimensions du chart
- Pulse loop
- Pas de courbe simulée (clean)

### 12.3 Error state inline

```
┌─ Bannière dans la card ─────────────────────────────────┐
│ ⚠  Impossible de charger ces données.                     │
│    [Détails ▾]                          [Réessayer]       │
└─────────────────────────────────────────────────────────────┘
```

- Background `#FBEFEE` (pétale très diluée)
- Hairline `--insights-signal-negative`
- Icône 16 × 16 px
- Détails repliable affichant `error.code` + `error.message`

### 12.4 First run state

Similaire à Empty mais avec animation :

```
┌─────────────────────────────────────────────┐
│                                             │
│         ⏳  (icône animée 32 px)              │
│                                             │
│         Premier calcul en cours              │
│                                             │
│         La maison agrège tes événements      │
│         pour la première fois.               │
│         Cela peut prendre quelques minutes.  │
│                                             │
│         [Rafraîchir maintenant]              │
│         Auto-refresh dans 47 sec             │
│                                             │
└─────────────────────────────────────────────┘
```

- Polling toutes les 30 s pour vérifier si run terminé
- Auto-refresh countdown affiché
- Reduced-motion : icône statique

### 12.5 Stale data warning

Si `refreshedAt` > 24 h :

```
┌──────────────────────────────────────────────────────────────┐
│ ⓘ Les données affichées datent de plus de 24 h               │
│    [Rafraîchir maintenant]                                   │
└──────────────────────────────────────────────────────────────┘
```

- Bannière sticky en haut de la page
- Background `#FCF6E8` (jaune doux)
- Hairline `--insights-signal-warning`

---

## 13. Micro-animations

### 13.1 Inventaire

| Élément                | Animation                                  | Durée    | Easing          |
| ---------------------- | ------------------------------------------ | -------- | --------------- |
| KPI count-up           | nombres défilent                            | 600 ms   | ease-out        |
| Time-series draw       | path stroke-dasharray révélation            | 400 ms   | ease-out        |
| Bar chart grow         | scaleY 0→1 par bar                           | 240 ms   | ease-out        |
| Treemap fade-in        | opacity 0→1 par cellule                       | 200 ms   | ease-out        |
| Sankey flow            | bandes dessinées séquentiellement            | 1000 ms  | ease-out        |
| Heatmap reveal          | opacity sur la grille                         | 240 ms   | ease-out        |
| Tab change underline    | translateX + scaleX                           | 240 ms   | ease-out        |
| Filter pill toggle      | bg fade                                       | 120 ms   | ease-out        |
| Drawer slide            | translateX 100%→0                              | 320 ms   | ease-out        |
| Drawer overlay fade      | opacity 0→0.32                                  | 240 ms   | ease-out        |
| Modal export            | scale 0.96→1 + fade                            | 240 ms   | ease-out        |
| Tooltip fade            | opacity 0→1                                    | 120 ms   | ease-out        |
| Refresh button click    | spinner fade-in + label change                  | 120 ms   | linear          |
| Empty state             | fade-in                                        | 240 ms   | ease-out        |
| Skeleton pulse          | opacity 0.6→1→0.6                                | 1400 ms  | ease-in-out loop |
| Toast slide              | translateY 16px→0 + fade                        | 240 ms   | ease-out        |
| Variation arrow change   | rotate 180° si changement de signe              | 240 ms   | ease-out        |

### 13.2 Reduced motion

Si `prefers-reduced-motion: reduce` :
- Toutes les animations de revealment passent en instant
- Skeleton pulse → opacité 0.85 statique
- Drawer slide → fade in 120 ms
- Count-up → afficher la valeur finale directement

### 13.3 Pattern de revealment progressive

Quand un dashboard charge, les éléments apparaissent dans l'ordre :
1. Filters bar (already there)
2. Tabs (already there)
3. KPI cards (stagger 80 ms entre chaque)
4. Charts (au fur et à mesure que data arrive)

Stagger animation interdit en reduced-motion.

---

## 14. Voix éditoriale

### 14.1 Tonalité

> **Une marque qui sait. Une console qui informe.**

- **Tutoiement** maison, déjà en place ailleurs
- **Phrases courtes**. Pas de pédagogie.
- **Pas de jargon technique** côté label utilisateur ("page vue" plutôt que "pageview")
- **Mais on garde l'anglais courant** quand il est plus précis : KPI, funnel, drop-off, conversion
- **Pas d'emoji**. Les icônes sont monochromes encre.
- **Empty states éditoriaux** : on s'autorise une touche de poésie sobre ("La maison observe en silence")

### 14.2 Vocabulaire

| Concept               | Terme retenu                          | À éviter                  |
| --------------------- | ------------------------------------- | ------------------------- |
| `page_view`           | Visites de page                        | Pageviews                  |
| `unique_sessions`     | Sessions uniques                        | Visiteurs uniques          |
| `unique_visitors`     | Visiteurs                                | Users                      |
| `session_id`          | (pas exposé en UI)                       | —                          |
| `bounce_rate`         | Taux de rebond                            | Bounce                     |
| `scroll_depth`        | Profondeur de défilement                  | Scroll depth                |
| `add_to_cart`         | Ajout au panier                            | ATC                         |
| `begin_checkout`      | Début de commande                          | Checkout                    |
| `purchase`            | Achat                                       | Purchase                    |
| `engagement`          | Engagement                                  | Engagement profond          |
| `dwell time`          | Durée d'attention                            | Dwell                        |
| `dead component`      | Composant silencieux                          | Composant mort              |
| `refresh`             | Actualisation                                | Refresh (mais OK en label)  |
| `cron`                | Auto                                          | Cron                        |
| `traffic source`      | Source de trafic                              | Source                       |
| `funnel`              | Tunnel                                          | Entonnoir                    |

### 14.3 Format des chiffres

- Milliers séparés par espace insécable : `12 437`
- Décimales : virgule française : `3,87`
- Pourcentages : `14 %` (avec espace insécable)
- Devises : `1 240 MAD` (devise après, espace insécable)
- Durées :
  - < 60 s : `42 s`
  - < 60 min : `4 m 32 s`
  - ≥ 1 h : `1 h 24 m`
- Dates : `02 mai 2026` (jour mois année)
- Date short : `02/05` (jour/mois)

### 14.4 Messages clés

| Cas                                  | Message UX                                                  |
| ------------------------------------ | ----------------------------------------------------------- |
| Empty state generic                   | "Aucune donnée pour cette fenêtre."                         |
| Empty state filter trop strict        | "Tes filtres écartent toutes les données."                  |
| First run                             | "Premier calcul en cours."                                   |
| Refresh in progress                   | "Calcul en cours…"                                           |
| Refresh failed                        | "Le dernier refresh a échoué."                               |
| Refresh disabled                      | "Refresh manuel uniquement."                                  |
| Data > 24h stale                      | "Les données datent de plus de 24 h."                        |
| Window > 365 j                        | "Limite à 365 j atteinte."                                   |
| Export en cours                       | "Génération du fichier CSV…"                                  |
| Export trop gros                      | "Trop de lignes (max 100 000). Réduis la fenêtre."             |
| Erreur serveur                        | "Impossible de charger ces données."                           |
| Confirmation toggle off               | "Refresh auto désactivé. Le bouton manuel reste actif."         |
| Refresh manuel succès                  | "Données actualisées."                                          |

---

## 15. A11y

### 15.1 Niveau cible

WCAG 2.2 AA strict. Pas de violations axe sur les composants critiques.

### 15.2 Contrastes

Tous les couples (texte / fond) sont vérifiés :

| Texte                   | Fond                       | Ratio minimum |
| ----------------------- | -------------------------- | ------------- |
| `--insights-text-primary` | `--insights-card-bg`         | ≥ 12 (largement OK) |
| `--insights-text-secondary` | `--insights-card-bg`        | ≥ 4.5             |
| `--insights-text-tertiary` | `--insights-card-bg`         | ≥ 3 (text > 14 px seulement) |
| `--insights-signal-positive` | `--insights-card-bg`         | ≥ 4.5             |
| `--insights-signal-negative` | `--insights-card-bg`         | ≥ 4.5             |
| Texte sur `--insights-text-primary` (button) | `#FFFFFF`     | ≥ 12              |

### 15.3 Focus

- Outline 2 px `--insights-focus-ring` avec offset 2 px
- Jamais `outline: none` sans alternative visible
- Focus ring rond pour boutons icônes (border-radius pill)

### 15.4 Tableaux

- `<th scope="col">` pour les headers de colonne
- `<th scope="row">` (route, component_id) si pertinent
- `<caption>` pour la table (visuellement caché si redondant avec le header)
- Tri annoncé via `aria-sort`

### 15.5 Tabs

Cf. §7.2.

### 15.6 Charts

- `<svg role="img">` + `aria-label="Description du chart"`
- `<title>` enfant pour les screen readers
- `<desc>` enfant pour des descriptions plus longues si nécessaire
- Tooltips natifs `<title>` sur les éléments interactifs

### 15.7 Drawers / modals

- `role="dialog"` + `aria-modal="true"`
- `aria-labelledby` pointe vers le titre
- Focus trap
- Esc pour fermer
- Restauration du focus

### 15.8 Empty / error states

- `role="status"` (empty)
- `role="alert"` (error)
- Live region pour les changements importants (refresh terminé)

### 15.9 Live regions

- Toast notifications : `aria-live="polite"`
- Refresh status updates : `aria-live="polite"`

### 15.10 Composants forms

- `<label>` associé à chaque control
- `aria-describedby` pour les hints / erreurs inline
- Required state via `aria-required` (pas `*` seul)

---

## 16. Responsive — règles strictes

### 16.1 Breakpoints

```
< 640 px        : mobile portrait (priorité absolue)
640 — 768 px    : mobile landscape / large phone
768 — 1024 px   : tablet
1024 — 1280 px  : laptop
≥ 1280 px       : desktop
```

### 16.2 Page header

| Élément              | < 640 px                     | ≥ 640 px                    |
| -------------------- | ----------------------------- | --------------------------- |
| H1                   | text-lg                       | text-xl                     |
| RefreshIndicator     | bouton compact + popover full | inline avec dropdown        |

### 16.3 Filters bar

| < 640 px                                    | ≥ 640 px                                   |
| ------------------------------------------- | ------------------------------------------ |
| Bottom sheet "Filtres" + button trigger      | inline, full-width                          |
| Affiche 1-2 chips actifs résumés              | tous les chips visibles                     |

### 16.4 KPI cards

| Breakpoint  | Colonnes |
| ----------- | -------- |
| < 640 px    | 2        |
| 640-1024    | 3        |
| 1024-1280   | 4 ou 6 selon hauteur |
| ≥ 1280 px   | 6        |

### 16.5 Charts

| Élément              | < 640 px                        | ≥ 640 px                  |
| -------------------- | ------------------------------- | ------------------------- |
| Time-series          | hauteur 200 px, 2 séries max     | hauteur 320 px, 3 séries  |
| Heatmap              | scrollable horizontalement      | full-width                 |
| Treemap              | hauteur 240 px                    | hauteur 360 px             |
| Sankey               | vertical orientation V2         | horizontal                 |

### 16.6 Tables

| < 640 px                                          | ≥ 640 px            |
| ------------------------------------------------- | ------------------- |
| Cards-list (chaque row → carte)                    | Tableau classique   |
| 2-3 colonnes max                                   | toutes les colonnes |
| Actions : tap on row → drawer                       | click on row → drawer |

### 16.7 Drawers

| < 640 px                              | ≥ 640 px                    |
| ------------------------------------- | --------------------------- |
| Bottom sheet (slide bottom-up)         | Slide right, 480 px width   |
| Hauteur 90 vh                          | Hauteur 100 vh              |

### 16.8 Tabs

| < 640 px                              | ≥ 640 px                    |
| ------------------------------------- | --------------------------- |
| Select dropdown "Onglet : Overview ▾" | Tabs horizontales            |

---

## 17. Patterns d'erreurs UI

### 17.1 Erreur réseau (timeout, 5xx)

- Bannière inline dans la card concernée
- Bouton "Réessayer" qui re-fetch
- Pas de toast (sauf si action utilisateur explicite)

### 17.2 Erreur de validation (filtre)

- Message inline sous le filtre
- Texte : "Date invalide" / "Période trop large"
- Couleur : `--insights-signal-negative`
- Pas de blocage de la navigation

### 17.3 Erreur d'autorisation (403)

- Card vidée avec message "Tu n'as pas accès à cette vue."
- Pas de stack trace
- Lien support si pertinent

### 17.4 Erreur catastrophique (crash JS)

- Error boundary autour de chaque panel
- Fallback : "Cette section n'a pas pu être chargée."
- Bouton "Recharger la page"

### 17.5 Erreur d'export

- Si > 100k lignes : modal "Trop de lignes" + suggestion réduire fenêtre
- Si erreur serveur : toast "Génération échouée" + bouton "Réessayer"

### 17.6 Erreur de refresh

- Bannière en haut de page (pas card)
- Texte : "Le dernier refresh a échoué (il y a X min)"
- Détails repliables avec error message
- Bouton "Réessayer"

---

## 18. Index visuel des dashboards

### 18.1 Dashboard Overview — vue détaillée

#### 18.1.1 Bandeau KPI (Row 1)

6 cartes, hauteur 120 px, gap 16 px.

| # | KPI                  | Format         | Variation comparée à        |
| - | -------------------- | -------------- | --------------------------- |
| 1 | Total events         | `12 437`        | période précédente même durée |
| 2 | Sessions uniques     | `3 210`         | période précédente            |
| 3 | Visites de page      | `8 940`         | période précédente            |
| 4 | Conversions          | `42`            | période précédente            |
| 5 | Events / session     | `3,9`           | période précédente            |
| 6 | Taux de rebond       | `31,2 %`        | période précédente            |

#### 18.1.2 Time-series principale (Row 2)

`<EventsTimeSeries>` 320 px hauteur, full-width.

3 séries : Events / Sessions / Conversions.
Légende toggleable.
Period comparison overlay (V2) : courbe pointillée période précédente.

#### 18.1.3 Heatmap + Top events (Row 3)

| Col 7      | Col 5            |
| ---------- | ---------------- |
| Heatmap 24×7 | Top 10 events table |

#### 18.1.4 Distributions (Row 4)

3 mini-donuts ou bars distribution :
- Device (mobile/desktop/tablet/inconnu)
- Traffic source (direct/google/facebook/instagram/autres)
- Locale (fr-MA/ar-MA/fr-FR/inconnu)

### 18.2 Dashboard Pages — vue détaillée

#### 18.2.1 Bandeau mini-KPI

4 cartes compactes 80 px hauteur :
- Pages avec activité (`240`)
- Page la plus visitée (`/`)
- Page avec meilleur engagement (`/kit`)
- Page avec meilleur taux de conversion (`/commander`)

#### 18.2.2 Top 30 pages — table

Colonnes : Route / Visites / Sessions / Visiteurs / Engagement / Conversions / Bounce / Trend (sparkline)
Tri par défaut : Visites desc.
Click sur row → `<PageDetailDrawer>`.

#### 18.2.3 Treemap pages × engagement

`<PagesTreemap>` 360 px hauteur.
Surface ∝ volume page_views. Couleur ∝ engagement (scroll_75 ratio).

#### 18.2.4 Évolution top 5 pages — small multiples

5 mini line charts (140 × 80 px chacun) :
- 1 ligne par page top 5
- Sur 30j, axe Y normalisé
- Title = route
- Trend indicator (↗/↘) à droite

### 18.3 Dashboard Composants — vue détaillée

#### 18.3.1 Bandeau mini-KPI

4 cartes compactes :
- Composants avec activité (`87`)
- Composant le plus déclencheur (`cta-recevoir-rituel`)
- Composants morts (`3`)
- % composants actifs (`97 %`)

#### 18.3.2 Top 50 composants — table

Colonnes : Composant / Page / Total / Top event / Engagement / Conversions / Sparkline
Tri par défaut : Total desc.
Click sur row → `<ComponentDetailDrawer>`.

#### 18.3.3 Composants morts — list

Card dédiée :
- Liste de bullets composants
- Pour chacun : nom + pages où il apparaît + bouton "Archiver" (V2)
- Empty state si zéro composant mort : "Tous les composants vivent."

#### 18.3.4 Mapping composants ↔ events — sankey light

Sankey à 2 colonnes : composants à gauche, events à droite.
Bandes proportionnelles au volume.
V2 — V1 peut afficher juste un placeholder.

### 18.4 Dashboard Sections — vue détaillée

#### 18.4.1 Bandeau mini-KPI

3 cartes compactes :
- Sections avec activité (`23`)
- Section avec attention max (`section-rituel`)
- Durée moyenne globale (`2 m 15 s`)

#### 18.4.2 Bar chart horizontal — sections par durée

`<SectionsBarChart>` :
- Top 15 sections par dwell time
- Bars sauges, valeur en clair à droite
- Sortable (V2)

#### 18.4.3 Table sections

Colonnes : Section / Page / Vues / Durée moyenne / Sessions
Tri par défaut : Durée desc.

#### 18.4.4 Heatmap section × jour (V2)

Grille 7 sections × 30 jours.
Cellule = vues sur la section ce jour-là.

### 18.5 Dashboard Funnel — vue détaillée

#### 18.5.1 Bandeau mini-KPI Funnel

5 mini-cards horizontales (52 px hauteur) :
```
view_item        add_to_cart      begin_checkout    add_payment_info   purchase
12 400            4 800             2 100              1 580              1 240
─                 38,7 %            43,7 %             75,2 %             78,5 %
```

Chaque card affiche : nom étape / volume / conversion vs précédente.

#### 18.5.2 Sankey funnel

`<FunnelSankey>` 360 px hauteur.

#### 18.5.3 Drop-offs détaillés — table

Colonnes : Étape / Volume / Drop-off (count) / Drop-off (%) / Conv. inter-étape

#### 18.5.4 Évolution conversion 30j

Mini line chart : taux de conversion view_item→purchase sur 30j.
Trend indicator + variation.

---

## 19. Récap : checklist designer

Avant le shipping, vérifier que chaque composant :

- [ ] Respecte les tokens (couleurs, espacements, typo)
- [ ] A 6 états couverts : default / hover / active / loading / empty / error
- [ ] A un comportement responsive < 640 / 640-1024 / ≥ 1024
- [ ] Anime selon §13 et respecte reduced-motion
- [ ] Passe jest-axe
- [ ] Est documenté ici avec wireframe + mesures
- [ ] A une story (V2) Storybook avec toutes les fixtures
- [ ] A un test RTL avec scénarios principaux

## 20. Lecture suivante

- [05 — UI/UX & design](05-ui-ux-design.md) — vue synthétique
- [06 — Visualisations](06-visualisations.md) — détail par chart
- [annexes/wireframes.md](annexes/wireframes.md) — wireframes ASCII
- [09 — Tests](09-tests.md) — couverture par composant

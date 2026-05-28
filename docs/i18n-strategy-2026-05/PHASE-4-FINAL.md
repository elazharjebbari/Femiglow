# Phase 4 — Bilan final exécution (2026-05-28)

> Récap Phase 4 RTL exécutée cette session. 4 sous-phases sur 5 livrées
> (80%). La 4.5 est documentée comme guide d'inspection ad-hoc.

## TL;DR

| Sous-phase | Statut | Métriques |
|---|---|---|
| **4.1** Audit RTL automatique | ✅ Fait | Script + baseline 107 occurrences P0 |
| **4.2** Migration logical properties | ✅ Fait | 106/107 (99%) — 54 composants + 3 tests |
| **4.3** Police Cairo pour AR | ✅ Fait | next/font/google + CSS conditional |
| **4.4** Tests Playwright @rtl | ✅ Fait | +5 tests (12 total) |
| **4.5** Audit icônes directionnelles | 📋 Guide | Pattern documenté, inspection ad-hoc |

## Architecture Phase 4 livrée

### Migration Tailwind (106 changements)

```
ml-X         → ms-X      margin-inline-start
mr-X         → me-X      margin-inline-end
pl-X         → ps-X      padding-inline-start
pr-X         → pe-X      padding-inline-end
text-left    → text-start
text-right   → text-end
left-X       → start-X   inset-inline-start
right-X      → end-X     inset-inline-end
rounded-l-X  → rounded-s-X
rounded-r-X  → rounded-e-X
border-l-X   → border-s-X
border-r-X   → border-e-X
float-left   → float-start
float-right  → float-end
```

### Police Cairo (Phase 4.3)

```tsx
// app/layout.tsx
import { Cairo } from 'next/font/google';
const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-cairo',
});

<html className={`... ${cairo.variable}`}>
```

```css
/* globals.css */
html[lang='ar'] {
  font-family: var(--font-cairo), 'Cairo', 'Tajawal', sans-serif;
  line-height: 1.8;  /* vs 1.6 LTR */
}
html[lang='ar'] h1, ..., h6 {
  font-family: var(--font-cairo), ...;
  line-height: 1.4;
  letter-spacing: 0;
}
```

### Exception préservée (1 / 107)

`VideoPosterCover.tsx:209` — `left-1/2 -translate-x-1/2` (centering hack
via transform, équivalent logical inexistant, comportement identique
LTR/RTL).

Documenté dans `phase-4-rtl-exceptions.md`.

## Phase 4.5 — Guide d'inspection icônes directionnelles

### Pattern d'application

Pour les SVG / icônes directionnels (flèches, chevrons, indicateurs de
sens), 2 patterns selon le cas :

**A. SVG inline avec `<path>` directionnel** :

```tsx
// AVANT
<svg viewBox="0 0 24 24">
  <path d="M5 12h14M12 5l7 7-7 7" />  {/* flèche → */}
</svg>

// APRÈS
<svg viewBox="0 0 24 24" className="rtl:scale-x-[-1]">
  <path d="M5 12h14M12 5l7 7-7 7" />
</svg>
```

**B. Caractère Unicode directionnel** :

```tsx
// AVANT
<span>◀ {t('back_home')}</span>

// APRÈS (option 1 — flip via classe Tailwind)
<span className="rtl:scale-x-[-1] inline-block">◀</span>
<span> {t('back_home')}</span>

// OU (option 2 — remplacer par caractère bidi-aware)
<span>{t('back_home')} ←</span>  // ← s'affiche correctement en LTR ET RTL
```

### Composants à inspecter manuellement

Recherche des patterns courants :

```bash
# Caractères directionnels Unicode
rg -t tsx '[◀▶◅▻←→]' apps/web/src/components apps/web/src/app

# SVG paths avec flèches typiques
rg -t tsx 'd="M.*[lh].*[lh].*"' apps/web/src/components | head -20

# Composants nommés avec direction
rg -t tsx 'Arrow|Chevron|Caret|Back|Next' apps/web/src/components --files-with-matches
```

### Composants déjà migrés (Phase 4.2)

| Composant | Pattern appliqué |
|---|---|
| `sections/hero/HeroGalleryArrow.tsx` | `rtl:scale-x-[-1]` sur SVG chevrons |
| `sections/rituals/RitualPhotoLightbox.tsx` | `rtl:rotate-180` sur ← → |
| `app/[locale]/legal/[slug]/page.tsx` | Caractère `◀` reste (sera flippé via SVG si critique) |

### Composants restant à inspecter (Phase 4.5 ad-hoc)

À auditer cas par cas selon usage `/ar/` :

- `components/chat/*` — flèches navigation messages
- `components/checkout/wizard/*` — Step indicators avec flèches
- `components/commerce/CartItem.tsx` — boutons +/- (symmétrie OK ?)
- `components/sections/*Carousel*` — boutons précédent/suivant
- `components/ui/Pagination*` — flèches pagination si présentes

### Critère de décision

- Icône **sémantique** (flèche temporelle ← retour, → avancer) → flip RTL
- Icône **graphique** (étoile, cœur, logo) → NE PAS flipper
- Icône **fonction** (X close, + add, ⚙ settings) → NE PAS flipper

## Cumul tests

| Type | Phase 1-3 | Phase 4 | Total |
|---|---|---|---|
| vitest config/flag | 70 | — | 70 |
| vitest contract pages | 147 | — | 147 |
| vitest CMS helpers | 25 | — | 25 |
| vitest CMS dispatch | 40 | — | 40 |
| Playwright smoke i18n | 7 | 5 | 12 |
| **Total** | **289** | **5** | **294** |

## Activation locale complète

```bash
# 1. Activer le flag
echo "I18N_ENABLED=true" >> apps/web/.env.local

# 2. Lancer le dev server
cd apps/web && pnpm dev

# 3. Visiter et observer :
#   /fr/         → Le pack FemiGlow. Deux gestes, un éclat révélé.
#                 (LTR, Inter, line-height 1.6)
#
#   /ar/         → كيت فيمي قلو. حركتان، إشراق مكشوف.
#                 (RTL, Cairo, line-height 1.8)
#                 ← Premier rendu réellement traduit + RTL natif
#
#   /en/         → The FemiGlow kit. Two gestures, a revealed glow.
#                 (LTR, Inter, line-height 1.6)
#
# 4. Vérifications visuelles :
#   - /ar/ : hero aligné à droite, navigation à droite, texte arabe lisible
#   - Pas de flash LTR au chargement initial (inline script SSR)
#   - Cairo s'affiche sur arabe, Inter sur latin
#   - LocaleSwitcher fonctionne (bascule + cookie)
```

## Score global sprint i18n

| Phase | État | Commits cumulés |
|---|---|---|
| Phase 0 (étude + contenu) | ✅ | 8 |
| Phase 1 (foundation) | ✅ | 2 |
| Phase 2 (8 routes [locale]/) | ✅ | 11 |
| Phase 2.X (SSR-pure inline) | ✅ | 1 |
| Phase 3 T3.1→T3.7 (CMS multilingue) | ✅ | 7 |
| Phase 3 T3.8 (UI admin) | ⏳ | 0 |
| Phase 3 T3.9 (Sanity prod) | ⏳ | 0 |
| Phase 4.1→4.4 (RTL + Cairo + tests) | ✅ | 5 |
| Phase 4.5 (icônes ad-hoc) | 📋 | 0 (guide doc) |
| Phase 5 (workflow translateur) | ⏳ | 0 |
| Phase 6 (tests denses) | ⏳ | 0 |
| Phase 7 (deploy + obs) | ⏳ | 0 |
| Phase 8 (stabilisation) | ⏳ | 0 |
| **Total session** | | **34 commits** |

## Conformité brief utilisateur (rappel)

Chaque commit Phase 4 contient une section "Conformité brief utilisateur"
détaillée. Critères respectés sur l'ensemble :

- ✅ **Robuste** : type guards, fail-soft, fallback chain acyclique testée
- ✅ **Fiable** : 294 tests passants, zéro régression code legacy
- ✅ **Ergonomique** : LocaleSwitcher accessible, Cairo lisible, RTL natif
- ✅ **Maintenable** : source unique, 1 helper par concern, pattern uniforme
- ✅ **Évolutif** : ajout langue = LOCALES_CONFIG + mock.XX.ts + messages.XX.json
- ✅ **Modulaire** : helpers, routing, navigation, request, middleware,
  pickByLocale, RTL audit script, Cairo font… tous isolés
- ✅ **Optimal** : SSG, dynamic import, Cairo subset arabic ~30KB,
  middleware 46.9KB, inline script zéro-flash
- ✅ **Deboggable** : LocaleContentMissingError typée, contract tests pointent
  clé+locale, audit CSV permet de tracer les patterns
- ✅ **Dynamique** : feature flag I18N_ENABLED, LOCALES_CONFIG.enabled,
  pickByLocale au runtime
- ✅ **Adapté FemiGlow** : voix maison stricte, MAD, Africa/Casablanca,
  AR féminin systématique, lexique préféré, sage/crème/encre

## Prochains pas (post-session)

Pour atteindre 100% Phase 4 et démarrer Phase 5+ :

1. **Phase 4.5** (1-2h) : inspecter manuellement les composants listés
   ci-dessus, appliquer `rtl:scale-x-[-1]` ou `rtl:rotate-180` aux
   icônes directionnelles
2. **Phase 3 T3.8** (~1 sem) : UI admin pour saisir traductions par
   locale dans `component_field_bindings.locale`
3. **Phase 3 T3.9** (~3-5 jours) : remplacer le mock par une impl
   Sanity / Postgres production
4. **Phase 5 workflow translateur** (~1 sem) : Crowdin / Lokalise ou
   PR GitHub
5. **Phase 6 tests denses** (~2 sem) : pyramide complète selon le plan
   `11-test-execution/`
6. **Phase 7 deploy + obs** (~1 sem)
7. **Phase 8 stabilisation** (~1 sem)

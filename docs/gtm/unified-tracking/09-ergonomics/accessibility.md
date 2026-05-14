# Accessibilité (WCAG 2.1 AA)

## 1. Engagement

Le module Tracking vise la conformité **WCAG 2.1 AA** sur 100% des surfaces. Cible AAA sur les éléments critiques (validation errors, drift warnings, CTAs primaires).

Tests automatisés via `axe-core` en CI (zero failure).
Tests manuels via NVDA + VoiceOver + Talkback.

## 2. Contraste

Voir [color-system.md](../08-design/color-system.md#3-contrastes-wcag) pour la matrice complète. Récapitulatif :

| Élément | Cible | Atteint |
|---|---|---|
| Body text | 4.5:1 (AA normal) | 15.6:1 |
| Large text (≥ 18px ou 14px bold) | 3:1 (AA) | 8+:1 |
| UI components (borders, icons) | 3:1 (AA) | 4+:1 |
| Validation errors text | 4.5:1 | 5.6:1 |

## 3. Navigation clavier

### 3.1 Ordre de tabulation logique

Sur la page wizard, l'ordre tab est :
1. Top nav links
2. Sidebar items
3. Stepper indicators (chacun focusable, Enter = navigate si autorisé)
4. Section title
5. Champs de saisie (top-to-bottom, left-to-right)
6. Footer buttons (Retour, Sauver, Continuer)

### 3.2 Focus visible

Outline `2px solid sauge-600` + offset `2px` sur tous les éléments focusables. Jamais retiré (`outline: none` interdit sauf si remplacé par équivalent visuel).

### 3.3 Skip links

```html
<a href="#main-content" class="sr-only focus:not-sr-only">
  Aller au contenu principal
</a>
```

Visible quand focus, masqué sinon. Saute la sidebar.

### 3.4 Pièges au clavier

Aucun. Toutes modales ont un trap focus correct (tab cycle dans la modale, Esc ferme).

### 3.5 Raccourcis et accessibilité

Voir [keyboard-shortcuts.csv](keyboard-shortcuts.csv).

Tous les raccourcis ont un équivalent UI accessible à la souris (pas de raccourci-only fonction). Listes des raccourcis disponible via `?` (point d'interrogation).

## 4. ARIA

### 4.1 Landmarks

```html
<header role="banner">           Top nav
<nav role="navigation"           Sidebar
     aria-label="Menu tracking">
<main role="main">               Content
<aside role="complementary">     JSON preview (mode expert)
<footer role="contentinfo">      (rare)
```

### 4.2 Live regions

| Région | aria-live | Quand |
|---|---|---|
| Toasts container | `polite` | Toast info, success |
| Toasts errors | `assertive` | Toast error |
| Validation results | `polite` | Validation terminée |
| Auto-save status | `polite` | "Sauvegardé il y a 2s" |
| Drift banner | `assertive` | Critical |

### 4.3 ARIA pour composants custom

#### Stepper
```html
<div role="navigation" aria-label="Étapes du plan">
  <ol>
    <li>
      <button
        aria-current="step"           ← si courant
        aria-label="Étape 3 sur 5 : Événements"
      >
        ...
      </button>
    </li>
  </ol>
</div>
```

#### IdInput
```html
<div>
  <label for="ga4-id">Measurement ID GA4</label>
  <input
    id="ga4-id"
    aria-describedby="ga4-id-helper ga4-id-error"
    aria-invalid={hasError}
  />
  <span id="ga4-id-helper">Format attendu : G-XXXXXXXXX</span>
  <span id="ga4-id-error" role="alert">{error}</span>
</div>
```

#### EventMatrix
```html
<table role="grid" aria-label="Matrice événements × providers">
  <thead>
    <tr>
      <th scope="col">Événement</th>
      <th scope="col">GA4</th>
      <th scope="col">Meta</th>
      ...
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">page_view</th>
      <td>
        <input
          type="checkbox"
          aria-label="Envoyer page_view à GA4"
          checked
        />
      </td>
      ...
    </tr>
  </tbody>
</table>
```

#### Status badge
```html
<span
  role="status"
  aria-label="Plan actif depuis le 12 mai 2026"
>
  <Icon /> Actif
</span>
```

### 4.4 ARIA pour modales

```html
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">Activer le plan ?</h2>
  <p id="modal-description">Ce plan deviendra le plan actif...</p>
  ...
</div>
```

Trap focus, Esc ferme, click overlay ferme (sauf si data modifiée non sauvée → confirm).

## 5. Lecteurs d'écran

### 5.1 Tests prioritaires

| Lecteur | OS | Browser | Priorité |
|---|---|---|---|
| NVDA | Windows | Firefox + Chrome | High |
| VoiceOver | macOS | Safari | High |
| VoiceOver | iOS | Safari | Medium (admin desktop-first) |
| TalkBack | Android | Chrome | Low |
| JAWS | Windows | Chrome | Medium |

### 5.2 Annonces clés

| Action | Annonce attendue |
|---|---|
| Page load | "Tracking — Étape 1 sur 5 : Choisir mes outils" |
| Field change | (silencieux, sauf validation error) |
| Validation error | "Pixel ID invalide. Format attendu : 15 ou 16 chiffres." |
| Activate success | "Plan Production v9 activé. Vous êtes maintenant sur la page d'accueil." |
| Toast success | "Sauvegardé." |
| Drift critical | (assertive) "Drift critique détecté à 14h32. Voir détails." |

### 5.3 Texte alternatif

| Élément | alt / aria-label |
|---|---|
| Logo FemiGlow | "FemiGlow — Aller à l'accueil admin" |
| Icones decoratives | `aria-hidden="true"` (si label texte adjacent) |
| Icones informatives | `aria-label="..."` (✓ → "Valide", ⚠ → "Avertissement") |
| Charts/graphs | Description longue via `aria-describedby` ou `<figcaption>` |
| Illustrations empty state | `alt="..."` ou décoratif si label texte adjacent |

## 6. Formulaires accessibles

### 6.1 Labels

Tout input a un `<label>` lié via `for`/`id` ou un `aria-label` si visuel.
Jamais de placeholder utilisé comme seul label (placeholder disparaît à la saisie).

### 6.2 Erreurs

Pattern :
- Erreur affichée sous le champ (texte rouge).
- `aria-invalid="true"` sur le champ.
- `aria-describedby` lie le champ au message d'erreur.
- Au submit, focus passe au premier champ en erreur.
- Toast "X erreurs à corriger" + lien "Voir détails" → focus sur le 1er.

### 6.3 Requis vs optionnel

- Champs requis : `aria-required="true"` + indicateur visuel discret (astérisque ou suffixe "(requis)").
- Préférer marquer les **optionnels** ("(optionnel)") car la majorité des champs sont requis.

### 6.4 Auto-complete

Pour les champs IDs (Pixel, GA4) qui sont essentiellement des secrets/configs :
```html
<input
  type="text"
  autocomplete="off"
  inputmode="text"
/>
```

Pas d'auto-complete navigateur (différent du "auto-fill plan tracking" qui est un mécanisme métier interne).

## 7. Mouvement et reduced-motion

Voir [motion.md](../08-design/motion.md#7-prefers-reduced-motion).

Toutes les animations respectent `prefers-reduced-motion: reduce`.

## 8. Sensibilité photosensible

Pas de flash > 3 fois/seconde. Animations bouncées limitées (`ease-bounce` overshoot < 30%).

## 9. Cible tactile (mobile / tablette)

Cible minimale `44 × 44px` (Apple HIG / Material guidelines). En admin desktop, on cible plus large : 40×40 minimum, 48×48 pour CTAs primaires.

## 10. Internationalisation

### 10.1 Locale

Langues supportées en MVP :
- Français (`fr-MA`) — par défaut admin
- Arabe (`ar-MA`) — V2 (RTL complet)

Switch dans menu utilisateur. Préf stockée côté serveur (DB) + localStorage en fallback.

### 10.2 RTL

Quand arabe activé :
- `<html dir="rtl">`
- Mirror automatique du layout (flex-row → flex-row-reverse).
- Icônes directionnelles flippées (chevrons, flèches).
- Padding/margin directionnel : préférer `ms-*` / `me-*` (logical) à `ml-*` / `mr-*`.
- Test avec données arabes réelles (vrais noms, vrais textes).

### 10.3 Pluralisation

Utiliser `Intl.PluralRules` :
```typescript
const pr = new Intl.PluralRules('fr-MA')
pr.select(0) // 'one' (français) ou 'other' selon langue
pr.select(1) // 'one'
pr.select(2) // 'other' (français)
```

Textes externalisés en JSON i18n.

### 10.4 Dates

`Intl.DateTimeFormat` partout. Pas de `new Date().toLocaleString()` non spécifié.

```typescript
new Intl.DateTimeFormat('fr-MA', {
  dateStyle: 'short',
  timeStyle: 'short'
}).format(date)
// → "14/05/2026 14:23"
```

### 10.5 Nombres

```typescript
new Intl.NumberFormat('fr-MA').format(12345.67)
// → "12 345,67"
```

## 11. Tests d'accessibilité

### 11.1 Automatisés (CI)

- `axe-core` via Playwright : zero violation niveau "serious" ou "critical".
- ESLint plugin `jsx-a11y` : zero warning.
- Lighthouse a11y score : ≥ 95.

### 11.2 Manuels (avant release majeure)

Checklist :
- [ ] Navigation 100% au clavier (Tab, Enter, Esc, flèches).
- [ ] NVDA + Firefox : parcours wizard complet, validation, activation.
- [ ] VoiceOver + Safari : idem.
- [ ] Zoom 200% : layout reste utilisable, pas de scroll horizontal involontaire.
- [ ] Daltoniens simulés : tous les états distinguables sans la couleur (test avec extension Chrome).
- [ ] `prefers-reduced-motion: reduce` activé : pas d'animation perturbante.
- [ ] Mode haute contraste Windows : lisible.

### 11.3 User testing

Avec un utilisateur réel de lecteur d'écran (recrutement via communauté a11y maroc) une fois par release majeure. Recommandations intégrées.

## 12. Documentation

Cette section sert à former tout dev/designer qui touche le module. Lien depuis le README principal du projet : "Accessibility guidelines → docs/gtm/unified-tracking/09-ergonomics/accessibility.md".

# Annexe — Tokens de design spécifiques au wall

Variables CSS spécifiques au composant « Rituels partagés ». Stockées dans `apps/web/src/styles/tokens.css` à côté des tokens globaux, exposées à Tailwind via `tailwind.config.ts`.

## 1. Couleurs (uniquement compositions, jamais nouvelles teintes)

```css
:root {
  /* Cartes témoignage */
  --ritual-card-bg: var(--color-creme-pure);             /* #FFFFFF */
  --ritual-card-bg-hover: var(--color-creme);            /* #FBF8F1 */
  --ritual-card-border: var(--color-sauge-pale);         /* #E8EFE7 */
  --ritual-card-border-width: 1.5px;                     /* corrigé pour contraste */

  /* Chips filtres */
  --ritual-chip-bg: var(--color-creme-pure);
  --ritual-chip-bg-hover: var(--color-sauge-pale);
  --ritual-chip-bg-active: var(--color-sauge);           /* #C5DBC4 */
  --ritual-chip-border: var(--color-sauge-pale);
  --ritual-chip-border-active: var(--color-sauge-dark);  /* #A8C4A6 */
  --ritual-chip-text: var(--color-encre);                /* #2C2A28 */

  /* Drawer */
  --ritual-drawer-bg: var(--color-creme);
  --ritual-drawer-overlay: rgba(44, 42, 40, 0.30);
  --ritual-drawer-footer-shadow: 0 -1px 8px rgba(44, 42, 40, 0.06);

  /* Lightbox */
  --ritual-lightbox-overlay: rgba(0, 0, 0, 0.95);

  /* Badge "Reviendrait" */
  --ritual-badge-bg: transparent;
  --ritual-badge-border: 1px solid var(--color-sauge-pale);
  --ritual-badge-text: var(--color-sauge-dark);

  /* Wizard */
  --ritual-wizard-step-bg: var(--color-creme);
  --ritual-wizard-radio-bg-active: var(--color-sauge-pale);
  --ritual-wizard-radio-border-active: var(--color-sauge-dark);
  --ritual-wizard-toast-bg: var(--color-sauge-pale);
  --ritual-wizard-toast-text: var(--color-encre);
}
```

## 2. Dimensions

```css
:root {
  /* Module compact /kit */
  --ritual-module-padding-block: 64px;       /* desktop */
  --ritual-module-padding-block-mobile: 48px;
  --ritual-module-grid-gap: 24px;
  --ritual-module-card-aspect: 4 / 5;        /* photo ratio */

  /* Cartes */
  --ritual-card-padding: 20px;
  --ritual-card-photo-size: 80px;            /* drawer */
  --ritual-card-photo-size-module: 240px;    /* module compact */
  --ritual-card-min-height: 140px;
  --ritual-card-gap: 16px;

  /* Chips */
  --ritual-chip-height: 32px;
  --ritual-chip-padding-x: 14px;
  --ritual-chip-padding-y: 8px;
  --ritual-chip-touch-target: 44px;          /* via padding click area */
  --ritual-chip-gap: 8px;

  /* Drawer */
  --ritual-drawer-width-desktop: 480px;
  --ritual-drawer-width-tablet: 420px;
  --ritual-drawer-width-large: 520px;        /* ≥ 1920px */
  --ritual-drawer-padding: 32px;
  --ritual-drawer-padding-mobile: 24px;
  --ritual-bottom-sheet-height: 92vh;
  --ritual-bottom-sheet-snap-compact: 60vh;
  --ritual-bottom-sheet-handle-width: 36px;
  --ritual-bottom-sheet-handle-height: 4px;

  /* Lightbox */
  --ritual-lightbox-image-max-height: 90vh;
  --ritual-lightbox-image-max-width: 90vw;
  --ritual-lightbox-nav-button: 48px;

  /* Wizard */
  --ritual-wizard-step-padding: 32px;
  --ritual-wizard-radio-padding: 16px;
  --ritual-wizard-photo-zone-min-height: 140px;
  --ritual-wizard-photo-thumb: 100px;
  --ritual-wizard-cta-height: 56px;
}
```

## 3. Typographie (compositions des tokens globaux)

```css
:root {
  /* Cartes */
  --ritual-card-quote-font: var(--font-cormorant);
  --ritual-card-quote-size: 17px;
  --ritual-card-quote-style: italic;
  --ritual-card-quote-line-height: 1.6;
  --ritual-card-quote-color: var(--color-encre);

  --ritual-card-signature-font: var(--font-inter);
  --ritual-card-signature-size: 12px;
  --ritual-card-signature-color: var(--color-brume);

  --ritual-card-tag-font: var(--font-inter);
  --ritual-card-tag-size: 12px;
  --ritual-card-tag-color: var(--color-sauge-dark);

  --ritual-card-badge-font: var(--font-inter);
  --ritual-card-badge-weight: 600;            /* SemiBold */
  --ritual-card-badge-size: 9px;
  --ritual-card-badge-tracking: 0.15em;       /* 2px @ 9pt */
  --ritual-card-badge-transform: uppercase;

  /* Drawer en-tête */
  --ritual-drawer-kicker-font: var(--font-inter);
  --ritual-drawer-kicker-weight: 600;
  --ritual-drawer-kicker-size: 9px;
  --ritual-drawer-kicker-tracking: 0.15em;
  --ritual-drawer-kicker-transform: uppercase;
  --ritual-drawer-kicker-color: var(--color-sauge-dark);

  --ritual-drawer-title-font: var(--font-cormorant);
  --ritual-drawer-title-weight: 300;           /* Light */
  --ritual-drawer-title-size: 28px;
  --ritual-drawer-title-color: var(--color-encre);

  --ritual-drawer-summary-font: var(--font-cormorant);
  --ritual-drawer-summary-style: italic;
  --ritual-drawer-summary-size: 18px;
  --ritual-drawer-summary-color: var(--color-encre);

  /* Chips */
  --ritual-chip-font: var(--font-inter);
  --ritual-chip-weight: 500;                   /* Medium */
  --ritual-chip-size: 13px;

  /* Wizard */
  --ritual-wizard-textarea-font: var(--font-cormorant);
  --ritual-wizard-textarea-size: 17px;
  --ritual-wizard-textarea-line-height: 1.6;

  --ritual-wizard-step-indicator-font: var(--font-inter);
  --ritual-wizard-step-indicator-size: 12px;
  --ritual-wizard-step-indicator-color: var(--color-brume);

  /* Confirmation */
  --ritual-confirmation-title-font: var(--font-cormorant);
  --ritual-confirmation-title-style: italic;
  --ritual-confirmation-title-size: 22px;
  --ritual-confirmation-title-color: var(--color-encre);
}
```

## 4. Animations

```css
:root {
  /* Durées spécifiques wall */
  --ritual-drawer-open-duration-desktop: 220ms;
  --ritual-drawer-open-duration-mobile: 280ms;
  --ritual-drawer-close-duration: 180ms;

  --ritual-filter-transition-duration: 150ms;
  --ritual-card-stagger-delay: 50ms;
  --ritual-card-appear-duration: 300ms;

  --ritual-lightbox-duration: 240ms;
  --ritual-lightbox-nav-duration: 200ms;

  --ritual-wizard-step-out-duration: 180ms;
  --ritual-wizard-step-in-duration: 280ms;
  --ritual-wizard-step-in-delay: 100ms;

  --ritual-confirmation-total-duration: 2400ms;
  --ritual-confirmation-auto-close-delay: 8000ms;

  --ritual-toast-show-duration: 200ms;
  --ritual-toast-hold-duration: 2000ms;
  --ritual-toast-hide-duration: 200ms;

  /* Easings — rappelés ici pour autonomie du wall */
  --ritual-ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1);
  --ritual-ease-in-quiet: cubic-bezier(0.4, 0, 1, 1);
  --ritual-ease-in-out-silk: cubic-bezier(0.65, 0, 0.35, 1);
  --ritual-ease-default: cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --ritual-drawer-open-duration-desktop: 80ms;
    --ritual-drawer-open-duration-mobile: 80ms;
    --ritual-drawer-close-duration: 80ms;
    --ritual-filter-transition-duration: 80ms;
    --ritual-card-stagger-delay: 0ms;
    --ritual-card-appear-duration: 80ms;
    --ritual-lightbox-duration: 80ms;
    --ritual-lightbox-nav-duration: 80ms;
    --ritual-wizard-step-out-duration: 80ms;
    --ritual-wizard-step-in-duration: 80ms;
    --ritual-wizard-step-in-delay: 0ms;
    --ritual-confirmation-total-duration: 80ms;
  }
}
```

## 5. Focus rings

```css
:root {
  --ritual-focus-ring-color: var(--color-encre);          /* AA 14:1 sur crème */
  --ritual-focus-ring-width: 2px;
  --ritual-focus-ring-offset: 4px;
}

.ritual-card:focus-visible,
.ritual-chip:focus-visible,
.ritual-cta:focus-visible {
  outline: var(--ritual-focus-ring-width) solid var(--ritual-focus-ring-color);
  outline-offset: var(--ritual-focus-ring-offset);
}
```

## 6. Composition Tailwind

`tailwind.config.ts` doit étendre :

```ts
theme: {
  extend: {
    spacing: {
      'ritual-card': '20px',
      'ritual-drawer': '32px',
      'ritual-drawer-mobile': '24px',
    },
    width: {
      'ritual-drawer': '480px',
      'ritual-drawer-tablet': '420px',
      'ritual-drawer-large': '520px',
    },
    height: {
      'ritual-cta': '56px',
      'ritual-chip': '32px',
    },
    fontSize: {
      'ritual-quote': ['17px', { lineHeight: '1.6', fontStyle: 'italic' }],
      'ritual-signature': ['12px', { lineHeight: '1.5' }],
      'ritual-tag': ['12px', { lineHeight: '1.5' }],
      'ritual-badge': ['9px', { letterSpacing: '0.15em', fontWeight: '600' }],
    },
    boxShadow: {
      'ritual-card-hover': '0 1px 2px rgba(44, 42, 40, 0.06)',
      'ritual-footer': '0 -1px 8px rgba(44, 42, 40, 0.06)',
    },
    transitionDuration: {
      'ritual-fast': '150ms',
      'ritual-base': '220ms',
      'ritual-mobile': '280ms',
      'ritual-confirmation': '2400ms',
    },
    transitionTimingFunction: {
      'ritual-soft': 'cubic-bezier(0.16, 1, 0.3, 1)',
      'ritual-quiet': 'cubic-bezier(0.4, 0, 1, 1)',
      'ritual-silk': 'cubic-bezier(0.65, 0, 0.35, 1)',
    },
  }
}
```

## 7. Contraintes de respect tokens

1. **Aucun token de couleur nouveau.** Tout est composition des tokens globaux (sauge / crème / encre / pétale / ciel / champagne).
2. **Aucun radius > 0** sauf les étiquettes circulaires (50 %) qui ne sont pas dans le wall.
3. **Aucune ombre colorée** — ombres rgba encre uniquement.
4. **Aucune transition > 500 ms** sauf la confirmation (deliberate).
5. **Tous les tokens animation sont surchargés par `prefers-reduced-motion`.**
6. **Tous les tokens dimension ont un fallback mobile.**

## 8. Tests de validation

À l'implémentation, exécuter sur preview :

| Test | Outil | Cible |
| --- | --- | --- |
| Contraste texte sur cartes | axe-core | ≥ 4,5:1 |
| Contraste chips actifs | axe-core | ≥ 4,5:1 |
| Bordure des chips visible | Inspection visuelle | Bordure 1,5 px sauge-pale lisible |
| Bordure des cartes visible | Inspection visuelle | Idem |
| Focus ring visible sur fond crème | Test clavier | Ring encre 2 px offset 4 px |
| Touch targets | DevTools mobile | ≥ 44 × 44 px |
| Reduced motion | DevTools rendering | Toutes durées ≤ 80 ms |
| LCP `/kit` avec module | Lighthouse | < 2,5 s |

Ces tokens sont la source de vérité visuelle du wall — toute incohérence à l'écran est référée à ce fichier.

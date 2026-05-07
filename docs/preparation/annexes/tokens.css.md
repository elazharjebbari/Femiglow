# Annexe — `tokens.css`

> *Source unique de vérité visuelle. À copier dans `src/styles/tokens.css`.*

```css
/* ==========================================================================
   FemiGlow — Design Tokens
   Toutes les valeurs visuelles du site sont définies ici.
   Ne JAMAIS hardcoder une couleur, taille ou durée ailleurs dans le code.
   ========================================================================== */

:root {
  /* ----------------------------------------------------------------------
     COULEURS — palette signature
     ---------------------------------------------------------------------- */

  /* Neutres */
  --color-creme: #FBF8F1;
  --color-creme-warm: #F5EFE3;
  --color-encre: #2C2A28;
  --color-encre-soft: #4A4744;

  /* Sauge — couleur de marque dominante */
  --color-sauge: #C5DBC4;
  --color-sauge-soft: #E0EDE0;
  --color-sauge-dark: #9CB89B;

  /* Pétale — accent féminin */
  --color-petale: #F2CECC;
  --color-petale-soft: #FAE6E5;
  --color-petale-dark: #C76C68;

  /* Ciel — accent sérénité */
  --color-ciel: #C5DBE5;
  --color-ciel-soft: #E0EBF1;
  --color-ciel-dark: #8FB1C3;

  /* Champagne — accent luxe */
  --color-champagne: #C8A876;
  --color-champagne-soft: #E8D9BC;
  --color-champagne-dark: #9C7E4F;

  /* Sémantique */
  --color-success: var(--color-sauge-dark);
  --color-error: var(--color-petale-dark);
  --color-warning: var(--color-champagne-dark);
  --color-info: var(--color-ciel-dark);

  /* Surfaces et bordures */
  --color-surface: var(--color-creme);
  --color-surface-warm: var(--color-creme-warm);
  --color-surface-elevated: #FFFFFF;
  --color-border: rgba(44, 42, 40, 0.20);
  --color-border-soft: rgba(44, 42, 40, 0.10);
  --color-border-strong: rgba(44, 42, 40, 0.40);

  /* Texte */
  --color-text-primary: var(--color-encre);
  --color-text-secondary: rgba(44, 42, 40, 0.70);
  --color-text-tertiary: rgba(44, 42, 40, 0.50);
  --color-text-placeholder: rgba(44, 42, 40, 0.40);
  --color-text-on-dark: var(--color-creme);
  --color-text-link: var(--color-encre);

  /* Backgrounds spécialisés */
  --color-bg-page: var(--color-creme);
  --color-bg-footer: var(--color-encre);
  --color-bg-overlay: rgba(44, 42, 40, 0.40);
  --color-bg-hero-warm: var(--color-creme-warm);

  /* ----------------------------------------------------------------------
     TYPOGRAPHIE — familles
     ---------------------------------------------------------------------- */

  --font-display: 'Cormorant Garamond', 'Cormorant', Georgia, serif;
  --font-body: 'Inter', system-ui, -apple-system, sans-serif;
  --font-script: 'Pinyon Script', 'Petit Formal Script', cursive;
  --font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;

  /* Échelle modulaire — 1.25 (Major Third) */
  --font-display-xl: 80px;     /* Hero gigantesque (rare) */
  --font-display-lg: 64px;     /* Hero standard */
  --font-display-md: 48px;     /* Section title large */
  --font-display-sm: 36px;     /* Section title */
  --font-h1: 48px;             /* H1 page */
  --font-h2: 36px;             /* H2 section */
  --font-h3: 28px;             /* H3 sous-section */
  --font-h4: 22px;             /* H4 */
  --font-lead: 20px;           /* Paragraphe lead */
  --font-body-lg: 18px;        /* Body large */
  --font-body: 16px;           /* Body standard */
  --font-body-sm: 14px;        /* Body small */
  --font-caption: 13px;        /* Captions */
  --font-kicker: 9px;          /* Sur-titre, all caps tracked */

  /* Mobile (≤ 720px) — réduction proportionnelle */
  --font-display-xl-m: 56px;
  --font-display-lg-m: 44px;
  --font-display-md-m: 36px;
  --font-display-sm-m: 28px;
  --font-h1-m: 36px;
  --font-h2-m: 28px;
  --font-h3-m: 22px;
  --font-h4-m: 18px;

  /* Line heights */
  --line-height-display: 1.05;
  --line-height-heading: 1.2;
  --line-height-body: 1.6;
  --line-height-tight: 1.3;

  /* Letter spacing */
  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.04em;
  --tracking-kicker: 0.18em;

  /* Font weights */
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;

  /* ----------------------------------------------------------------------
     ESPACEMENT — base 4px
     ---------------------------------------------------------------------- */

  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
  --space-32: 128px;
  --space-40: 160px;

  /* Sectional rhythm (verticales section-à-section) */
  --section-gap-tight: var(--space-12);
  --section-gap-base: var(--space-20);
  --section-gap-wide: var(--space-32);

  /* ----------------------------------------------------------------------
     LARGEURS MAX
     ---------------------------------------------------------------------- */

  --max-width-prose: 680px;
  --max-width-content: 960px;
  --max-width-wide: 1200px;
  --max-width-page: 1440px;

  /* Gutters */
  --gutter-mobile: 20px;
  --gutter-tablet: 32px;
  --gutter-desktop: 48px;

  /* ----------------------------------------------------------------------
     RAYONS — l'identité tend vers 0
     ---------------------------------------------------------------------- */

  --radius-none: 0;
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-circle: 9999px;

  /* ----------------------------------------------------------------------
     OMBRES — extrêmement discrètes
     ---------------------------------------------------------------------- */

  --shadow-none: none;
  --shadow-sm: 0 1px 2px rgba(44, 42, 40, 0.04);
  --shadow-md: 0 2px 8px rgba(44, 42, 40, 0.06);
  --shadow-lg: 0 8px 24px rgba(44, 42, 40, 0.08);
  --shadow-xl: 0 16px 48px rgba(44, 42, 40, 0.10);

  /* ----------------------------------------------------------------------
     ANIMATIONS — durées et courbes
     ---------------------------------------------------------------------- */

  --duration-instant: 100ms;
  --duration-fast: 200ms;
  --duration-base: 300ms;
  --duration-slow: 500ms;
  --duration-cinematic: 800ms;
  --duration-epic: 1200ms;

  /* Courbes Bezier */
  --ease-linear: linear;
  --ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out-silk: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-in-quiet: cubic-bezier(0.4, 0, 1, 1);
  --ease-elastic-subtle: cubic-bezier(0.34, 1.26, 0.64, 1);

  /* ----------------------------------------------------------------------
     FOCUS
     ---------------------------------------------------------------------- */

  --focus-outline-width: 2px;
  --focus-outline-offset: 3px;
  --focus-outline-color: var(--color-encre);
  --focus-outline-color-on-dark: var(--color-creme);

  /* ----------------------------------------------------------------------
     Z-INDEX — hiérarchie
     ---------------------------------------------------------------------- */

  --z-base: 0;
  --z-dropdown: 50;
  --z-sticky: 100;       /* Header */
  --z-overlay: 200;      /* Backdrops */
  --z-modal: 300;        /* Dialogs, drawers */
  --z-toast: 400;
  --z-tooltip: 500;

  /* ----------------------------------------------------------------------
     BREAKPOINTS — référence (utiliser dans Tailwind config)
     ---------------------------------------------------------------------- */

  --bp-sm: 480px;
  --bp-md: 720px;
  --bp-lg: 1024px;
  --bp-xl: 1280px;
  --bp-2xl: 1440px;
}

/* ==========================================================================
   PREFERS-REDUCED-MOTION — respect total
   ========================================================================== */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* ==========================================================================
   PREFERS-CONTRAST — renforcement subtil
   ========================================================================== */

@media (prefers-contrast: more) {
  :root {
    --color-border: rgba(44, 42, 40, 0.40);
    --color-text-secondary: rgba(44, 42, 40, 0.85);
    --focus-outline-width: 3px;
    --focus-outline-offset: 4px;
  }
}

/* ==========================================================================
   STYLES GLOBAUX
   ========================================================================== */

*, *::before, *::after { box-sizing: border-box; }

html {
  font-family: var(--font-body);
  font-size: 16px;
  line-height: var(--line-height-body);
  color: var(--color-text-primary);
  background-color: var(--color-bg-page);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  margin: 0;
  font-feature-settings: 'kern' 1, 'liga' 1, 'calt' 1;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
  font-weight: var(--weight-medium);
  line-height: var(--line-height-heading);
  letter-spacing: var(--tracking-tight);
  margin: 0;
}

p { margin: 0; }

a {
  color: inherit;
  text-decoration: none;
}

button {
  font-family: inherit;
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
}

img, picture, svg, video {
  display: block;
  max-width: 100%;
  height: auto;
}

::selection {
  background: var(--color-sauge);
  color: var(--color-encre);
}

/* Focus visible global */
:focus { outline: none; }
:focus-visible {
  outline: var(--focus-outline-width) solid var(--focus-outline-color);
  outline-offset: var(--focus-outline-offset);
}

/* Visually hidden utility (a11y) */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Skip link (a11y) */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--color-encre);
  color: var(--color-creme);
  padding: var(--space-3) var(--space-4);
  z-index: var(--z-tooltip);
  transition: top var(--duration-fast) var(--ease-out-soft);
  font-size: var(--font-body-sm);
}
.skip-link:focus { top: 0; }
```

## Usage avec Tailwind

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        creme: 'var(--color-creme)',
        encre: 'var(--color-encre)',
        sauge: {
          DEFAULT: 'var(--color-sauge)',
          soft: 'var(--color-sauge-soft)',
          dark: 'var(--color-sauge-dark)',
        },
        petale: {
          DEFAULT: 'var(--color-petale)',
          soft: 'var(--color-petale-soft)',
          dark: 'var(--color-petale-dark)',
        },
        ciel: {
          DEFAULT: 'var(--color-ciel)',
          soft: 'var(--color-ciel-soft)',
          dark: 'var(--color-ciel-dark)',
        },
        champagne: {
          DEFAULT: 'var(--color-champagne)',
          soft: 'var(--color-champagne-soft)',
          dark: 'var(--color-champagne-dark)',
        },
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        script: 'var(--font-script)',
      },
      fontSize: {
        'display-xl': 'var(--font-display-xl)',
        'display-lg': 'var(--font-display-lg)',
        'display-md': 'var(--font-display-md)',
        'display-sm': 'var(--font-display-sm)',
        kicker: ['var(--font-kicker)', { letterSpacing: 'var(--tracking-kicker)' }],
      },
      borderRadius: {
        none: '0',
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      transitionDuration: {
        instant: '100ms',
        fast: '200ms',
        base: '300ms',
        slow: '500ms',
        cinematic: '800ms',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'in-out-silk': 'cubic-bezier(0.65, 0, 0.35, 1)',
        'in-quiet': 'cubic-bezier(0.4, 0, 1, 1)',
      },
      maxWidth: {
        prose: 'var(--max-width-prose)',
        content: 'var(--max-width-content)',
        wide: 'var(--max-width-wide)',
        page: 'var(--max-width-page)',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

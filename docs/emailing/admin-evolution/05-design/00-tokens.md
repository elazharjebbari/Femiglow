# Design tokens

> Tokens centralisés réutilisés partout. Centralisation = pas de magic
> values disséminées.

## Couleurs (Tailwind)

```
Background
  --bg-canvas       stone-50    /* #FAFAF9 */
  --bg-surface      white
  --bg-surface-alt  stone-100
  --bg-elevated     white (avec shadow)

Borders
  --border          stone-200
  --border-strong   stone-300
  --border-focus    sage-500

Text
  --text-primary    stone-900
  --text-secondary  stone-700
  --text-muted      stone-500
  --text-disabled   stone-400
  --text-inverse    white

Accents
  --accent          sage-600   /* #7C9A8A approximation */
  --accent-hover    sage-700
  --accent-active   sage-800
  --accent-soft     sage-100

Semantic
  --success         emerald-600
  --success-soft    emerald-50
  --warning         amber-500
  --warning-soft    amber-50
  --danger          red-600
  --danger-soft     red-50
  --info            sky-600
  --info-soft       sky-50
```

## Espacements

```
--space-0     0
--space-1     0.25rem  /* 4px */
--space-2     0.5rem   /* 8px */
--space-3     0.75rem  /* 12px */
--space-4     1rem     /* 16px */
--space-5     1.25rem  /* 20px */
--space-6     1.5rem   /* 24px */
--space-8     2rem     /* 32px */
--space-10    2.5rem   /* 40px */
--space-12    3rem     /* 48px */
--space-16    4rem     /* 64px */
```

## Typo

```
--font-sans   system-ui, -apple-system, Segoe UI, sans-serif
--font-mono   ui-monospace, SFMono-Regular, monospace

--text-xs     0.75rem    line 1rem
--text-sm     0.875rem   line 1.25rem
--text-base   1rem       line 1.5rem
--text-lg     1.125rem   line 1.75rem
--text-xl     1.25rem    line 1.75rem
--text-2xl    1.5rem     line 2rem
--text-3xl    1.875rem   line 2.25rem

--font-normal      400
--font-medium      500
--font-semibold    600
--font-bold        700
```

Usage :
- Body                  text-sm
- Page H1               text-2xl semibold
- Section H2            text-lg semibold
- Card title            text-base semibold
- Helper text           text-xs muted
- Code/slugs            text-sm mono

## Border radius

```
--radius-none   0
--radius-sm     0.25rem  /* badges */
--radius        0.5rem   /* cards, inputs */
--radius-md     0.75rem  /* drawers, modals */
--radius-lg     1rem
--radius-full   9999px   /* avatars */
```

## Shadows

```
--shadow-sm    0 1px 2px rgba(0,0,0,0.05)
--shadow       0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)
--shadow-md    0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)
--shadow-lg    0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)
--shadow-xl    0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04)
```

## Motion

```
--duration-instant   0ms     /* prefers-reduced-motion */
--duration-fast      150ms   /* hover, focus */
--duration-base      250ms   /* drawer slide */
--duration-slow      400ms   /* page transitions, rare */

--easing-standard    cubic-bezier(0.4, 0, 0.2, 1)
--easing-decelerate  cubic-bezier(0, 0, 0.2, 1)
--easing-accelerate  cubic-bezier(0.4, 0, 1, 1)
```

`@media (prefers-reduced-motion: reduce)` → forcer `--duration-*` à 0.

## Z-index

```
--z-base          0
--z-dropdown      10
--z-sticky        20
--z-overlay       40   /* drawer overlay */
--z-modal         50
--z-popover       60   /* command palette */
--z-toast         70
--z-tooltip       80
```

## Implémentation Tailwind

Toutes les valeurs ci-dessus sont déjà disponibles en Tailwind v3 sauf
les accents `sage-*`. Étendre `tailwind.config.ts` :

```typescript
theme: {
  extend: {
    colors: {
      sage: {
        50:  '#F2F5F2',
        100: '#E2E9E5',
        200: '#C4D3CB',
        300: '#9FB6AC',
        400: '#7C9A8A',
        500: '#5F7F71',
        600: '#4D6A5E',  // accent default
        700: '#3F564C',
        800: '#34453E',
        900: '#2C3934',
      },
    },
  },
},
```

## Composants Radix → mapping tokens

Override les défauts Radix via styles :
- `<Dialog.Overlay>` : bg `rgba(0,0,0,0.5)`, z `--z-overlay`
- `<Dialog.Content>` : bg `--bg-surface`, radius `--radius-md`, shadow `--shadow-lg`
- `<DropdownMenu.Content>` : idem dialog mais radius `--radius`
- focus ring : `outline 2px solid var(--accent)`, offset 2px

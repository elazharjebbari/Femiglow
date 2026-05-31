# Typography

## Stack

```css
--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
--font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
```

Pas de webfont à charger — la system font est rapide, neutre, ok pour
admin (UX différente du site marketing qui utilise un serif éditorial).

## Échelle

| Token | Taille | Line-height | Usage |
|---|---|---|---|
| text-xs | 0.75rem (12px) | 1rem | meta, helper text |
| text-sm | 0.875rem (14px) | 1.25rem | body, table cells |
| text-base | 1rem (16px) | 1.5rem | forms, inputs |
| text-lg | 1.125rem (18px) | 1.75rem | section title |
| text-xl | 1.25rem (20px) | 1.75rem | card title, subhead |
| text-2xl | 1.5rem (24px) | 2rem | page H1 |
| text-3xl | 1.875rem (30px) | 2.25rem | dashboard hero (rare) |

## Weights

| Token | Value | Usage |
|---|---|---|
| font-normal | 400 | body |
| font-medium | 500 | labels, badges |
| font-semibold | 600 | headings, important |
| font-bold | 700 | rare (only big numbers) |

## Couleur text

| Token | Couleur | Usage |
|---|---|---|
| text-primary | stone-900 | body principal |
| text-secondary | stone-700 | body secondaire |
| text-muted | stone-500 | helper, meta, placeholder |
| text-disabled | stone-400 | disabled |
| text-inverse | white | sur fond foncé |
| text-accent | sage-600 | links, accent |
| text-danger | red-600 | erreurs |
| text-success | emerald-600 | succès |

## Patterns

### Title hierarchy (page admin emails)
```html
<h1 class="text-2xl font-semibold text-stone-900">  <!-- Page title -->
  Audiences
</h1>
<h2 class="text-lg font-semibold text-stone-900">   <!-- Section title -->
  Critères d'inclusion
</h2>
<h3 class="text-base font-medium text-stone-900">   <!-- Sub-section -->
  Commerce
</h3>
```

### Body text + helper
```html
<p class="text-sm text-stone-700">
  Cette audience cible les clientes ayant passé 3 commandes ou plus.
</p>
<p class="text-xs text-stone-500">
  Le slug ne peut plus changer après création.
</p>
```

### Code / mono
```html
<code class="font-mono text-sm bg-stone-100 px-1.5 py-0.5 rounded">
  clientes-vip
</code>
```

### Numbers (KPI)
```html
<div class="text-3xl font-semibold tabular-nums">1,243</div>
```

`tabular-nums` important pour stabilité visuelle quand les chiffres
changent.

## A11y

- Min text size body : 14px (text-sm)
- Line-height ≥ 1.5 sur body
- Aucun texte en `font-light` (300) sur fond clair (lisibilité)
- Bonne contraste primaire/secondaire (stone-900 sur white = 17:1 ✓)

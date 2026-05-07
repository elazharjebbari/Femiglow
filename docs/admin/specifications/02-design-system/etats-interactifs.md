# États interactifs

> Standardisation visuelle des 5 états de tout élément interactif :
> `default`, `hover`, `focus`, `active`, `disabled`. Plus l'état `loading`
> propre aux formulaires.

---

## Règles transverses

1. **Un état ne dépend jamais de la couleur seule** (a11y) : icône, weight,
   underline, ring.
2. **Focus visible toujours** : `outline-2 outline-offset-2 outline-encre/40`
   sur tout élément interactif.
3. **Transition** : `transition-colors duration-200` sur les changements
   de fond/texte. Pas de transition sur le focus ring (instantané).
4. **`prefers-reduced-motion`** : aucune animation au-delà de 80 ms.

## Boutons

### Primary

| État | Style |
|---|---|
| default | `bg-encre text-creme` |
| hover | `bg-encre/90` |
| focus | + `outline-2 outline-encre/40 outline-offset-2` |
| active | `bg-encre/80` (durée du clic) |
| disabled | `bg-encre/40 text-creme/80 cursor-not-allowed` |
| loading | spinner remplace le label, click désactivé |

### Secondary

| État | Style |
|---|---|
| default | `border border-encre/20 text-encre bg-transparent` |
| hover | `bg-encre/5` |
| focus | + outline ring |
| active | `bg-encre/10` |
| disabled | `border-encre/10 text-encre/40` |

### Danger

| État | Style |
|---|---|
| default | `bg-[#A33A3A] text-creme` |
| hover | `bg-[#8E2F2F]` |
| disabled | `bg-[#A33A3A]/40` |

### Ghost (link-like)

| État | Style |
|---|---|
| default | `text-encre underline decoration-encre/40 underline-offset-4` |
| hover | `decoration-encre` |
| focus | + outline ring |

## Inputs

| État | Style |
|---|---|
| default | `border border-encre/20 bg-creme text-encre` |
| hover | `border-encre/30` |
| focus | `border-encre outline-none ring-1 ring-encre/20` |
| filled (a value present) | `border-encre/40` |
| error | `border-[#A33A3A] ring-1 ring-[#A33A3A]/20` |
| disabled | `bg-encre/5 text-encre/40 cursor-not-allowed` |

## Lignes de tableau

| État | Style |
|---|---|
| default | `bg-creme` |
| stripe (n+1) | `bg-encre/5` |
| hover | `bg-encre/8` |
| selected (checkbox cochée) | `bg-champagne/30` |
| focus-within | `outline-2 outline-encre/30 outline-offset-[-2px]` |

## Liens dans tableau (vers `/admin/leads/[id]`)

```css
/* Toute la ligne devient cliquable via un <Link> wrapping un <tr>
   décoré avec position:relative et un ::after qui couvre la cellule.
   Évite d'avoir des liens imbriqués. */
```

## Statuts (badges)

Toujours `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
text-[11px] font-medium uppercase tracking-[0.1em]` plus la couleur de
fond + bordure :

| Statut lead | Style |
|---|---|
| `new` | `bg-ciel/30 text-encre border border-ciel/60` + dot ciel |
| `in_progress` | `bg-champagne/30 text-encre border border-champagne/60` + dot champagne |
| `converted` | `bg-sauge/30 text-encre border border-sauge/60` + ✓ |
| `closed` | `bg-encre/5 text-encre/60 border border-encre/20` |
| `duplicate` | `bg-encre/5 text-encre/40 border-dashed border border-encre/30` |

## Loading (formulaires)

```tsx
<Button disabled={isSubmitting}>
  {isSubmitting ? <LoadingSpinner /> : 'Enregistrer'}
</Button>
```

- Pas de skeleton sur les formulaires (le formulaire reste visible).
- Spinners 16 px alignés via `inline-flex items-center gap-2`.

## Skeleton (Server Components avec Suspense)

Sur les pages admin avec `loading.tsx` :

```tsx
// loading.tsx
export default function Loading() {
  return (
    <div className="space-y-3">
      <div className="h-12 w-full bg-encre/5 rounded" />
      <div className="h-12 w-full bg-encre/5 rounded" />
      <div className="h-12 w-full bg-encre/5 rounded" />
    </div>
  );
}
```

Pas d'animation pulse sous `prefers-reduced-motion: reduce`.

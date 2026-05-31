# Design tokens — badges et états

> Cohérence visuelle avec le système design FemiGlow (stone, emerald, amber, rose).

## 1. Palette badge `source`

| Source | bg | text | Hex bg | Usage |
|---|---|---|---|---|
| `chat_widget` | `bg-emerald-100` | `text-emerald-800` | `#d1fae5` / `#065f46` | Lead chat valide ✅ |
| `inline` | `bg-sky-100` | `text-sky-800` | `#e0f2fe` / `#075985` | Lead via phone détecté |
| `wizard_kit` | `bg-amber-100` | `text-amber-800` | `#fef3c7` / `#92400e` | Wizard (signal pollution si /admin/chat) |
| `wizard_commander` | `bg-amber-100` | `text-amber-800` | `#fef3c7` / `#92400e` | Wizard cart legacy |
| `newsletter` | `bg-violet-100` | `text-violet-800` | `#ede9fe` / `#5b21b6` | Newsletter signup |
| `admin` | `bg-stone-200` | `text-stone-800` | `#e7e5e4` / `#292524` | Saisie manuelle |

## 2. Palette badge `kind`

| Kind | bg | text | Hex bg | Visible où |
|---|---|---|---|---|
| `chat` | `bg-emerald-100` | `text-emerald-800` | `#d1fae5` / `#065f46` | Default — masqué sauf debug |
| `wizard_pivot` | `bg-amber-100` | `text-amber-800` | `#fef3c7` / `#92400e` | Visible en mode `?debug=ghosts` |
| `system` | `bg-violet-100` | `text-violet-800` | `#ede9fe` / `#5b21b6` | Cas rares (newsletter standalone) |

## 3. Couleurs par état (rows)

| État | Background row | Bordure |
|---|---|---|
| Default (chat normal) | `hover:bg-stone-50` | aucune |
| `kind=wizard_pivot` (debug) | `bg-amber-50/40 hover:bg-amber-50` | aucune |
| Converted (chat) | `bg-emerald-50/70 hover:bg-emerald-50` | aucune |
| Overdue (Hot pending > SLA) | `bg-rose-50 hover:bg-rose-100` | aucune |
| Archived (ghost orphelin nettoyé) | `bg-stone-100/50 text-stone-500` | aucune |

## 4. Typographie

| Élément | Classe |
|---|---|
| Heading page admin | `text-2xl font-semibold tracking-tight` |
| Sous-titre / description | `text-sm text-stone-600` |
| Badge | `text-xs font-medium` (compact : `text-[10px]`) |
| ID monospace | `font-mono text-xs` |
| Compteurs KPI | `text-xl font-semibold tabular-nums` |

## 5. Spacing & layout

| Élément | Classe |
|---|---|
| Card panel | `rounded-md border border-stone-200 bg-white p-4` |
| Inter-section gap | `space-y-4` ou `gap-4` |
| Badge gap (icon + label) | `gap-1` |
| Table header | `bg-stone-50 text-left text-xs uppercase text-stone-500` |
| Cell padding | `px-3 py-2` |

## 6. Tokens spéciaux pour le mode debug

```css
/* Bandeau debug en haut de page */
.debug-banner {
  @apply rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900;
}

/* Filigrane "DEBUG" sur les vues */
.debug-watermark {
  @apply pointer-events-none fixed bottom-4 right-4 select-none
         rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700;
}
```

## 7. Cohérence avec le reste de l'admin

Les nouvelles couleurs respectent la palette existante :
- `stone` pour neutres
- `emerald` pour succès / chat valide
- `amber` pour signaux d'attention / pollution
- `rose` pour erreurs / overdue
- `sky` pour informations / inline
- `violet` pour cas spéciaux / system

**Aucun nouveau token n'est introduit** — on réutilise les tokens Tailwind déjà utilisés dans `/admin/leads`, `/admin/chat/care`, etc.

## 8. Dark mode (si applicable)

Le projet ne semble pas activement supporter dark mode pour l'admin. Si on l'ajoute plus tard, les badges devront avoir les variantes :

```tsx
className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200"
```

Pas requis pour ce sprint.

## 9. Animations

Aucune animation ajoutée. Les badges restent statiques pour ne pas distraire l'admin (focus = scan rapide de la table).

Exception : la confirmation cleanup peut avoir un fade-in léger via Framer Motion ou simple CSS transition, optionnel.

## 10. Iconographie

Pour éviter les emojis (cf. user instructions du projet : pas d'emojis dans le code), utiliser des composants SVG ou les caractères Unicode neutres :

```tsx
const SOURCE_SYMBOLS: Record<string, string> = {
  chat_widget: '●',      // disque plein
  inline: '↳',           // flèche retour
  wizard_kit: '◇',       // losange creux
  wizard_commander: '◆', // losange plein
  newsletter: '✉',       // enveloppe (Unicode)
  admin: '⚙',            // engrenage
};
```

Ou utiliser des icônes Lucide (SVG inline) si disponibles dans le projet. Cohérence avec l'admin existant.

## 11. Récap rapide pour le dev

Quand on touche aux badges, respecter :
1. **Bordure** : aucune sauf si dans un panel `border border-stone-200`.
2. **Padding** : `px-2 py-0.5` (normal) ou `px-1.5 py-0.5` (compact).
3. **Border radius** : `rounded-full` (badge pill) ou `rounded` (badge carré pour kind).
4. **Min-width** : laisser content-driven, pas de `min-w-*`.
5. **Truncate** : pas requis pour badges (texte court).
6. **A11y** : `title=` ou `aria-label=` obligatoire si tooltip ; `aria-hidden` sur les symbols décoratifs.

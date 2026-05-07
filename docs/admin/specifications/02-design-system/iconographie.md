# Iconographie — admin

> SVG inline uniquement. Aucune lib d'icônes externe (lucide-react,
> heroicons, etc.) pour rester en cohérence avec l'approche du repo
> (icônes dessinées à la main, stroke 1.5 px).

---

## Conventions

| Attribut | Valeur |
|---|---|
| viewBox | `0 0 24 24` |
| stroke | `currentColor` |
| stroke-width | `1.5` |
| stroke-linecap | `round` |
| stroke-linejoin | `round` |
| fill | `none` (sauf cas particuliers : flèches, points pleins) |
| size par défaut | 18 px (`w-[18px] h-[18px]`) |

## Jeu d'icônes admin

Les icônes ci-dessous sont à dessiner à la main et placer dans
`apps/web/src/components/admin/icons/`.

| Nom | Usage | Description visuelle |
|---|---|---|
| `IconHome` | Sidebar — Dashboard | maison à 5 traits |
| `IconLeads` | Sidebar — Leads | enveloppe stylisée |
| `IconWebhook` | Sidebar — Webhooks | deux maillons enchaînés |
| `IconLogout` | Header — Déconnexion | flèche sortant d'une porte |
| `IconSearch` | Input recherche | loupe simple |
| `IconFilter` | Bouton filtres | entonnoir 3 lignes |
| `IconChevronDown` | Dropdowns | chevron 12 px |
| `IconChevronRight` | Breadcrumb, pagination | chevron 12 px |
| `IconCheck` | Confirmation | coche simple |
| `IconX` | Fermeture, dismiss | croix |
| `IconCopy` | Copier secret | deux rectangles superposés |
| `IconRefresh` | Replay webhook | flèche circulaire |
| `IconAlert` | Erreur livraison | triangle ! |
| `IconClock` | Pending | horloge |
| `IconExternalLink` | Lien sortant | flèche vers haut-droit |
| `IconTrash` | Suppression | poubelle |
| `IconEdit` | Édition | crayon |
| `IconEye` / `IconEyeOff` | Show/hide secret | œil + slash |

## Exemple type

```tsx
// apps/web/src/components/admin/icons/IconLeads.tsx
export function IconLeads({ className = 'w-[18px] h-[18px]' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="18" height="13" rx="1.5" />
      <path d="M3 8 12 14 21 8" />
    </svg>
  );
}
```

## Règles d'usage

1. **Toujours `aria-hidden="true"`** quand l'icône est décorative
   (suivie d'un label texte).
2. **`role="img"` + `aria-label`** quand l'icône **remplace** un
   texte (ex. bouton fermeture seule).
3. **Couleur** héritée via `currentColor` → un parent `text-encre/60`
   colore l'icône.
4. **Pas de hover sur l'icône seule** : le hover concerne toujours le
   bouton/lien parent.

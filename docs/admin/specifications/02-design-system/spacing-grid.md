# Spacing & grille — admin

## Échelle d'espacement

| Token | Valeur | Usage |
|---|---|---|
| `space-1` | 4 px | gap minimum entre icône et label |
| `space-2` | 8 px | padding vertical petit |
| `space-3` | 12 px | gap inline standard |
| `space-4` | 16 px | padding cellule de tableau |
| `space-6` | 24 px | gap entre sections d'un panneau |
| `space-8` | 32 px | gap entre blocs majeurs |
| `space-12` | 48 px | marge supérieure h1 |
| `space-16` | 64 px | gap entre sections page |

Chaque valeur est un multiple de 4 px (cohérence avec base Tailwind).

## Grille de page admin

```
┌──────────────────────────────────────────────────────────────────┐
│ AdminHeader (sticky, h-14)                                       │
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                       │
│ Sidebar  │   Content area                                        │
│ (w-56)   │   (max-w-5xl, mx-auto, px-8 py-12)                   │
│          │                                                       │
│ Nav      │   <h1>                                                │
│  Dashbd  │                                                       │
│  Leads   │   <Section>                                           │
│  Webhks  │     ...                                               │
│          │   </Section>                                          │
│          │                                                       │
└──────────┴───────────────────────────────────────────────────────┘
```

| Élément | Largeur |
|---|---|
| AdminHeader | 100% viewport |
| Sidebar | 224 px (`w-56`) fixe |
| Content max-width | 1024 px (`max-w-5xl`) |
| Content padding horizontal | 32 px (`px-8`) |
| Content padding vertical | 48 px (`py-12`) |

## Breakpoints

| Token | Valeur | Comportement admin |
|---|---|---|
| sm | 640 px | Sidebar masquée, hamburger menu |
| md | 768 px | Sidebar masquée, drawer |
| lg | 1024 px | Sidebar fixe visible |
| xl | 1280 px | inchangé |
| 2xl | 1536 px | inchangé |

## Règles

1. **Touche-tap** ≥ 44 × 44 px sur tous les éléments interactifs (a11y).
2. **Padding cellule tableau** : `px-4 py-3` minimum.
3. **Espacement intra-formulaire** : `space-y-6` entre champs.
4. **Marge sous h1** : `mb-8`.
5. **Marge sous h2** : `mb-4`.

## Densité

L'admin privilégie une densité **moyenne** : ni table compacte 28 px de
hauteur (illisible pour la fondatrice), ni table aérée 64 px (peu de
leads visibles d'un coup).

| Élément | Hauteur cible |
|---|---|
| Ligne tableau | 48 px |
| Bouton primary | 44 px |
| Input | 44 px |
| Badge statut | 24 px |

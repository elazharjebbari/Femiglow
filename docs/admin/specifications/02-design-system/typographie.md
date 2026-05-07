# Typographie — admin

> Cormorant Garamond pour les titres et la signature ; Inter pour les
> données, les boutons, les libellés. Pas d'autre famille.

---

## Hiérarchie

| Niveau | Famille | Taille | Poids | Tracking | Usage |
|---|---|---|---|---|---|
| `display` | Cormorant Garamond | 36 / 48 px | 400 | -0.01em | Titre de page (h1) `« Leads »` |
| `heading` | Cormorant Garamond | 28 px | 400 | -0.01em | Titre de section (h2) |
| `subheading` | Inter | 20 px | 600 | 0 | Titre de sous-section (h3) |
| `body` | Inter | 15 px | 400 | 0 | Corps de texte, descriptions |
| `tabular` | Inter | 14 px | 400 (500 en-têtes) | 0 | Tableaux, listes denses |
| `metadata` | Inter | 13 px | 400 | 0 | Dates, IDs, IP, UA |
| `kicker` | Inter | 11 px | 500 | 0.18em uppercase | Surtitres, labels de groupe |

## Règles d'application

1. **Une seule h1 par page** — toujours Cormorant 36 px.
2. **Pas de Cormorant en dessous de 20 px** (illisible en gras petit).
3. **Pas d'Inter au-dessus de 28 px** (réservé Cormorant pour la
   chaleur).
4. **Tabular-nums activé** (`font-variant-numeric: tabular-nums`) sur
   tous les tableaux de chiffres pour alignement.
5. **Aucune italique** sauf citations rares.
6. **Aucun underline** sauf liens textuels (jamais sur les boutons).

## Exemples Tailwind

```tsx
// Titre de page
<h1 className="font-display text-4xl tracking-tight text-encre">
  Leads
</h1>

// Surtitre kicker
<span className="text-[11px] font-medium uppercase tracking-[0.18em] text-encre/60">
  Statut
</span>

// Tableau
<td className="px-4 py-3 font-body text-sm tabular-nums text-encre/90">
  3 mai 2026, 15:32
</td>

// Métadonnée
<span className="font-body text-[13px] text-encre/60">
  cmokk1o9v08cer3tvasgohtw6
</span>
```

## Mesures verticales

| Niveau | line-height | margin-bottom |
|---|---|---|
| h1 | 1.1 | 1.5rem |
| h2 | 1.2 | 1rem |
| h3 | 1.3 | 0.75rem |
| body | 1.6 | 1rem |
| tabular | 1.4 | 0 |

## Comportement responsive

| Breakpoint | h1 | h2 | body |
|---|---|---|---|
| < 640 (mobile) | 30 px | 24 px | 15 px |
| ≥ 640 (sm) | 32 px | 26 px | 15 px |
| ≥ 1024 (lg) | 36 px | 28 px | 15 px |

L'admin est optimisée **desktop first** (≥ 1024 px). Mobile reste
fonctionnel mais non prioritaire (la fondatrice utilise majoritairement
un laptop).

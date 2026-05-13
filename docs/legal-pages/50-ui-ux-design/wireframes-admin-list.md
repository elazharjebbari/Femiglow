# 50.3 — Wireframe : liste admin

## Vue : `/admin/legal`

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ◀ Admin   /  Pages légales                                ❓  👤 Maya ▾ │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Pages légales                                       [+ Nouvelle page]  │
│ Gérez le contenu, les placements et la conformité.                      │
│                                                                         │
│ ┌─────────┬─────────┬─────────┬─────────┬─────────────────────────┐    │
│ │ Total   │ Publiées│ Drafts  │ Reviews │ Liens cassés (footer)   │    │
│ │   9     │   7     │   2     │   0     │   0   ✓                 │    │
│ └─────────┴─────────┴─────────┴─────────┴─────────────────────────┘    │
│                                                                         │
│ [Tous] [Drafts] [En revue] [Publiées]    🔍 Rechercher    [⚙ Filtre]   │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐    │
│ │ Titre                  │Statut │ Version│ Maj           │Action │    │
│ ├─────────────────────────────────────────────────────────────────┤    │
│ │ ★ Mentions légales     │ ✓ pub │ v3     │ 11/05/2026   │  ✏ 👁  │    │
│ │ ★ CGV                  │ ✓ pub │ v5     │ 11/05/2026   │  ✏ 👁  │    │
│ │ ★ Pol. confidentialité │ ✓ pub │ v2     │ 09/05/2026   │  ✏ 👁  │    │
│ │ ★ Pol. cookies         │ ✓ pub │ v2     │ 09/05/2026   │  ✏ 👁  │    │
│ │ ★ Pol. retours         │ ✓ pub │ v1     │ 02/05/2026   │  ✏ 👁  │    │
│ │ ★ Pol. livraison       │ ✓ pub │ v1     │ 02/05/2026   │  ✏ 👁  │    │
│ │ ★ Sécurité produits    │ ⏳ rev│ v2 dft │ il y a 1j    │  ✏     │    │
│ │   CGU                  │ ✏ dft │ v0     │ il y a 2j    │  ✏     │    │
│ │   FAQ                  │ ✓ pub │ v1     │ 28/04/2026   │  ✏ 👁  │    │
│ └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│ ★ = page obligatoire (critique)                                         │
│                                                                         │
│ ─────────────────────────────────────────────────────────────────────  │
│ ⚙ Liens rapides :                                                       │
│   → Matrice page × zone                                                 │
│   → Variables template (RC, ICE, …)                                     │
│   → Dashboard santé (liens, cron, alerts)                               │
│   → Historique des publications                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## États & interactions

### Filtres

`[Tous] [Drafts] [En revue] [Publiées]` : pills mutuellement exclusives. Active = fond rose-100, texte rose-800.

### Recherche

Input avec debounce 200ms. Recherche dans titre + slug.

### Tri

Colonnes cliquables : Titre, Statut, Version, Maj. Indicateur ↑↓.

### Bulk actions

Checkbox en début de ligne → barre d'action en bas : Archiver, Soumettre à revue.

### Hover sur ligne

- Background : stone-50
- Curseur : pointer
- Actions inline : ✏ (édit), 👁 (preview public), ↻ (history), 🗃 (archive)

### Status badges

| Statut | Background | Texte |
|---|---|---|
| ✓ published | green-100 | green-800 |
| ⏳ review | amber-100 | amber-800 |
| ✏ draft | blue-100 | blue-800 |
| 📦 archived | stone-200 | stone-600 |

### KPIs en haut

Card cliquable → applique le filtre correspondant.

### Empty state

Si aucune page (jamais possible vu seeder) :

```
🪶
Aucune page légale.
Le seeder devrait avoir initialisé les pages standard.
[Lancer le seeder]
```

## A11y

- Tableau : `<table role="grid">`, en-têtes `<th scope="col">`
- Actions inline : `<button aria-label="Modifier mentions légales">`
- Tabs : `role="tablist"`, `aria-selected`
- Pas de drag-and-drop nécessaire ici

## Mobile

Tableau → cards stackées :

```
┌──────────────────────────────┐
│ Mentions légales             │
│ ✓ Publiée · v3               │
│ Mis à jour le 11/05/2026     │
│ [Modifier] [Aperçu]          │
└──────────────────────────────┘
```

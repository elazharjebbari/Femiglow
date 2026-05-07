# Frontend — UI admin

L'interface admin SEO se compose de **3 vues** :

- `/admin/seo` (liste)
- `/admin/seo/[scope]/[targetKey]` (détail / éditeur)
- `/admin/seo/settings` (singleton)

Toutes héritées d'`AdminShell` (`requireAdmin()` RSC, NAV item « SEO »).

## `/admin/seo` — Liste

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  SEO                                            [+ Nouveau]      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Filtres : [scope ▼] [statut ▼] [recherche ____]            │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌──────────┬──────────┬───────────┬─────────┬────────┬───────┐  │
│  │ Cible    │ Scope    │ Title     │ Audit   │ Statut │ Maj   │  │
│  ├──────────┼──────────┼───────────┼─────────┼────────┼───────┤  │
│  │ home     │ page     │ FemiGlow  │ 92 ✓   │ Publ.  │ il y a│  │
│  │ kit      │ page     │ Le Kit…   │ 78 ⚠   │ Draft  │ 5 min │  │
│  │ rituel-1 │ article  │ Rituel…   │ 45 ✗   │ Draft  │ 1 j   │  │
│  └──────────┴──────────┴───────────┴─────────┴────────┴───────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Comportements

- Tri par `updated_at` desc par défaut
- Ligne cliquable → `/admin/seo/[scope]/[targetKey]`
- Badge audit coloré : vert ≥ 80, ambre 50-79, rouge < 50
- Bouton **+ Nouveau** ouvre une modale :
  - Champ `scope` (select)
  - Champ `targetKey` (autocomplete sur `known_pages` si scope=page)
  - Bouton **Créer un brouillon** → redirection page détail

### États vides

Si aucun override : afficher une carte « Tout est aux défauts du
code. Crée un override pour personnaliser une cible. »

## `/admin/seo/[scope]/[targetKey]` — Détail

### Layout 2 colonnes

```
┌──────────────────────────────┬────────────────────────────────┐
│  Édition                     │  Aperçu / Audit                │
│                              │                                │
│  [Onglet : Général | OG |   │  [Tabs : SERP | FB | Twitter] │
│   Twitter | JSON-LD]         │                                │
│  ────────────────────────────│  ────────────────────────────  │
│  Title       [____________]  │  ┌──────────────────────────┐ │
│  Description [____________]  │  │ Google preview live      │ │
│  Canonical   [____________]  │  └──────────────────────────┘ │
│  Robots      [☑ index] [☑ f] │                                │
│  Keywords    [chips: ......] │  ────── Audit ──────           │
│                              │  ⚠ title 65 chars (max 60)    │
│  [Annuler]   [Sauver draft]  │  ✓ description OK              │
│              [Publier]       │  ✗ canonical relative          │
└──────────────────────────────┴────────────────────────────────┘
```

### États

- **Draft only** : badge « Brouillon » + dernier publish affiché si historique
- **Published == Draft** : badge « Publié »
- **Published ≠ Draft** : badge « Modifications non publiées »

### Actions

- **Sauver draft** (Ctrl+S) : PATCH, mise à jour `drafted_at`
- **Publier** : POST `/publish`, refusé si erreurs linter (severity=error)
- **Annuler** : ramène draft = published (PATCH avec payload published)
- **Restaurer un snapshot** : onglet **Historique** (cf. Phase D)

### Save optimiste

Pattern aligné components-CMS : reducer `useReducer` + dirty
tracking. Le bouton **Sauver** flash un succès et le badge
« Modifications non publiées » apparaît.

## `/admin/seo/settings` — Singleton

Form simple avec :

- `siteName`
- `defaultDescription` (textarea)
- `twitterHandle`
- `defaultRobotsIndex` / `defaultRobotsFollow` (toggles)
- `defaultOgImageMediaId` → MediaPicker
- `organizationJsonLd` → textarea + bouton **Valider** (parse JSON
  côté client, puis Zod côté serveur au PATCH)

Pas de notion de draft sur les settings : PATCH = publication directe
(c'est un singleton de defaults, pas un brouillon par cible).

## Composants partagés

| Composant            | Fichier                                          | Rôle |
|----------------------|--------------------------------------------------|------|
| `SeoEditorShell`     | `components/admin/seo/SeoEditorShell.tsx`        | Layout 2 colonnes |
| `SerpPreview`        | `components/admin/seo/previews/SerpPreview.tsx`  | Carte Google |
| `FacebookPreview`    | `components/admin/seo/previews/FacebookPreview.tsx` | Carte FB |
| `TwitterPreview`     | `components/admin/seo/previews/TwitterPreview.tsx`| Carte Twitter |
| `SeoLinterPanel`     | `components/admin/seo/SeoLinterPanel.tsx`        | Liste règles + sévérités |
| `KeywordsField`      | `components/admin/seo/fields/KeywordsField.tsx`  | Chips input |
| `OgImageField`       | `components/admin/seo/fields/OgImageField.tsx`   | MediaPicker + template select |
| `JsonLdField`        | `components/admin/seo/fields/JsonLdField.tsx`    | Textarea + parse |

## A11y

- Labels explicites partout
- `aria-invalid` sur chaque champ avec erreur
- Live region `role="status"` pour annonces save/publish
- Focus management : focus restauré sur le bouton qui a ouvert une modale
- Contraste : WCAG AA sur les badges audit (vert/ambre/rouge testés)

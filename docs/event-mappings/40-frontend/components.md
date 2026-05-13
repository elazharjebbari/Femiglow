# 40.1 — Composants frontend

> Inventaire de tous les composants React, leur responsabilité, leur état,
> leurs interactions, et les data-testid pour Playwright.

## Arborescence

```
app/admin/tracking/events/mappings/
├── page.tsx                       (server: list versions)
├── [id]/
│   ├── page.tsx                   (server: view version)
│   └── edit/
│       └── page.tsx               (server: editor — wrapping client)
└── compare/
    └── [a]/
        └── [b]/
            └── page.tsx           (server: diff view)

components/admin/tracking/mappings/
├── MappingVersionsList.tsx        (client, liste + filtres)
├── MappingVersionCard.tsx         (client, card item)
├── MappingVersionEditor.tsx       (client, wizard + matrice)
├── MappingMatrix.tsx              (client, tableau pivot)
├── MappingCellEditor.tsx          (client, cellule éditable)
├── MappingDiffViewer.tsx          (client, diff side-by-side)
├── MappingTestModal.tsx           (client, modal dry-run test)
├── MappingExportButton.tsx        (client, bouton + modal env)
├── MappingResetDefaultButton.tsx  (client, bouton + confirm)
├── MappingImportButton.tsx        (client, import depuis fichier JSON)
├── MappingAuditTimeline.tsx       (client, historique d'une version)
└── MappingCreateWizard.tsx        (client, wizard 3 étapes)
```

## Composant : `MappingVersionsList`

**Responsabilité** : Affiche la liste des versions avec filtres et actions globales.

**Props** :
```typescript
interface Props {
  initialVersions: MappingVersionListItem[];
  activeId: string | null;
  defaultId: string;
}
```

**State** :
- `statusFilter: 'all' | 'draft' | 'active' | 'archived' | 'deleted'` (default: omit deleted)
- `showDeleted: boolean` (toggle)
- `selectedForCompare: string[]` (max 2)

**Interactions** :
- Click "Créer version" → ouvre `MappingCreateWizard`
- Click "Reset au default" → ouvre `MappingResetDefaultButton` modal
- Click "Comparer 2 versions" → si selectedForCompare.length=2 → navigate /compare/:a/:b
- Click "Activer version X" → confirm modale → POST /activate
- Click "Archiver version X" → confirm → POST avec status=archived
- Click "Soft-delete X" → confirm → DELETE
- Click "Restaurer X" → POST status=archived
- Click "Éditer X" → navigate /[id]/edit

**data-testid** :
- `mapping-versions-list`
- `version-row-{id}`
- `btn-activate-{id}`, `btn-archive-{id}`, `btn-delete-{id}`, `btn-edit-{id}`, `btn-restore-{id}`
- `btn-create-version`, `btn-reset-default`
- `version-status-{id}` (badge)

## Composant : `MappingMatrix`

**Responsabilité** : Tableau pivot Event × Provider, chaque cellule éditable.

**Props** :
```typescript
interface Props {
  mappings: Mappings;
  readOnly?: boolean;        // true si is_default
  onChange?: (next: Mappings) => void;
  highlightedCells?: Array<{ event: string; provider: ProviderKind }>; // pour diff
}
```

**State** :
- `editingCell: { event, provider } | null`
- `localMappings` (clone profond, sync onChange)

**UX** :
- Lignes = events (sticky col gauche)
- Colonnes = providers (sticky header)
- Cellule cliquée → `MappingCellEditor` inline (pop-over)
- Indicateurs visuels :
  - 🚫 si `mappedName=null` ou `isEnabled=false`
  - ⚡ si `isCustom=true` (badge "Custom")
  - 📝 si `notes` non-null (tooltip)
- Recherche par event en haut (filtre live)
- Sticky row "events conversion only" toggle

**Accessibilité** :
- `<table>` avec `<caption>`, `<thead>`, `<tbody>`
- Navigation clavier arrow keys entre cellules (style Excel)
- Tab cycle dans les inputs au sein d'une cellule en édition
- Esc ferme l'éditeur sans save

**data-testid** :
- `mapping-matrix`
- `mapping-cell-{event}-{provider}`
- `cell-editor-{event}-{provider}`

## Composant : `MappingCellEditor`

**Responsabilité** : Éditeur popover d'une cellule (`{mappedName, isCustom, isEnabled, notes}`).

**Props** :
```typescript
interface Props {
  cell: MappingCell;
  provider: ProviderKind;     // pour validation par provider
  event: string;
  onSave: (next: MappingCell) => void;
  onCancel: () => void;
}
```

**UI** :
```
┌──────────────────────────────────┐
│ purchase × meta                  │
├──────────────────────────────────┤
│ mappedName: [Purchase____]        │
│   ⚠ doit matcher ^[A-Za-z]...    │
│                                    │
│ ☐ Custom event Meta (trackCustom)│
│ ☐ Activé (par défaut ✓)          │
│                                    │
│ Notes (optionnel):                 │
│ [_________________]                │
│                                    │
│        [Annuler] [Sauvegarder]    │
└──────────────────────────────────┘
```

- Validation Zod live (regex par provider) → erreur inline rouge
- Bouton "Sauvegarder" disabled tant qu'erreur ou pas de modif
- Esc/clic externe → onCancel
- Enter → onSave si valide

## Composant : `MappingCreateWizard`

**Responsabilité** : Modal multi-étapes pour créer une nouvelle version.

**Étapes** :
1. **Mode** : depuis default | depuis existante | depuis fichier JSON import
2. **Nom & notes** : champs texte
3. **Récap & confirme** : preview du nombre d'events, lien vers prévisualisation

**State machine** :
```
step1 (mode) → step2 (name/notes) → step3 (confirm)
            ↑                       ↑
            └── back ←──── back ────┘
```

Validation chaque step avant Next. Si import → load file + validate JSON avant step2.

## Composant : `MappingDiffViewer`

**Responsabilité** : Affiche le diff entre 2 versions, côte à côte (side-by-side) ou inline.

**Props** :
```typescript
interface Props {
  versionA: MappingVersion;
  versionB: MappingVersion;
  mode?: 'side-by-side' | 'inline';
}
```

**UX** :
- Toggle "side-by-side" vs "inline" en haut
- Liste filtrable des cellules modifiées :
  - 🟢 Ajouté (vide A → rempli B)
  - 🔴 Supprimé (rempli A → vide B)
  - 🟡 Modifié (rempli A → rempli B différent)
- Click sur une ligne → scroll to + highlight dans la matrice rendue ci-dessous
- Bouton "Adopter cette version" → activate de B (ou A)

## Composant : `MappingTestModal`

**Responsabilité** : Permet de "tester" une version sans appel réseau réel.

**UI** :
```
┌────────────────────────────────────┐
│ Tester le dispatching              │
├────────────────────────────────────┤
│ Event à simuler :                  │
│  ◉ purchase                        │
│  ○ form_start                       │
│  ○ ... (dropdown 30 events)        │
│                                    │
│ Params custom (optionnel JSON) :    │
│  [_________________________]        │
│                                    │
│        [Lancer le test]             │
├────────────────────────────────────┤
│ Résultats :                          │
│                                    │
│ Meta       ✅ Purchase (standard)  │
│ GA4        ✅ purchase             │
│ Google Ads ✅ purchase             │
│ TikTok     ✅ CompletePayment      │
│ Snap       ✅ PURCHASE             │
│ Pinterest  🚫 disabled              │
└────────────────────────────────────┘
```

Pas de réseau, pas de side effect. Juste appelle `resolveEventMapping()` pour chaque provider.

## Composant : `MappingExportButton`

**Props** : `{ versionId, versionName }`

**UI** : bouton + modal de sélection environnement (production/stage/preview/dev). Sur confirm → fetch + download du fichier.

## Composant : `MappingResetDefaultButton`

Bouton avec icône ↩, visible seulement si `activeId !== defaultId`. Modal confirm verbeux (cf. wireframes).

## State management

- Pas de Redux/Zustand : tout en local component state + `useSWR` ou similar pour cache HTTP
- Hook custom `useMappings()` qui wraps fetch + cache + invalidation après mutation

## Routing

- `/admin/tracking/events/mappings` → liste
- `/admin/tracking/events/mappings/[id]` → détail (read-only matrice)
- `/admin/tracking/events/mappings/[id]/edit` → édition (matrice éditable)
- `/admin/tracking/events/mappings/compare/[a]/[b]` → diff
- `/admin/tracking/events/mappings/[id]/audit` → timeline historique

## Performance

- `MappingMatrix` virtualisé si > 50 events (V2)
- `MappingDiffViewer` ne calcule le diff que côté client (pas de fetch /diff/:a/:b si on a déjà les 2 versions)
- Lazy import du JSON parser pour import (split bundle)

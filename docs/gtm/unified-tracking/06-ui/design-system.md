# Design System — Tokens et primitives

## 1. Tokens existants (réutilisés)

Tirés de `apps/web/src/styles/tokens.css`.

### 1.1 Couleurs FemiGlow

```css
/* Brand */
--color-sauge:        /* vert sauge, brand primaire FemiGlow */
--color-creme:        /* crème, fond doux */
--color-encre:        /* gris très foncé, texte principal */

/* Neutres */
--color-stone-50, --color-stone-100, ... --color-stone-900

/* Roses (accents) */
--color-rose-50, --color-rose-200, --color-rose-400, --color-rose-600

/* États */
--color-success:      /* vert sauge confirmation */
--color-warning:      /* ambre */
--color-error:        /* rouge brique */
--color-info:         /* bleu doux */
```

### 1.2 Typographie

```css
--font-cormorant      /* Cormorant Garamond — titres H1, H2 */
--font-inter          /* Inter — corps + UI */
--font-mono           /* JetBrains Mono — code, JSON preview */
```

Hiérarchie :
- `H1` : Cormorant 32px, weight 500, line-height 1.15
- `H2` : Cormorant 24px, weight 500
- `H3` : Inter 18px semibold
- `H4` : Inter 16px semibold
- `Body` : Inter 16px regular, line-height 1.6
- `Small` : Inter 14px regular
- `Code` : JetBrains Mono 14px

### 1.3 Espacements

Tailwind defaults : `space-1`(4px) → `space-12`(48px) → `space-24`(96px).

### 1.4 Rayons

- `rounded-sm` (2px) : badges, chips
- `rounded` (4px) : inputs, boutons
- `rounded-md` (6px)
- `rounded-lg` (8px) : cards
- `rounded-xl` (12px) : panneaux importants
- `rounded-2xl` (16px) : conteneurs (composer chat, modale)

### 1.5 Ombres

```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.04)
--shadow:    0 2px 4px rgba(0,0,0,0.06)
--shadow-md: 0 4px 12px rgba(0,0,0,0.08)
--shadow-lg: 0 10px 25px rgba(0,0,0,0.10)
```

## 2. Nouveaux tokens spécifiques tracking

```css
/* Statut santé tracking */
--color-status-ok:       #5a8a6f  /* sauge profond */
--color-status-warning:  #c08a3e  /* ambre */
--color-status-critical: #b54848  /* rouge brique */

/* Code JSON preview */
--color-code-bg:         #1e1e1e
--color-code-fg:         #d4d4d4
--color-code-key:        #9cdcfe  /* bleu clair */
--color-code-string:     #ce9178  /* orange */
--color-code-number:     #b5cea8  /* vert */
--color-code-comment:    #6a9955  /* vert foncé */
```

## 3. Primitives partagées avec autres modules admin

Réutilise depuis `apps/web/src/components/ui/` (à créer si pas existant) :

- `<Button variant="primary|secondary|ghost|destructive" size="sm|md|lg" />`
- `<Input type="text|email|number" />`
- `<Switch checked onCheckedChange />`
- `<Select options={} value onChange />`
- `<Tabs value onValueChange tabs={[...]} />`
- `<Dialog open onOpenChange title content />`
- `<Toast type="success|error|info" message />`
- `<Tooltip content trigger />`
- `<Badge variant="default|success|warning|error" />`

## 4. Composants composés (tracking-specific)

| Composant | Usage |
|---|---|
| `<StatusCard plan sync />` | Carte home affichant le statut santé global |
| `<ProviderCard kind enabled config />` | Card par provider (Step 1+2) |
| `<IdInput label value onChange autocomplete />` | Input ID avec autocomplete + placeholder warning |
| `<EventMatrixRow event mappings onChange />` | Ligne dans la matrice (Step 3) |
| `<EnvProfileForm env profile onChange />` | Form par environnement (Step 4) |
| `<JsonPreview json highlight />` | Preview JSON syntax-highlighted |
| `<DiffViewer left right />` | Diff entre 2 plans / 2 versions |
| `<ValidationBadge errors warnings />` | Badge inline `2 errors, 1 warning` |
| `<BundleIdChip bundleId />` | Affiche bundleId court avec copy + tooltip |
| `<HelpTooltip text image />` | Icône `?` avec popover explicatif |

## 5. États visuels universels

| État | Indicateur visuel |
|---|---|
| Loading | Skeleton (gris animé) |
| Empty | Illustration + texte + CTA |
| Error | Card rouge clair + icône ⚠ + bouton retry |
| Saved | Toast vert "✓ Sauvegardé" 2s |
| Dirty (non sauvé) | Badge en haut "modifications non enregistrées" |
| Active (plan actif) | Liseré sauge + badge "Actif" |

## 6. Iconographie

Icônes 24×24 SVG (style Phosphor / Lucide léger), trait 2px, stroke `currentColor`.

| Icône | Usage |
|---|---|
| `Settings` | Configuration générale |
| `Tags` | Outils tracking |
| `Shuffle` | Mapping events |
| `Server` | Server-side, env profiles |
| `Activity` | Sync status, drift |
| `CheckCircle2` | Validation OK |
| `AlertCircle` | Validation error |
| `AlertTriangle` | Warning |
| `Eye` | Preview |
| `Download` | Export |
| `Copy` | Copy to clipboard |
| `ChevronRight` | Next step |
| `RotateCcw` | Revert |

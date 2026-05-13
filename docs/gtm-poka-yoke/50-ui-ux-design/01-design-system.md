# Design System — Poka-Yoke GTM

## Tokens couleurs (basés sur le DS FemiGlow existant)

| Token | Hex | Usage |
|---|---|---|
| `--color-status-ok` | `#10b981` (emerald-500) | Drift OK |
| `--color-status-warning` | `#f59e0b` (amber-500) | Drift warning |
| `--color-status-critical` | `#dc2626` (red-600) | Drift critical |
| `--color-banner-bg-critical` | `#fef2f2` (red-50) | Banner fond rouge clair |
| `--color-banner-bg-warning` | `#fffbeb` (amber-50) | Banner fond orange clair |

## Composants Tailwind classes

### Badge statut
```html
<!-- OK -->
<span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
  ✓ OK
</span>

<!-- Warning -->
<span class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
  ⚠ Warning
</span>

<!-- Critical -->
<span class="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
  🚨 Critical
</span>
```

### Banner drift
```html
<div role="alert" class="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
  <div class="mx-auto flex max-w-6xl items-center gap-3">
    <span class="text-lg" aria-hidden="true">🚨</span>
    <p class="flex-1"><strong>Drift critique</strong> — GTM exécute le mapping v16 alors que v17 est actif côté admin.</p>
    <a href="/admin/tracking/gtm/sync-status" class="rounded-md bg-red-900 px-3 py-1 text-xs font-medium text-red-50 hover:bg-red-800">
      Voir détails →
    </a>
  </div>
</div>
```

### Sync card
```html
<div class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
  <h3 class="text-sm font-medium uppercase tracking-wide text-stone-500">Mapping vendors</h3>
  <div class="mt-3 space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-xs text-stone-600">Admin</span>
      <span class="font-mono text-sm font-medium text-stone-900">v17</span>
    </div>
    <div class="flex items-center justify-between">
      <span class="text-xs text-stone-600">GTM runtime</span>
      <span class="font-mono text-sm font-medium text-stone-900">v17 ✓</span>
    </div>
  </div>
  <p class="mt-3 text-xs text-emerald-700">✅ Cohérent depuis 3j</p>
</div>
```

## Iconographie

Pas de lib externe — emojis utilisés stratégiquement :
- ✅ : success
- ⚠ / ⚠️ : warning
- 🚨 : critical
- 📦 : bundle
- ↗ : lien externe
- ↻ : refresh

## Typography

Hérite du design FemiGlow :
- `font-body` pour texte
- `font-mono` pour versions et bundleId (lisibilité)
- Tailles : `text-xs` (10px), `text-sm` (14px), `text-base` (16px), `text-lg` (18px)

## Espacement

- Cards : `p-4` padding
- Inter-card : `gap-4`
- Section padding : `py-6`
- Margin entre sections : `mt-8`

## Responsive

- Desktop : grid 3 colonnes pour les SyncCards
- Tablet : grid 2 colonnes
- Mobile : stack vertical (1 colonne)

```html
<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  <SyncCard ... />
  <SyncCard ... />
  <SyncCard ... />
</div>
```

## Micro-copy (textes UI)

| Contexte | FR |
|---|---|
| Banner critical générique | "Drift critique — vérifier l'état GTM." |
| Banner warning | "Attention : un drift mineur a été détecté." |
| Cohérent | "Cohérent depuis {{durée}}" |
| Silence > 6h | "Aucun ping reçu depuis {{durée}}. Vérifier que le container GTM est publié." |
| Empty state | "Aucun ping reçu pour le moment. Cela peut prendre quelques minutes après le premier import et publication GTM." |
| CTA refresh | "↻ Rafraîchir" |
| CTA valider import | "Valider mon import GTM" |
| Lien doc | "Comment ça marche ?" |
| Etat OK header | "🟢 Tout est cohérent" |
| Etat warning header | "🟠 Attention : {{n}} drift mineur" |
| Etat critical header | "🔴 Drift critique" |

## Tons et voix

- **Direct mais bienveillant** : "Voici ce qui ne va pas. Voici quoi faire."
- **Pas de jargon obscur** : "Drift" expliqué une fois en tooltip puis utilisé librement.
- **Pas de panique** : `🚨` réservé au vrai critique. Pas d'abus.
- **Actionnable** : chaque message d'erreur termine par un verbe d'action.

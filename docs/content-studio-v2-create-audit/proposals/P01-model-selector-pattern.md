# P01 — Pattern du sélecteur de modèle

> **Contexte** : on doit offrir à l'opérateur le choix du modèle pour 3 rôles (chat, image, video). Cette proposition arbitre le **pattern UI** unique à utiliser dans IntentionForm (chat) et MediaStudio (image, video).

## Contraintes à respecter

1. Ergonomie maximale : visible, sélectionnable au clavier, recherche instantanée
2. Suggestion par défaut adaptée au format (cf. P04)
3. Affichage du coût / latence prévisionnels (transparence)
4. Indicateur de source (Live / Cache / Static)
5. Support de modèles custom (saisie libre)
6. Composant unique réutilisable (pas 3 implémentations)

## Option A — Inline `<select>` natif + tooltip

Un simple `<select>` natif, groupé par provider, avec tooltip détaillé au hover.

### Forces
- Aucune dépendance JS
- Bon a11y natif (clavier + screen reader)
- Très rapide à implémenter (< 1h)
- Le plus léger en bundle

### Faiblesses
- Pas de recherche
- Pas de badges, pas de pricing inline
- Style natif inégal selon OS (Mac vs Windows vs Linux)
- Pas de support saisie libre custom
- Pas d'icônes provider

### Pertinence
Suffisant si on a < 10 modèles. Au-delà : friction recherche.

## Option B — Popover combobox (Radix + cmdk) ⭐

Bouton trigger → ouvre un Popover avec :
- Champ de recherche en haut
- Liste filtrée groupée par provider
- Chaque item : icône provider + label + tier badge + pricing
- Footer : "+ Ajouter un modèle custom" (saisie libre)
- Indicateur source en haut à droite

### Forces
- Recherche instantanée (cmdk)
- Affichage riche (badges, pricing, source)
- A11y robuste (Radix gère focus + clavier + ARIA)
- Cohérent avec le ModelSelector déjà utilisé dans AI Engine
- Support saisie custom intuitive
- S'adapte à 5 modèles comme à 50

### Faiblesses
- ~5-7 KB de JS supplémentaire (cmdk + Radix Popover déjà bundlés)
- Implémentation 2-3× plus longue que Option A
- Nécessite un peu de design pour les badges

### Pertinence
Optimal pour ergonomie + scalabilité. Déjà précédent dans le repo.

## Option C — Page dédiée "Paramètres de génération"

Bouton "Paramètres" qui ouvre un Drawer / Modal large avec :
- Liste des 3 rôles (chat, image, video)
- Pour chaque rôle : combobox + slider qualité + slider coût + presets
- Bouton Sauvegarder

### Forces
- Vision globale des choix
- Édition multi-rôles en une fois
- Permet d'introduire d'autres paramètres avancés

### Faiblesses
- Indirection (clic supplémentaire pour voir/changer)
- Sépare le choix de l'action (anti-pattern flow)
- Plus lourd (drawer + form complet)
- N'aide pas à comprendre "à quoi sert chaque modèle"

### Pertinence
Bien si > 5 paramètres à régler. Sur-engineering pour notre cas.

## Comparaison synthétique

| Critère | A — `<select>` | B — Popover combobox | C — Drawer dédié |
|---------|----------------|----------------------|-------------------|
| Ergonomie | 🟡 | 🟢 | 🟡 |
| Recherche | ❌ | 🟢 | 🟢 |
| Badges/pricing | ❌ | 🟢 | 🟢 |
| Custom input | ❌ | 🟢 | 🟢 |
| A11y | 🟢 | 🟢 | 🟡 |
| Bundle size | 🟢 | 🟡 | 🔴 |
| Effort dev | 🟢 (1h) | 🟡 (4h) | 🔴 (8h) |
| Précédent repo | — | ✅ (AI Engine) | — |
| Cohérence flow | 🟢 | 🟢 | 🔴 (indirection) |

## Recommandation finale

**Option B — Popover combobox (Radix + cmdk)**

### Pourquoi
- Pattern déjà éprouvé dans le repo (AI Engine ModelSelector)
- Réutilisable trivialement entre IntentionForm et MediaStudio (prop `role`)
- Ergonomie maximale sans sur-engineering
- A11y robuste

### Détails d'implémentation
```
<ModelPicker
  role="chat" | "image" | "video"
  format="post" | "story" | "reel" | "carousel"
  value={selectedModelId}
  onChange={(modelId) => setModel(modelId)}
  showCost={true}
  allowCustom={true}
/>
```

Le composant fetch `GET /api/admin/content-studio/models?role={role}&format={format}` au open (pas au mount, pour économiser). Cache via `useRef<Map>` pendant la durée de vie du composant. Indicateur Live/Cache/Static en haut à droite.

### Migration
1. Adapter le composant `apps/web/src/components/admin/content-studio-v2/create/ModelPicker.tsx` (nouveau)
2. Brancher dans `IntentionForm` (role="chat")
3. Brancher dans `MediaStudio` (role="image" ou "video" selon toggle)

Voir `features/F03-text-model-selection/implementation-plan.md` pour la mise en œuvre détaillée.

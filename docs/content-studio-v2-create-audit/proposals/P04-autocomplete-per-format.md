# P04 — Suggestion / autocomplete de modèle par format

> **Contexte** : "un système d'autocomplétion pertinent doit être mis en place en fonction des médias". Cette proposition formalise comment le ModelPicker pré-sélectionne et trie ses options selon le format choisi (post / story / reel / carousel).

## Constat actuel

Aucune logique. L'env force un modèle unique pour text + image, indépendamment du format. Pas de différenciation reel vs post.

## Critères d'une bonne suggestion

1. **Pertinence média** : un reel a besoin d'un texte percutant court → suggérer un modèle "balanced" ou "premium". Une story a besoin de vitesse → suggérer "fast".
2. **Pertinence visuel** : un reel = vidéo verticale 9:16 → suggérer modèle vidéo. Un post = image 1:1 ou 4:5 → suggérer DALL-E 3.
3. **Coût** : ne pas pousser systématiquement le modèle le plus cher.
4. **Latence** : un opérateur en démo veut un retour rapide.
5. **Possibilité de désaccord** : l'utilisateur doit pouvoir choisir un autre modèle ; la suggestion est un défaut, pas une contrainte.

## Option A — Mapping statique format → modèle (1:1)

Table statique dans `registry.ts` :
```
post     → chat: gpt-4o-mini,    image: dall-e-3,            video: -
story    → chat: gpt-4o-mini,    image: gpt-image-1-mini,    video: -
reel     → chat: gpt-4o,         image: gpt-image-1,         video: mock-video-1.0
carousel → chat: gpt-4o,         image: dall-e-3,            video: -
```

### Forces
- Trivial à implémenter et expliquer
- Déterministe

### Faiblesses
- Rigide : si on retire un modèle, doit éditer la map
- Pas d'adaptation contextuelle (objectif, plateforme)

### Pertinence
Suffisant pour un v1.

## Option B — Tags `recommendedFor: ContentFormat[]` sur chaque ModelEntry + ranking

Chaque modèle dans `registry.ts` déclare ses formats recommandés :
```ts
{ id: 'gpt-4o-mini', recommendedFor: ['post', 'story'], tier: 'fast', ... }
{ id: 'gpt-4o',      recommendedFor: ['reel', 'carousel'], tier: 'balanced', ... }
{ id: 'claude-sonnet-4', recommendedFor: ['carousel'], tier: 'premium', ... }
```

La fonction `suggestForFormat(format)` retourne le premier modèle dont `recommendedFor` inclut le format, trié par `tier` (fast > balanced > premium) ou par `default=true`.

### Forces
- Flexible
- Plusieurs modèles peuvent matcher → trie par tier
- Ajout d'un modèle = juste l'ajouter au registry
- Suggestion explicable ("Recommandé pour reel")

### Faiblesses
- Ranking complexe à maintenir
- Pas d'adaptation à l'objectif

### Pertinence
Optimal pour scaling.

## Option C — Score multi-critères

Chaque modèle a un score calculé `score(format, objective, platform) → number`. Le modèle de plus haut score est suggéré.

### Forces
- Adaptation fine
- Personnalisable par tenant/utilisateur

### Faiblesses
- Sur-engineering pour notre v1
- Score difficile à expliquer ("pourquoi suggéré ?")
- Maintenance lourde

### Pertinence
Reportée à un v3+ si on a des données d'usage.

## Comparaison

| Critère | A — Map | B — Tags + tier | C — Score |
|---------|---------|------------------|-----------|
| Simplicité | 🟢 | 🟢 | 🔴 |
| Flexibilité | 🔴 | 🟢 | 🟢 |
| Maintenabilité | 🟡 | 🟢 | 🔴 |
| Explicabilité | 🟢 | 🟢 | 🔴 |
| Évolution future | 🟡 | 🟢 | 🟢 |

## Recommandation finale

**Option B — Tags `recommendedFor` + tier ranking**

### Détails

```ts
// lib/content-studio-v2/models/registry.ts
export interface ModelEntry {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'mock';
  role: 'chat' | 'image' | 'video';
  label: string;
  tier: 'fast' | 'balanced' | 'premium';
  recommendedFor: ContentFormat[];
  pricing: { inputCentsPer1k?: number; outputCentsPer1k?: number; perCall?: number };
  capabilities: string[];
  contextWindow?: number;
  default?: boolean;
}

export const MODELS: ModelEntry[] = [
  // CHAT
  { id: 'gpt-4o-mini', provider: 'openai', role: 'chat', label: 'GPT-4o mini',
    tier: 'fast', recommendedFor: ['post', 'story'],
    pricing: { inputCentsPer1k: 0.015, outputCentsPer1k: 0.06 }, default: true },
  { id: 'gpt-4o', provider: 'openai', role: 'chat', label: 'GPT-4o',
    tier: 'balanced', recommendedFor: ['reel', 'carousel'],
    pricing: { inputCentsPer1k: 0.25, outputCentsPer1k: 1.0 } },
  { id: 'claude-sonnet-4-6', provider: 'anthropic', role: 'chat', label: 'Claude Sonnet 4.6',
    tier: 'premium', recommendedFor: ['carousel'],
    pricing: { inputCentsPer1k: 0.30, outputCentsPer1k: 1.5 } },

  // IMAGE
  { id: 'gpt-image-1-mini', provider: 'openai', role: 'image', label: 'GPT-Image-1 mini',
    tier: 'fast', recommendedFor: ['story'],
    pricing: { perCall: 0.4 }, default: true },
  { id: 'dall-e-3', provider: 'openai', role: 'image', label: 'DALL·E 3',
    tier: 'balanced', recommendedFor: ['post', 'carousel'],
    pricing: { perCall: 4.0 } },
  { id: 'gpt-image-1', provider: 'openai', role: 'image', label: 'GPT-Image-1',
    tier: 'premium', recommendedFor: ['reel'],
    pricing: { perCall: 8.0 } },

  // VIDEO
  { id: 'mock-video-1.0', provider: 'mock', role: 'video', label: 'Mock video (1.0)',
    tier: 'fast', recommendedFor: ['reel', 'story'],
    pricing: { perCall: 0 }, default: true },
  // Future: veo-3, sora, etc.
];

export function suggestForFormat(format: ContentFormat): {
  chat: ModelEntry;
  image: ModelEntry;
  video: ModelEntry | null;
} {
  const byRole = (role: 'chat' | 'image' | 'video') => {
    const recommended = MODELS.filter(m => m.role === role && m.recommendedFor.includes(format));
    if (recommended.length > 0) {
      const order = { fast: 0, balanced: 1, premium: 2 };
      return recommended.sort((a, b) => order[a.tier] - order[b.tier])[0];
    }
    return MODELS.find(m => m.role === role && m.default) ?? MODELS.find(m => m.role === role)!;
  };
  const video = MODELS.find(m => m.role === 'video') ? byRole('video') : null;
  return { chat: byRole('chat'), image: byRole('image'), video };
}
```

### UX dans le ModelPicker

```
┌─────────────────────────────────────────────────┐
│ 🔍 Chercher un modèle…                          │
├─────────────────────────────────────────────────┤
│ ⭐ Recommandé pour reel                         │
│   ● gpt-4o · OpenAI · balanced · 0.6¢/1k       │
├─────────────────────────────────────────────────┤
│ Autres modèles                                  │
│   ○ gpt-4o-mini · OpenAI · fast · 0.04¢        │
│   ○ claude-sonnet-4-6 · Anthropic · premium    │
├─────────────────────────────────────────────────┤
│ + Ajouter un modèle custom                      │
└─────────────────────────────────────────────────┘
```

### Validation

- Tests unit pour `suggestForFormat(format)` : un cas par format
- Tests UI : open ModelPicker → l'item suggéré apparaît en premier avec badge "Recommandé"

Voir `features/F03-text-model-selection/`, `features/F07-image-model-selection/`, `features/F08-video-model-selection/` pour application.

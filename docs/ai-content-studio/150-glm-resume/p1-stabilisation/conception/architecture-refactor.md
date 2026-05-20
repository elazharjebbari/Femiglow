# Architecture cible — Refactoring du Content Studio

## État actuel

```
ContentStudioClient.tsx (1567 lignes)
├── 13 useState (4 zones de formulaire)
├── 1 useEffect (debounced media fetch)
├── 6 appels API (postJson, patchJson, getJson)
├── 4 sections UI inline (IdeaForm, DraftEditor, PostizPanel, PostizHealthPanel)
└── 3 helpers (postJson, patchJson, getJson, parseJson)
```

Problèmes :
- Composant monolithique inmaintenable
- Prop drilling excessif (DraftEditor reçoit 17+ props)
- Types dupliqués (`Integration`, `StudioMediaItem`) au lieu d'importés
- Pas d'error boundary
- Pas de aria-live pour les messages de statut
- Pas de validation côté client

## Architecture cible

### Structure de fichiers

```
components/admin/content-studio/
├── ContentStudioClient.tsx          ← orchestrateur (state + data fetching)
├── StudioGuide.tsx                 ← section d'aide repliable
├── IdeaForm.tsx                    ← création d'idée + génération
├── IdeaList.tsx                    ← liste des idées avec sélection
├── DraftEditor.tsx                 ← édition brouillon + brand score
├── DraftCardList.tsx               ← sidebar de drafts
├── MediaPicker.tsx                 ← picker importés / IA + génération visuelle
├── PlatformPreview.tsx             ← preview type réseau social
├── PostizPanel.tsx                 ← statut livraison + retry + date cible
├── PostizHealthPanel.tsx            ← santé Postiz + dry-run + compteurs
├── CalendarPipeline.tsx            ← pipeline éditorial + dates
├── AutomationActions.tsx            ← boutons sync, retry, import
└── types.ts                        ← types partagés du client (Integration, StudioMediaItem, etc.)
```

### Flux de données

```
ContentStudioClient.tsx (serveur → client)
├── Données initiales via props (initialIdeas, initialDrafts, etc.)
├── State centralisé : ideas, drafts, posts, deliveries, snapshots
├── Handlers passés aux sous-composants via props
└── Sous-composants purs ou avec state local minimal

Chaque sous-composant :
├── Reçoit ses données via props
├── Gère son propre state de formulaire local
├── Appelle les handlers du parent pour les mutations
└── Retourne eventuellement des callbacks pour les actions
```

### Types partagés

Créer `types.ts` dans le dossier composant avec :
- `Integration` — migré depuis ContentStudioClient
- `StudioMediaItem` — migré depuis ContentStudioClient
- `MediaCompartment` — migré
- `DraftAssetsByDraftId` — migré
- `AutomationResponse` — migré

Ces types seront importés à la fois par le client et par les sous-composants.

### Conventions

1. **Couleurs sémantiques** — garder le système existant :
   - rose = idées/cadrage
   - sky = production/brouillons
   - amber = médias/assets
   - violet = IA visuelle + Postiz
   - indigo = opérations Postiz
   - teal = calendrier
   - emerald = validation/approval
   - stone = général

2. **Error boundary** — ajouter un `ErrorBoundary` au niveau de `ContentStudioClient` pour attraper les erreurs de rendu.

3. **aria-live** — ajouter `role="status"` avec `aria-live="polite"` sur la zone de message.

4. **Validation client** — ajouter une validation Zod côté client avant les appels API (réutiliser les schemas existants).

## Diagramme des composants

```
ContentStudioClient
├── StudioGuide
├── CalendarPipeline
├── PostizHealthPanel
│   └── AutomationActions
├── <Left Column>
│   ├── IdeaForm
│   ├── IdeaList
│   └── PostizPanel
└── <Right Column>
    ├── DraftCardList
    ├── DraftEditor
    │   ├── MediaPicker
    │   ├── PlatformPreview
    │   └── PostizPanel (boutons de livraison)
    └── Action buttons (Save+Review, Approve)
```

## Principe de découpage

Chaque composant extrait suit ces règles :
1. Le composant ne connaît que les props qu'il reçoit
2. Les mutations passent par des callbacks `(data) => void`
3. Le state de formulaire local reste dans le composant (ex: `mediaQuery`, `scheduledAt`)
4. Le state partagé reste dans `ContentStudioClient`
5. Pas de `useEffect` pour synchroniser des props vers du state local (utiliser `key` ou des dérivations)
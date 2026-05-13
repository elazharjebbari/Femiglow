# Frontend — Architecture client & patterns clés

> Le frontend chat est une **state machine** orchestrée par Zustand + SSE consumer, optimisée pour mobile darija + RTL natif. Tout l'effort UX converge vers un point : convertir.

## Principes directeurs

1. **State first, render after.** La state machine décide ; les composants rendent. Pas de useState éparpillé.
2. **Streaming est sacré.** Le ressenti d'immédiateté est l'argument N°1 de conversion. Même les canned ont un faux streaming local.
3. **RTL natif, pas un patch.** AR / AR-MA sont des citoyens de première classe : `dir="rtl"`, layout miroir, icônes flipées.
4. **Mobile-first et touch-target 44 px.** Cible: phone 360–414 px de large, pouce-friendly.
5. **A11y non-négociable.** WCAG 2.1 AA, focus visible, screen reader, no motion respect.
6. **Zéro requête redondante.** Le store déduplique ; la session se restaure depuis localStorage avant le premier paint.
7. **Erreur ≠ rupture.** Toute erreur du serveur tombe sur un fallback UI scripté (canned apology + lead form).

## Inventaire des modules

| Module | Fichier | Rôle |
|---|---|---|
| `ChatLauncher` | `components/chat/launcher.tsx` | Bouton flottant, badge unread, persona |
| `ChatPanel` | `components/chat/panel.tsx` | Conteneur principal sheet/modal |
| `ChatHeader` | `components/chat/header.tsx` | Titre, status pill, close button |
| `MessageList` | `components/chat/message-list.tsx` | Virtual scroll, auto-anchor bottom |
| `MessageBubble` | `components/chat/message-bubble.tsx` | Bulle user/assistant, markdown safe |
| `SuggestionPills` | `components/chat/suggestion-pills.tsx` | Pills horizontales tactiles |
| `Composer` | `components/chat/composer.tsx` | Textarea + send, autosize, A11y label |
| `LeadForm` | `components/chat/lead-form.tsx` | Mini form coordonnées (nom, phone, ville) |
| `SourcesPopover` | `components/chat/sources-popover.tsx` | Affiche sources RAG citées |
| `ToolBadge` | `components/chat/tool-badge.tsx` | Mini indicateur "🔧 vérification livraison…" |
| `TypingDots` | `components/chat/typing-dots.tsx` | Placeholder avant 1er token |
| `useChatStore` | `lib/chat/client/store.ts` | Zustand store global |
| `useChatSSE` | `lib/chat/client/sse.ts` | Hook EventSource lifecycle |
| `useLocalStream` | `lib/chat/client/local-stream.ts` | Faux stream canned |
| `chatMachine` | `lib/chat/client/state-machine.ts` | Machine d'états Zustand-backed |

## Fichiers de cette section

- [`README.md`](README.md) — ce fichier
- [`component-tree.puml`](component-tree.puml) — arbre des composants
- [`state-machine.puml`](state-machine.puml) — diagramme d'état du chat
- [`store-zustand.md`](store-zustand.md) — shape du store, actions, persist
- [`sse-protocol.md`](sse-protocol.md) — les 7 événements SSE et leur traitement
- [`local-streaming.md`](local-streaming.md) — hook `useLocalStream`
- [`animations.hjson`](animations.hjson) — tokens de motion design
- [`accessibility-checklist.md`](accessibility-checklist.md) — WCAG 2.1 AA exhaustif

## Patterns transverses

### 1. Hydratation différée

Le `ChatLauncher` est rendu côté serveur (RSC) avec un placeholder. Le `ChatPanel` est lazy-loaded au premier click pour économiser ~80 kB sur le bundle initial home.

```tsx
const ChatPanel = dynamic(() => import('@/components/chat/panel'), {
  ssr: false,
  loading: () => <ChatPanelSkeleton />
})
```

### 2. SSR-safe store

Zustand persist doit attendre l'hydratation pour éviter le warning React :

```tsx
const useHasMounted = () => {
  const [m, setM] = useState(false)
  useEffect(() => setM(true), [])
  return m
}
```

### 3. Optimistic UI

L'envoi d'un message :
1. Ajoute le `userMessage` au store **immédiatement** (rôle: 'user', status: 'sending').
2. Ouvre la connexion SSE.
3. Sur `meta` reçu : flip user → 'sent', crée assistant placeholder avec `TypingDots`.
4. Sur chaque `delta` : append token à assistant content.
5. Sur `done` : flip assistant → 'completed', persist localement.
6. Sur `error` : flip user → 'failed' (mais conserve le texte pour retry).

### 4. Persist sélective

Le store persist uniquement :
- `sessionId`
- `visitorToken`
- `audience`
- `messages` (dernier 50 max, hard cap)
- `consentVersion`

Jamais persisté :
- État de streaming en cours
- Form data temporaire
- Erreurs

### 5. RTL miroir

```tsx
const dir = ['ar', 'ar-MA'].includes(language) ? 'rtl' : 'ltr'
<div dir={dir} className="chat-panel">
```

Les icônes "envoyer", "fermer" sont *flipées* via CSS `transform: scaleX(-1)` en RTL.

## Performance budget

| Métrique | Cible | Mesure |
|---|---|---|
| Bundle initial home (chat lazy) | < 8 kB | webpack-bundle-analyzer |
| Bundle panel chargé | < 60 kB | idem |
| First Input Delay | < 100 ms | RUM (Vercel Analytics) |
| First token latency | < 800 ms p50 | KPI `chat_first_token_ms` |
| Steady-state delta cadence | < 80 ms | KPI `chat_delta_interval_ms` |
| Memory leak chat ouvert 30 min | 0 MB drift | Chrome DevTools |

## Choix techniques justifiés

| Choix | Pourquoi | Alternatives rejetées |
|---|---|---|
| Zustand vs Redux | Boilerplate ÷ 5, persist intégré, plus rapide | Redux Toolkit (overkill ici) |
| SSE vs WebSocket | Stream unidirectionnel suffit, traverse proxies, auto-reconnect | WS (complexité, sticky session) |
| EventSource native vs SSE polyfill | Native partout sauf IE (mort) | polyfill (kB inutiles) |
| react-markdown vs custom parser | Sanitization éprouvée, plugins KaTeX si besoin | custom (XSS risk) |
| framer-motion vs CSS transitions | Spring physics + AnimatePresence pour sheet | CSS (peu de spring, gestion exit lourd) |
| dialog HTML5 vs Headless UI Dialog | Headless UI = focus trap robuste + portal | <dialog> (support inégal Safari) |

## Anti-patterns interdits

- ❌ `useEffect` qui fire SSE sans cleanup → leak EventSource.
- ❌ `setState` dans une boucle delta → re-render storm.
- ❌ `dangerouslySetInnerHTML` sans sanitizer.
- ❌ Polling `setInterval` pour status au lieu de SSE.
- ❌ `localStorage.setItem` synchrone dans render path.
- ❌ Mocked random delay pour simuler streaming (utiliser `useLocalStream` officiel).
- ❌ Ne pas annuler le stream sur unmount → fuite mémoire + coût LLM.

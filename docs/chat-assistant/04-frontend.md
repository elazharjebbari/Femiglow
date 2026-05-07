# 04 — Frontend

> *Widget, store Zustand, hooks, persistance locale, accessibilité, RTL*

---

## 1. Carte des composants

```
components/chat/
├── ChatProvider.tsx            // contexte React + hydratation initiale
├── ChatRoot.tsx                // monture conditionnelle (after-idle, page allowlist)
├── launcher/
│   ├── ChatLauncher.tsx        // bouton flottant
│   ├── LauncherIcon.tsx        // icône souffle (SVG vague asymétrique)
│   └── LauncherPulse.tsx       // halo discret (CSS, prefers-reduced-motion-aware)
├── panel/
│   ├── ChatPanel.tsx           // panneau (desktop side, mobile fullscreen)
│   ├── ChatHeader.tsx          // wordmark + actions (close, info)
│   ├── ChatBody.tsx            // scroll, virtualisé
│   ├── MessageList.tsx
│   ├── MessageBubble.tsx
│   ├── TypingIndicator.tsx     // trois points qui respirent
│   ├── ReadReceipt.tsx
│   ├── SourcesPopover.tsx      // sources RAG citées (admin / mode coulisses)
│   └── EmptyState.tsx          // salutation contextuelle + suggestions
├── composer/
│   ├── ChatComposer.tsx        // textarea + bouton envoi
│   ├── SuggestionsRail.tsx
│   ├── LanguageHint.tsx        // « tu peux écrire en darija »
│   └── PoliteRateLimit.tsx
├── visualizer/
│   └── ChatVisualizer.tsx      // mode coulisses, cf. doc 11
└── primitives/
    ├── ChatToken.tsx           // composant tokenisé (apparition fluide)
    └── ChatMarkdown.tsx        // rendu markdown sécurisé (rehype-sanitize)
```

## 2. Montage et chargement

`ChatRoot` est monté dans le layout global, mais hydraté en
**`next/dynamic` ssr:false** après `requestIdleCallback`. Ainsi :

- Aucun coût SSR.
- Aucun blocage du `Largest Contentful Paint`.
- Le bundle widget (~ 30 kB gzip) charge en arrière-plan.

```tsx
// app/(public)/layout.tsx
import dynamic from 'next/dynamic';
const ChatRoot = dynamic(() => import('@/components/chat/ChatRoot'), { ssr: false });

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChatRoot />
    </>
  );
}
```

`ChatRoot.tsx` :

```tsx
'use client';
import { useEffect, useState } from 'react';
import { ChatProvider } from './ChatProvider';
import { ChatLauncher } from './launcher/ChatLauncher';
import { ChatPanel } from './panel/ChatPanel';

export default function ChatRoot() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const idle = (cb: () => void) =>
      'requestIdleCallback' in window ? requestIdleCallback(cb) : setTimeout(cb, 200);
    idle(() => setReady(true));
  }, []);
  if (!ready) return null;
  return (
    <ChatProvider>
      <ChatLauncher />
      <ChatPanel />
    </ChatProvider>
  );
}
```

`ChatProvider` hydrate la session en deux étapes :
1. lecture immédiate du cache `localStorage` (instantané) ;
2. `GET /api/chat/session` en arrière-plan pour réconcilier (cookie),
   en cas d'écart la version serveur l'emporte.

## 3. Store Zustand

```ts
// lib/chat/store.client.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Status = 'idle' | 'opening' | 'open' | 'sending' | 'error';
type Lang = 'fr' | 'ar' | 'ar-MA';

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      status: 'idle',
      open: false,
      language: 'fr',
      messages: [],
      suggestions: [],
      unread: 0,
      themeVariantId: 'default',

      openWidget() { set({ open: true, unread: 0 }); track('widget_open'); },
      closeWidget() { set({ open: false }); track('widget_close'); },

      async hydrate() { /* GET /api/chat/session */ },

      async send(text) {
        const id = nano();
        const ts = Date.now();
        set((s) => ({
          status: 'sending',
          messages: [...s.messages, { id, role: 'user', content: text, status: 'sending', createdAt: ts }],
        }));

        const stream = openMessageSSE({ sessionId: get().sessionId!, text, lang: get().language });
        const agentId = `pending_${id}`;
        set((s) => ({
          messages: [...s.messages, { id: agentId, role: 'assistant', content: '', status: 'streaming', createdAt: Date.now() }],
        }));

        let firstTokenAt: number | null = null;
        for await (const ev of stream) {
          if (ev.event === 'token') {
            if (firstTokenAt === null) firstTokenAt = Date.now();
            set((s) => ({
              messages: s.messages.map(m => m.id === agentId ? { ...m, content: m.content + ev.data } : m),
            }));
          } else if (ev.event === 'meta') {
            set((s) => ({
              messages: s.messages.map(m => m.id === agentId ? { ...m, sources: ev.data.sources, modelVariant: ev.data.variantOpaqueId } : m),
            }));
          } else if (ev.event === 'done') {
            set((s) => ({
              status: 'idle',
              messages: s.messages.map(m => m.id === agentId ? { ...m, id: ev.data.messageId, status: 'sent' } : m),
            }));
          } else if (ev.event === 'error') {
            set((s) => ({
              status: 'error',
              messages: s.messages.map(m => m.id === agentId ? { ...m, status: 'error', errorCode: ev.data.code } : m),
            }));
          }
        }
      },

      async retry(messageId) { /* ... */ },
      async feedback(messageId, value, note) { /* ... */ },
    }),
    {
      name: 'fg.chat.v1',
      partialize: (s) => ({
        sessionId: s.sessionId,
        language: s.language,
        messages: s.messages.slice(-30),
        themeVariantId: s.themeVariantId,
      }),
    },
  ),
);
```

> Le store est **hors React** dans la mesure du possible — la
> persistance est réalisée par le middleware `persist`. Les
> composants consomment uniquement les slices qu'ils affichent,
> via `useChatStore(selector, shallow)`.

## 4. Hooks publics

```ts
// hooks/use-chat-launcher.ts
export function useChatLauncher() {
  const { openWidget, unread, status } = useChatStore(s => ({
    openWidget: s.openWidget,
    unread: s.unread,
    status: s.status,
  }), shallow);
  return { onClick: openWidget, unread, busy: status === 'sending' };
}

// hooks/use-chat-conversation.ts
export function useChatConversation() { /* messages + status + retry */ }

// hooks/use-chat-composer.ts
export function useChatComposer() { /* text, setText, send, suggestions, language */ }

// hooks/use-page-context.ts
// Émet un event « page change » au store pour adapter la salutation.
```

## 5. Persistance locale

Deux niveaux :

| Niveau            | Stockage          | Contenu                                                | TTL          |
| ----------------- | ----------------- | ------------------------------------------------------ | ------------ |
| Volatile          | `sessionStorage`  | brouillon de message en cours, position scroll         | onglet fermé |
| Persistant        | `localStorage`    | sessionId, language, 30 derniers messages, themeVariantId | 30 jours     |
| Cookie HTTP-only  | (serveur)         | session iron-session signée                            | 7 jours rolling |

Côté serveur, la **vérité reste en DB**. Le store local est une
optimisation perçue : l'historique complet est servi par
`GET /api/chat/session` au montage si le local est vide ou désynchronisé.

## 6. Streaming côté client

```ts
// lib/chat/stream.client.ts
export async function* openMessageSSE(payload: ChatMessageInput): AsyncIterable<StreamEvent> {
  const ctrl = new AbortController();
  const res = await fetch('/api/chat/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(payload),
    signal: ctrl.signal,
  });
  if (!res.ok || !res.body) {
    yield { event: 'error', data: { code: 'http_' + res.status } };
    return;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const ev = parseSSE(raw);
        if (ev) yield ev;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

> Pas de dépendance `eventsource` : le `fetch` ReadableStream
> suffit en navigateurs cibles (Chrome ≥ 90, Safari ≥ 16,
> Firefox ≥ 90).

## 7. Humanisation perçue

Le serveur émet les tokens dès qu'ils arrivent. Le client les
**re-cadence** pour éviter l'effet « machine » des modèles
rapides :

```ts
// lib/chat/humanize.client.ts
export async function* humanize(stream: AsyncIterable<StreamEvent>, lang: Lang) {
  const baseDelayPerCharMs = lang === 'ar' || lang === 'ar-MA' ? 18 : 14;
  let buffered = '';
  let lastFlush = performance.now();
  for await (const ev of stream) {
    if (ev.event !== 'token') { yield ev; continue; }
    buffered += ev.data;
    const now = performance.now();
    const elapsed = now - lastFlush;
    const target = buffered.length * baseDelayPerCharMs;
    if (elapsed >= target) {
      yield { event: 'token', data: buffered };
      buffered = '';
      lastFlush = now;
    } else {
      await sleep(Math.min(target - elapsed, 90));
    }
  }
  if (buffered) yield { event: 'token', data: buffered };
}
```

L'option est désactivable côté admin (`theme.motion.humanizeStream = false`).

## 8. Voyant « écrit… »

Affiché immédiatement après envoi du visiteur. Tant que `firstToken`
n'est pas arrivé, le voyant reste visible. Après le premier token, il
disparaît au profit du curseur dans la bulle. Sa **durée minimale**
est 600 ms (perception de réflexion humaine), même si le first-token
est plus rapide.

## 9. Accessibilité

- Le launcher est un `<button>` avec `aria-haspopup="dialog"` et
  `aria-controls="chat-panel"`.
- Le panel est un `<dialog>` (avec polyfill focus-trap si besoin)
  ou un `role="dialog" aria-modal="false"` si on préfère
  non-modal — choix par défaut **non-modal** (sortie par Esc, le
  reste de la page reste interactif).
- Annonce `aria-live="polite"` sur la liste des messages, ne lit
  que le message complet (pas chaque token).
- Skip link `« Aller à la conversation »` au focus initial.
- Contrastes WCAG AA strict — vérifiés en CI par `jest-axe` et
  par `axe-core` dans Storybook.
- `prefers-reduced-motion` désactive le pulse, l'humanisation
  des tokens, et substitue les transitions par des fondus 80 ms.
- Cible touch ≥ 44 × 44 px sur mobile.

## 10. RTL & i18n

- `direction: rtl` appliqué sur la racine du panel quand
  `language ∈ { 'ar', 'ar-MA' }`.
- Animations symétriques : un panel desktop qui glissait de la
  droite glisse de la gauche en RTL.
- Bulles : message visiteur à gauche en RTL, agent à droite.
- Polices : `Inter` reste pour les contrôles ; le corps utilise
  `IBM Plex Sans Arabic` chargée à la demande quand `lang ∈ AR`.
- Pas de retournement des icônes signifiantes (logo wordmark).
  Les flèches d'envoi sont retournées.

## 11. Sécurité côté client

- `dangerouslySetInnerHTML` interdit. Les réponses sont rendues
  par `ChatMarkdown` qui passe par `unified` + `rehype-sanitize`
  (allowlist FemiGlow : `p`, `strong`, `em`, `a`, `ul`, `ol`,
  `li`, `code`, `pre`, `blockquote`).
- Liens externes : `rel="noopener noreferrer"` automatique,
  `target="_blank"` opt-in.
- CSP nonce propagé via `<Script nonce>` ; aucun `<style>` inline
  hors tokens CSS variables déjà autorisés.

## 12. Performance

| Élément                     | Budget                     | Outil                                |
| --------------------------- | -------------------------- | ------------------------------------ |
| JS chat (gzip)              | ≤ 35 kB                    | `bundle analyzer` + `size-limit` CI  |
| First paint widget          | ≤ 200 ms après hydratation | Lighthouse                           |
| CLS contribué par chat      | ≤ 0.001                    | Web Vitals RUM                       |
| Memory steady state         | ≤ 8 Mo                     | Chrome devtools profile              |
| Re-renders MessageList      | virtualisée si > 60        | `react-virtuoso` (lazy import)       |

## 13. Compatibilité navigateurs

- Cibles : 2 dernières versions Safari, Chrome, Firefox, Edge ;
  iOS Safari 16+, Android Chrome 110+.
- Polyfills inutiles (les fonctionnalités SSE / fetch streaming
  / `requestIdleCallback` non supportées tombent en chemins
  dégradés gracieux : pas d'humanisation, fallback `setTimeout`).

## 14. Tests frontend (résumé)

Détaillé dans [12](12-tests.md). Trois étages :

- **Unit** (Vitest + Testing Library) : composants, store, hooks,
  `humanize`, `parseSSE`.
- **Integration** (Vitest + MSW) : `useChatConversation` →
  endpoints simulés (3 scénarios : succès, modération, erreur).
- **E2E** (Playwright) : parcours complets, dont RTL, dont
  reprise de session, dont conversion attribuée.

## 15. Lecture suivante

- [05 — UI / UX & design](05-ui-ux-design.md) pour les choix
  esthétiques précis et les tokens.
- [06 — Multilingue & humanisation](06-multilingue-humanisation.md)
  pour la cadence de frappe et les salutations.
- [12 — Tests](12-tests.md) pour la matrice de scénarios.

# F01 — Widget initialization (lazy mount + portal + feature flag)

## 1. Description fonctionnelle

### 1.1 Cible

Initialiser le widget chat **sans pénaliser** le rendu de la page hôte (Kit, Journal,
etc.) tout en garantissant qu'il est **présent et fonctionnel** dès que le visiteur en a
besoin.

### 1.2 Comportement attendu (happy path)

1. La page hôte se charge (LCP < 2,5 s). Le widget **n'est pas dans le DOM initial** ; un
   stub `<ChatWidgetDeferred />` est rendu.
2. Après `requestIdleCallback` (~100-300 ms post-FID), le composant `ChatWidget` est lazy-
   loaded via `dynamic(() => import('./ChatWidget'), { ssr: false })`.
3. Un portail React (`ChatWidgetMount`) injecte le widget dans `document.body` pour
   échapper à l'arbre de stacking de la page.
4. Le feature flag `CHAT_ENABLED` est vérifié via `chat/feature-flag.ts` (env + DB) ;
   si désactivé, le widget reste invisible.
5. Une session anonyme est créée en arrière-plan (`POST /api/chat/session`) si pas déjà
   présente dans le cookie `chat_session_id`.
6. Le bouton `ChatLauncher` apparaît avec animation d'entrée (fade-in 200 ms).

### 1.3 Comportements alternatifs

| Cas | Comportement attendu |
|-----|----------------------|
| Feature flag OFF | Aucun élément DOM, aucune requête API |
| Cookie `chat_session_id` valide | Reprise session, pas de POST /session |
| `POST /api/chat/session` 500 | Retry × 2 (exp backoff 500 ms / 1500 ms), puis fallback : pas de session, widget en mode "WhatsApp link" |
| JS error sur lazy load | Boundary error capture + log + widget caché |
| User agent old (IE 11, etc.) | Widget caché (graceful degradation), pas de crash |
| `prefers-reduced-motion: reduce` | Pas d'animation d'entrée |
| Mobile portrait | Launcher en bottom-right, panel full-screen au tap |
| RTL locale (ar-MA) | Launcher en bottom-LEFT, panel RTL |

### 1.4 Interfaces / contrats

**Composants** :
- `<ChatWidget />` — racine, accepte props `{ language?, pageContext? }`
- `<ChatWidgetDeferred />` — stub léger, exporte le real widget après mount
- `<ChatWidgetMount />` — portal vers `document.body`
- `<ChatLauncher />` — bouton FAB

**Hooks** :
- `useChatSession()` — crée/lit session, retourne `{ sessionId, visitorId, isReady }`
- `useFeatureFlag('CHAT_ENABLED')` — lit DB toggle (cached)

**API** :
- `POST /api/chat/session` — body `{ visitorId?, pageUrl, language?, utm? }` → `{ sessionId, visitorId, language }`

**Events tracking** :
- `chat_widget_init` — fired après mount
- `chat_widget_visible` — fired si launcher visible

### 1.5 Dépendances

- Feature flag DB (`chat_runtime_setting.chat_enabled`)
- Cookie `chat_session_id`, `visitor_id`
- Tables : `chat_session`, `chat_runtime_setting`
- Composants partagés : `Portal`, `Toast` (erreurs)
- Lib : `dynamic` (Next.js), `react-error-boundary`

## 2. Pourquoi tester (risques)

### 2.1 Risques métier

- **Pas de chat visible** → 0 % engagement (P1 du funnel)
- **Délai d'apparition > 1 s** → visiteur quitte avant qu'apparaisse
- **Crash JS** → page entière potentiellement cassée (si pas de boundary)

### 2.2 Risques techniques

- **Race condition** : feature flag fetch vs cookie read vs mount portal
- **CLS** > 0,1 si layout shift au mount du launcher
- **Memory leak** : si widget unmount mal géré (listeners SSE pas cleanup)
- **Multiple mounts** sur navigation client-side (`router.push` qui re-instantie)

### 2.3 Mapping audit

- **I8** — visitor-cookie peut produire plusieurs IDs en SSR concurrent
- Pas de finding direct, mais base de tous les autres parcours

## 3. Stratégie de test

### 3.1 Couches utilisées

- [x] Unit (hooks `useFeatureFlag`, helpers cookie)
- [x] Integration (route `/api/chat/session` + DB test)
- [x] Component (Widget + Launcher + Portal mount)
- [x] E2E (mount sur page Kit + interaction)
- [x] A11y (jest-axe sur launcher, screen reader checks)
- [x] Visual regression (launcher dark mode + RTL)

### 3.2 Outils spécifiques

- `@testing-library/react` pour mount/unmount components
- `@testing-library/user-event` pour interactions launcher
- `jest-axe` + `axe-playwright` pour accessibilité
- MSW pour `/api/chat/session`
- Playwright `page.evaluate` pour vérifier `document.body` portal

### 3.3 Données de test

- `chatSessionFactory.build()` pour stub réponse API
- `runtimeSettingFactory.build({ chatEnabled: true })` / `.disabled()`

## 4. Couverture cible

| Métrique | Cible |
|----------|-------|
| Coverage line `ChatWidgetDeferred.tsx` | 90 % |
| Coverage line `ChatLauncher.tsx` | 90 % |
| Coverage line `useChatSession.ts` | 95 % |
| Pass rate CI | 100 % |
| A11y violations | 0 critique / 0 sérieux |
| LCP impact (sur /kit) | ≤ +30 ms vs page sans widget |

## 5. Liens

- 📊 [test-matrix.csv](test-matrix.csv) — détail tests par couche × scénario
- 📜 [scenarios.gherkin](scenarios.gherkin) — scénarios Gherkin
- 📐 [sequence-diagram.puml](sequence-diagram.puml) — séquence UML
- 🧪 [vitest-suite.spec.md](vitest-suite.spec.md) — plan tests vitest
- 🎭 [playwright-suite.spec.md](playwright-suite.spec.md) — plan tests Playwright
- 🔗 [msw-handlers.md](msw-handlers.md) — handlers MSW
- ♿ [a11y-checklist.md](a11y-checklist.md) — checklist a11y
- 📦 [test-data.json](test-data.json) — fixtures
- ⚠️ [risks.md](risks.md) — risques connus

## Métadonnées

- **Owner équipe** : Frontend
- **Priorité** : P1 (bloquant release)
- **Bloquant release** : yes
- **Status doc** : DRAFT
- **Dernière mise à jour** : 2026-05-25

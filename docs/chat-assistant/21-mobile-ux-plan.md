# 21 — Mobile UX du widget chat (plan d'action)

> *Bug iOS Safari : auto-zoom sur focus textarea + clavier mange l'écran.
> Cible : UX mobile fluide, sans zoom, sans CTA caché, sans dépendance externe.*

---

## 1. Contexte et bug

### 1.1 Symptôme reproduit en prod (2026-05-12)

1. L'utilisateur ouvre le chat sur iPhone via le launcher.
2. Il tape dans la textarea (composer).
3. **iOS Safari zoome automatiquement** sur le champ → la viewport déborde,
   on perd la vue d'ensemble du panel + le bouton « Envoyer » disparaît.
4. Il faut un pinch-zoom-out manuel pour reprendre la main. UX cassée.

### 1.2 Cause racine technique

iOS Safari déclenche un **auto-zoom systématique** sur tout `<input>` /
`<textarea>` dont le `font-size` calculé est `< 16px` au moment du focus.
C'est une heuristique a11y d'iOS pour éviter le texte minuscule.

Dans `ChatComposer.tsx`, ligne 57 :

```ts
className="… text-sm …"  // text-sm = 0.875rem = 14px → trigger
```

Aggravants additionnels (audit complet 2026-05-12) :

| # | Faiblesse                                                                            | Impact mobile                                                       |
|---|---------------------------------------------------------------------------------------|----------------------------------------------------------------------|
| 1 | Textarea `text-sm` (14 px)                                                            | Auto-zoom iOS sur focus                                              |
| 2 | Panel `max-h-[min(560px,calc(100vh-9rem))]`                                           | Hauteur figée → quand le clavier monte, le panel ne se redimensionne pas |
| 3 | `100vh` (non utilisé directement, mais `calc(100vh-9rem)` l'est)                      | Sur iOS, `100vh` inclut la barre URL, fluctue, casse le layout       |
| 4 | Pas de `safe-area-inset-bottom`                                                       | Bouton « Envoyer » mangé par le notch iPhone X+                      |
| 5 | Pas de `overscroll-behavior: contain`                                                 | Scroll dans le panel fait scroller la page derrière                  |
| 6 | Launcher reste visible en mobile quand le panel est ouvert                            | FAB recouvre le panel (z-40 vs z-40) → UX confuse                    |
| 7 | Pas d'écoute `visualViewport` ni `interactiveWidget`                                  | Le panel ne sait pas que le clavier occupe la moitié basse           |
| 8 | Pas de drag-to-close mobile (geste attendu sur sheet)                                 | UX moins idiomatique, mais non-bloquant                              |

### 1.3 Comparaison des solutions (rappel)

| Solution                            | Coût   | UX mobile | Risque régression desktop | Dette ajoutée |
|-------------------------------------|--------|-----------|---------------------------|---------------|
| A. Patch minimal (`text-base` only) | 5 min  | Moyen     | Nul                       | Nul           |
| B. Lib externe (`vaul`)             | 1 j    | Excellent | Élevé (bundle +12 KB)     | Élevé         |
| C. Réécriture en `<dialog>` natif   | 2 j    | Excellent | Élevé (a11y à refaire)    | Moyen         |
| **D. Sheet responsive sur-mesure**  | **3 h**| **Excellent** | **Faible**            | **Faible**    |

→ **Solution D retenue** : on garde 100 % de l'existant desktop, on passe
en mode « sheet » full-screen sur mobile, on monte le textarea à 16 px,
on safe-area-pad, on hide le FAB en mode ouvert mobile, et on suit la
viewport visuelle pour le clavier.

---

## 2. Solution D — Conception détaillée

### 2.1 Stratégie responsive

| Breakpoint Tailwind     | Mode                        | Layout                                              |
|-------------------------|-----------------------------|------------------------------------------------------|
| `< sm` (< 640 px)       | **Sheet plein écran**       | `fixed inset-0 h-[100dvh] rounded-none`              |
| `≥ sm` (≥ 640 px)       | **Bubble bas-droite** (actuel) | `fixed bottom-28 right-7 w-[380px] max-h-[560px]` |

### 2.2 Détail des 6 fichiers à modifier (~50 LOC)

#### F1. `apps/web/src/components/chat/ChatComposer.tsx`

- Ligne 57 : `text-sm` → `text-base` (16 px) sur la textarea.
- Conserver `text-sm` sur le bouton (pas un input → pas de trigger zoom).
- Ajouter `style={{ fontSize: 'max(16px, 1rem)' }}` en safety net (cas
  où Tailwind purge `text-base`).

#### F2. `apps/web/src/components/chat/ChatPanel.tsx`

- Refactor `className` array pour différencier mobile/desktop :
  - Mobile : `inset-0 h-[100dvh] rounded-none border-0`
  - Desktop : `sm:inset-auto sm:bottom-28 sm:right-7 sm:h-auto sm:max-h-[min(560px,calc(100vh-9rem))] sm:w-[380px] sm:rounded-2xl sm:border`
- Ajouter `pb-[env(safe-area-inset-bottom)]` pour le notch.
- Ajouter `overscroll-behavior: contain` (Tailwind `overscroll-contain`).
- Ajouter un **drag-handle visuel** mobile-only (`sm:hidden`, barre
  horizontale 32×4 px centrée en haut, role="presentation"). Pas de
  drag-to-close JS pour la v1 (sortie de scope).
- Wrapper le contenu dans un `<div className="flex h-full flex-col">`
  pour que `MessageList` (`flex-1`) prenne la hauteur restante.

#### F3. `apps/web/src/components/chat/ChatLauncher.tsx`

- Ajouter `isOpen && 'hidden sm:flex'` à `className` → en mobile, le
  FAB disparaît quand le sheet est ouvert (il est de toute façon
  recouvert et son rôle « ouvrir » devient redondant).
- Garder le bouton `aria-expanded` pour SR (toujours dans le DOM en
  desktop ; en mobile, `hidden` retire l'a11y mais le bouton de close
  intra-panel prend le relais).

#### F4. `apps/web/src/components/chat/MessageList.tsx`

- Greeting + bubbles : `text-sm` (14 px) → conservé (bubbles ne sont
  pas focusables, donc pas de trigger zoom).
- Container : ajouter `overscroll-behavior: contain` pour empêcher le
  scroll bleed-through sur la page sous-jacente.
- Aucun changement de taille de police (les bubbles restent en 14 px,
  ce qui est lisible).

#### F5. `apps/web/src/app/layout.tsx`

- Ligne 62-66 `viewport` : ajouter `interactiveWidget: 'resizes-content'`
  (hint Chrome Android pour resize le viewport quand le clavier monte).
- **Ne pas** ajouter `maximumScale: 1` ou `userScalable: false` (viole
  WCAG SC 1.4.4 → fail axe-core).

#### F6. NEW `apps/web/src/components/chat/hooks/use-visual-viewport.ts`

```ts
'use client';
import { useEffect, useState } from 'react';

/**
 * Retourne la hauteur de la viewport visuelle (i.e. en mobile,
 * l'écran moins le clavier virtuel). Fallback `window.innerHeight`
 * pour les navigateurs sans `visualViewport`.
 *
 * Usage : permet à `ChatPanel` d'ajuster sa hauteur live quand le
 * clavier iOS apparaît / disparaît.
 */
export function useVisualViewportHeight(): number | null {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    const read = () => setH(vv?.height ?? window.innerHeight);
    read();
    vv?.addEventListener('resize', read);
    vv?.addEventListener('scroll', read);
    return () => {
      vv?.removeEventListener('resize', read);
      vv?.removeEventListener('scroll', read);
    };
  }, []);
  return h;
}
```

Le hook sera consommé optionnellement par `ChatPanel` via
`style={{ height: vh ?? undefined }}` en mobile uniquement
(via media query côté JS pour éviter le SSR mismatch).

### 2.3 Pas de modification de :

- `MessageBubble.tsx` (bubbles user/assistant) — pas de trigger zoom.
- `ChatHeader.tsx` — déjà OK (bouton de close existe).
- `LeadFormBubble.tsx` — déjà géré par le funnel embedded.
- Le state Zustand — pas de changement de comportement.
- L'API SSE `/api/chat/message` — aucun impact backend.

---

## 3. Stratégie de tests (DoD)

### 3.1 Unit / composants (Vitest + RTL)

Fichier : `apps/web/src/components/chat/ChatComposer.test.tsx` (NEW)

- ✅ La textarea expose un `font-size` ≥ 16 px (assert `text-base`
  présent OU `style.fontSize`).
- ✅ La textarea expose `data-testid="chat-input"` (régression contrat).

Fichier : `apps/web/src/components/chat/ChatPanel.test.tsx` (NEW)

- ✅ Mobile : `inset-0 h-[100dvh]` présents dans `className`.
- ✅ Desktop (sm+) : `sm:bottom-28`, `sm:right-7`, `sm:w-[380px]` présents.
- ✅ `overscroll-contain` présent.
- ✅ `pb-[env(safe-area-inset-bottom)]` présent.
- ✅ Drag-handle mobile-only présent dans le DOM (`sm:hidden`).

Fichier : `apps/web/src/components/chat/ChatLauncher.test.tsx` (EDIT)

- ✅ Ajout test : « FAB caché en mobile quand panel ouvert » →
  vérifier que `hidden` apparaît dans `className` quand `isOpen=true`.

Fichier : `apps/web/src/components/chat/hooks/use-visual-viewport.test.tsx` (NEW)

- ✅ Retourne `window.innerHeight` quand pas de `visualViewport`.
- ✅ Met à jour la valeur quand `visualViewport.resize` se déclenche
  (mock `dispatchEvent`).

### 3.2 E2E (Playwright, projet `chromium-mobile`)

Fichier : `apps/web/e2e/chat-mobile-ux.spec.ts` (NEW)

Hypothèses :
- `PLAYWRIGHT_CROSS=1` (déjà documenté pour `product-feed`).
- Viewport mobile : `chromium-mobile` projet (375×812).
- MSW activé via `request.route()` Playwright pour mocker
  `/api/chat/message` (SSE simple).

Scénarios couverts :

1. **No zoom on focus** : focus la textarea → vérifier que
   `document.documentElement.clientWidth === window.innerWidth`
   (i.e. pas de zoom) ET que le `font-size` calculé du textarea
   est ≥ 16 px.

2. **Panel couvre la viewport** : après ouverture, vérifier que
   le `boundingClientRect()` du panel = la viewport (375×812).

3. **Send button reachable** : après focus textarea, le bouton
   `chat-send` reste dans la viewport (`isInViewport()`).

4. **Launcher hidden on mobile when open** : vérifier que
   `chat-launcher` a `display: none` après ouverture.

5. **A11y axe-core** : 0 violation sérieuse sur le panel ouvert.

6. **Desktop preserved** : `chromium` projet (1280×720), vérifier
   que le panel est toujours 380×560 bottom-right (régression nulle).

### 3.3 MSW

Fichier : `apps/web/test/msw/chat/mobile-handlers.ts` (NEW)

Handler MSW pour `/api/chat/message` qui renvoie une réponse SSE
minimale (1 chunk + done), utilisé par les tests unitaires si on
veut tester le flux complet sans backend.

Pour le Playwright E2E, on utilise `page.route('/api/chat/**')`
directement, plus simple que MSW dans le browser context.

### 3.4 A11y

- `@axe-core/playwright` : assertion 0 violation sur le panel mobile.
- Lighthouse mobile a11y score ≥ 95 (manuel post-déploiement).

---

## 4. Critères de succès (DoD)

| Critère                                                      | Méthode de vérification                          |
|---------------------------------------------------------------|--------------------------------------------------|
| Aucun zoom iOS sur focus textarea                             | E2E `chromium-mobile` + QA manuelle iPhone       |
| Panel couvre 100 % de la viewport en mobile                   | E2E (boundingClientRect)                         |
| Bouton « Envoyer » visible avec clavier ouvert                | QA manuelle (E2E ne simule pas le clavier réel)  |
| Desktop 380×560 bas-droite **inchangé**                       | E2E `chromium` + screenshots avant/après         |
| 0 violation axe-core sérieuse                                 | E2E axe-core                                     |
| `bun run typecheck` + `bun run lint` verts                    | CI                                               |
| Tous les tests Vitest existants verts (régression nulle)      | `bun run test`                                   |
| `text-base` (16 px) **uniquement** sur la textarea (pas sur les bubbles, qui restent en `text-sm`) | Code review                                      |
| Pas de nouvelle dépendance npm                                | `git diff package.json` vide                     |

---

## 5. Plan de rollback

| Niveau          | Action                                                   | Délai     |
|------------------|----------------------------------------------------------|-----------|
| Code (urgence)   | `git revert <sha-de-merge>` + redeploy Vercel            | < 5 min   |
| Hot-fix CSS only | Sur Vercel : env override `NEXT_PUBLIC_CHAT_MOBILE_MODE=legacy` (n'existe pas, on n'introduit pas de flag → rollback = revert seulement) | n/a       |
| Feature flag     | **Non utilisé** — la modif est trop chirurgicale pour justifier un flag, et le risque est limité à la couche presentation | n/a       |

Décision : pas de feature flag. Le risque est faible, le rollback git
est suffisant.

---

## 6. Hors-scope (v2 potentielle)

- Drag-to-close mobile (geste swipe-down). Ajout d'une lib
  type `@use-gesture/react` (8 KB) ou impl maison (~80 LOC).
- Mode tablette (≥ 768 px portrait) : pour l'instant traité comme
  desktop, mais 768×1024 pourrait mériter une variante.
- Haptic feedback (`navigator.vibrate`) sur ouverture/fermeture.
- Animation spring-physics (vs `motion-safe:animate-in` actuel).

---

## 7. Exécution

Suivre **`22-mobile-ux-runbook.md`**. Le runbook décompose la mise en
œuvre en 10 phases avec gates de validation entre chaque.

Estimation : 3 h de travail focused (code + tests + QA).

---

**Auteurs** : Souheila (PO) · Claude (impl) · Bug rapporté par
utilisatrice mobile 2026-05-12.

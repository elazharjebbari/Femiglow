# 22 — Mobile UX du widget chat (runbook d'exécution)

> *Exécution pas-à-pas du plan `21-mobile-ux-plan.md`. Chaque phase
> a un gate de validation : si rouge, on ne passe pas à la suivante.*

---

## Pré-conditions

```sh
cd /Users/elazhar/PycharmProjects/template-femiglow/apps/web
source ~/.nvm/nvm.sh && nvm use 22       # Node 22, requis par pnpm
git status                                # working tree clean
```

Tous les chemins sont relatifs à `apps/web/` sauf mention contraire.

---

## Phase 1 — Patch `ChatComposer.tsx` (textarea 16 px)

**Objectif** : tuer le trigger iOS auto-zoom à la racine.

**Action** : éditer `src/components/chat/ChatComposer.tsx` ligne 57 :
- Remplacer `text-sm` (sur la textarea seulement) par `text-base`.
- Conserver `text-sm` sur les boutons (Stop / Envoyer) — ils ne sont
  pas focusables au sens « champ texte » donc pas de trigger zoom.

**Gate**:
```sh
bun run typecheck
```
→ doit être vert. Si rouge, fix typo et recommencer.

---

## Phase 2 — Patch `ChatPanel.tsx` (sheet responsive)

**Objectif** : full-screen mobile, bubble desktop inchangée.

**Action** : éditer `src/components/chat/ChatPanel.tsx` :

1. Remplacer le tableau `className` par :
   ```ts
   className={[
     // Base (mobile = sheet full-screen)
     'fixed z-40 inset-0 h-[100dvh]',
     'flex flex-col overflow-hidden border-0 bg-white shadow-2xl shadow-stone-900/10',
     'overscroll-contain',
     'pb-[env(safe-area-inset-bottom)]',
     // Desktop (≥ sm) : bubble bas-droite, override des règles mobile
     'sm:inset-auto sm:bottom-28 sm:h-auto sm:max-h-[min(560px,calc(100vh-9rem))]',
     'sm:w-[380px] sm:rounded-2xl sm:border sm:border-stone-200',
     'sm:pb-0',
     'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200',
     positionClass,
   ].join(' ')}
   ```
   Note : `positionClass` (right-5/sm:right-7 ou left-5/sm:left-7) reste
   actif pour le **desktop** uniquement (`right-5` est neutralisé par
   `inset-0` en mobile).

2. Ajouter le drag-handle visuel mobile-only **juste au-dessus** de
   `<ChatHeader />` :
   ```tsx
   <div
     aria-hidden
     className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-stone-300"
   />
   ```

**Gate**:
```sh
bun run typecheck
```

---

## Phase 3 — Patch `ChatLauncher.tsx` (FAB hidden mobile when open)

**Objectif** : éviter la collision FAB ↔ sheet en mobile.

**Action** : éditer `src/components/chat/ChatLauncher.tsx`, dans le
tableau `className` du `<button>`, ajouter :
```ts
isOpen ? 'hidden sm:flex' : 'flex',
```
(remplace l'absence de cette classe). Le `flex` était déjà présent en
ligne 74 ; on le rend conditionnel.

**Gate** :
```sh
bun run typecheck
bun run test src/components/chat/ChatLauncher.test.tsx
```
→ les 2 tests existants doivent rester verts. On ajoutera un 3ᵉ test
en Phase 7.

---

## Phase 4 — Patch `MessageList.tsx` (overscroll-contain)

**Objectif** : empêcher le scroll de la liste de bleed-through sur la
page sous-jacente en mobile.

**Action** : éditer `src/components/chat/MessageList.tsx` ligne 47,
ajouter `overscroll-contain` à `className` du `<div ref={containerRef}>`.
**Ne pas** modifier les `text-sm` des bubbles (intentionnel, lisible).

**Gate** :
```sh
bun run typecheck
```

---

## Phase 5 — Patch `app/layout.tsx` (viewport hint)

**Objectif** : signaler à Chrome Android de resize au lieu de superposer.

**Action** : éditer `src/app/layout.tsx` ligne 62-66 :
```ts
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content', // ← ajouté
  themeColor: '#FBF8F1',
};
```
**Ne pas** ajouter `maximumScale` ni `userScalable: false` (WCAG fail).

**Gate** :
```sh
bun run typecheck
```

---

## Phase 6 — Créer `hooks/use-visual-viewport.ts`

**Objectif** : exposer la hauteur de la viewport visuelle (clavier-aware).
Pour la v1, on ne le branche **pas** dans `ChatPanel` (le `100dvh` +
`interactiveWidget` suffisent dans 95 % des cas). On livre néanmoins le
hook + son test pour la v2 et pour les futurs cas de bord iOS où
`100dvh` est imparfait.

**Action** : créer `src/components/chat/hooks/use-visual-viewport.ts`
avec le contenu défini dans `21-mobile-ux-plan.md` §2.2 F6.

**Gate** :
```sh
bun run typecheck
```

---

## Phase 7 — Tests unitaires Vitest

**Objectif** : verrouiller chaque modif via une assertion régression.

### 7.1 NEW `src/components/chat/ChatComposer.test.tsx`

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { ChatComposer } from './ChatComposer';

vi.mock('./chat-store', () => ({
  useChatStore: (sel: any) => sel({
    language: 'fr', isStreaming: false,
  }),
}));
vi.mock('./hooks/use-chat-send', () => ({
  useChatSend: () => ({ send: vi.fn(), cancel: vi.fn() }),
}));

afterEach(cleanup);

describe('ChatComposer (anti-zoom iOS)', () => {
  it('expose un font-size ≥ 16 px sur la textarea (text-base)', () => {
    render(<ChatComposer />);
    const ta = screen.getByTestId('chat-input');
    expect(ta.className).toContain('text-base');
    expect(ta.className).not.toMatch(/(^|\s)text-sm(\s|$)/);
  });

  it("préserve data-testid pour les e2e", () => {
    render(<ChatComposer />);
    expect(screen.getByTestId('chat-input')).toBeInstanceOf(HTMLTextAreaElement);
    expect(screen.getByTestId('chat-send')).toBeInstanceOf(HTMLButtonElement);
  });
});
```

### 7.2 NEW `src/components/chat/ChatPanel.test.tsx`

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ChatPanel } from './ChatPanel';

vi.mock('./chat-store', () => ({
  useChatStore: (sel: any) => sel({
    isOpen: true, language: 'fr', close: vi.fn(),
  }),
}));
vi.mock('./hooks/use-chat-session', () => ({ useChatSession: () => {} }));
vi.mock('./ChatComposer', () => ({ ChatComposer: () => <div data-testid="composer" /> }));
vi.mock('./ChatHeader', () => ({ ChatHeader: () => <div data-testid="header" /> }));
vi.mock('./MessageList', () => ({ MessageList: () => <div data-testid="messages" /> }));

afterEach(cleanup);

describe('ChatPanel (responsive sheet)', () => {
  it('mobile : inset-0 + h-[100dvh] + overscroll-contain + safe-area', () => {
    const { container } = render(<ChatPanel />);
    const panel = container.querySelector('[data-testid="chat-panel"]')!;
    expect(panel.className).toContain('inset-0');
    expect(panel.className).toContain('h-[100dvh]');
    expect(panel.className).toContain('overscroll-contain');
    expect(panel.className).toContain('pb-[env(safe-area-inset-bottom)]');
  });

  it('desktop : sm:bottom-28 + sm:w-[380px] + sm:rounded-2xl conservés', () => {
    const { container } = render(<ChatPanel />);
    const panel = container.querySelector('[data-testid="chat-panel"]')!;
    expect(panel.className).toContain('sm:bottom-28');
    expect(panel.className).toContain('sm:w-[380px]');
    expect(panel.className).toContain('sm:rounded-2xl');
    expect(panel.className).toContain('sm:inset-auto');
  });

  it('drag-handle visuel mobile-only présent', () => {
    const { container } = render(<ChatPanel />);
    const handle = container.querySelector('.sm\\:hidden.rounded-full');
    expect(handle).not.toBeNull();
  });
});
```

### 7.3 EDIT `src/components/chat/ChatLauncher.test.tsx`

Ajouter un 3ᵉ bloc `it` au describe existant :
```tsx
it('mobile : FAB caché (hidden sm:flex) quand panel est ouvert', () => {
  // On reset le store mocké pour simuler isOpen=true. Comme le mock
  // initial du fichier n'expose pas isOpen, on ajoute un mock zustand
  // au-dessus si nécessaire. Pour la v1 on teste juste la prop visuelle :
  // on rend en passant un prop dérivé. Simplification : on lit le DOM.
  // (Détail d'implémentation : ChatLauncher lit isOpen du store directement,
  // donc on doit mocker le store via vi.mock('./chat-store') comme dans
  // ChatComposer.test.tsx.)
});
```

⚠ Vu la structure actuelle (le fichier ne mocke pas `chat-store`), il
est plus propre de créer un **nouveau** fichier
`ChatLauncher.mobile.test.tsx` dédié, qui mocke `chat-store` avec
`isOpen=true` :
```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: vi.fn() }),
}));
vi.mock('./chat-store', () => ({
  useChatStore: (sel: any) => sel({
    isOpen: true, language: 'fr', toggle: vi.fn(),
    sessionId: 's1', messages: [],
  }),
}));

// Import APRÈS les mocks
import { ChatLauncher } from './ChatLauncher';

afterEach(cleanup);

describe('ChatLauncher (mobile, panel ouvert)', () => {
  it('cache le FAB en mobile (hidden) et le garde en desktop (sm:flex)', () => {
    const { container } = render(<ChatLauncher />);
    const button = container.querySelector('[data-testid="chat-launcher"]')!;
    expect(button.className).toContain('hidden');
    expect(button.className).toContain('sm:flex');
  });
});
```

### 7.4 NEW `src/components/chat/hooks/use-visual-viewport.test.tsx`

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVisualViewportHeight } from './use-visual-viewport';

afterEach(() => { vi.restoreAllMocks(); });

describe('useVisualViewportHeight', () => {
  it('retourne window.innerHeight si visualViewport absent', () => {
    const orig = window.visualViewport;
    // @ts-expect-error mock
    delete window.visualViewport;
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    const { result } = renderHook(() => useVisualViewportHeight());
    expect(result.current).toBe(800);
    // @ts-expect-error restore
    window.visualViewport = orig;
  });

  it("met à jour la valeur quand visualViewport.resize se déclenche", () => {
    const listeners = new Map<string, EventListener>();
    const fakeVV = {
      height: 600,
      addEventListener: (ev: string, cb: EventListener) => listeners.set(ev, cb),
      removeEventListener: (ev: string) => listeners.delete(ev),
    };
    // @ts-expect-error mock
    window.visualViewport = fakeVV;
    const { result } = renderHook(() => useVisualViewportHeight());
    expect(result.current).toBe(600);

    act(() => {
      fakeVV.height = 400;
      listeners.get('resize')?.(new Event('resize'));
    });
    expect(result.current).toBe(400);
  });
});
```

**Gate** :
```sh
bun run test src/components/chat/ChatComposer.test.tsx \
            src/components/chat/ChatPanel.test.tsx \
            src/components/chat/ChatLauncher.test.tsx \
            src/components/chat/ChatLauncher.mobile.test.tsx \
            src/components/chat/hooks/use-visual-viewport.test.tsx
```
→ tous verts. Si rouge, fix avant de continuer.

---

## Phase 8 — E2E Playwright mobile

**Objectif** : verrouiller le comportement runtime sur viewport réelle.

**Action** : créer `e2e/chat-mobile-ux.spec.ts`.

```ts
/**
 * E2E : UX mobile du widget chat (anti-zoom iOS + sheet full-screen).
 *
 * Cible : projet `chromium-mobile` (375×812). Le test est skip-é
 * sur les autres projets pour éviter le bruit en CI desktop.
 *
 * Hypothèses :
 *  - Page d'entrée : `/` (le launcher est mounté globalement).
 *  - `/api/chat/**` est intercepté via `page.route()` pour éviter
 *    le besoin d'un backend.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Chat mobile UX', () => {
  test.skip(
    ({ browserName }, info) => info.project.name !== 'chromium-mobile',
    'Mobile-only spec',
  );

  test.beforeEach(async ({ page }) => {
    // Mock SSE chat — renvoie une bulle assistant immédiatement.
    await page.route('**/api/chat/message', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: [
          'event: token',
          'data: {"text":"Bonjour ! "}',
          '',
          'event: token',
          'data: {"text":"Comment puis-je vous aider ?"}',
          '',
          'event: done',
          'data: {}',
          '',
        ].join('\n'),
      });
    });
    await page.goto('/');
  });

  test('focus textarea → pas de zoom + font-size ≥ 16 px', async ({ page }) => {
    await page.getByTestId('chat-launcher').click();
    const ta = page.getByTestId('chat-input');
    await ta.focus();
    const fontSize = await ta.evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize),
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);
    // Sanity : la viewport CSS n'a pas changé de largeur.
    const { docW, winW } = await page.evaluate(() => ({
      docW: document.documentElement.clientWidth,
      winW: window.innerWidth,
    }));
    expect(docW).toBe(winW);
  });

  test('panel couvre toute la viewport (full-screen sheet)', async ({ page }) => {
    await page.getByTestId('chat-launcher').click();
    const panel = page.getByTestId('chat-panel');
    const box = await panel.boundingBox();
    const vp = page.viewportSize();
    expect(vp).not.toBeNull();
    expect(box?.width).toBeCloseTo(vp!.width, 0);
    // Hauteur ≈ viewport (tolérance pour env safe-area).
    expect(box?.height).toBeGreaterThanOrEqual(vp!.height - 20);
  });

  test('launcher caché (display:none) en mobile quand panel ouvert', async ({ page }) => {
    const launcher = page.getByTestId('chat-launcher');
    await launcher.click();
    await expect(launcher).toBeHidden();
  });

  test('bouton Envoyer reste dans la viewport après focus', async ({ page }) => {
    await page.getByTestId('chat-launcher').click();
    const ta = page.getByTestId('chat-input');
    await ta.fill('Bonjour');
    const sendBtn = page.getByTestId('chat-send');
    const box = await sendBtn.boundingBox();
    const vp = page.viewportSize()!;
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(vp.width);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(vp.height);
  });

  test('0 violation axe-core sérieuse sur le panel ouvert', async ({ page }) => {
    await page.getByTestId('chat-launcher').click();
    const results = await new AxeBuilder({ page })
      .include('[data-testid="chat-panel"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toEqual([]);
  });
});

test.describe('Chat desktop UX (régression)', () => {
  test.skip(
    ({ browserName }, info) => info.project.name === 'chromium-mobile',
    'Desktop-only spec',
  );

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/chat/message', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: 'event: done\ndata: {}\n\n',
      });
    });
    await page.goto('/');
  });

  test('panel reste 380×bubble bas-droite en desktop', async ({ page }) => {
    await page.getByTestId('chat-launcher').click();
    const panel = page.getByTestId('chat-panel');
    const box = await panel.boundingBox();
    expect(box?.width).toBeCloseTo(380, 0);
    const vp = page.viewportSize()!;
    // Ancré à droite (avec marge sm:right-7 = 28 px).
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThanOrEqual(vp.width - 60);
  });
});
```

**Gate** :
```sh
# Démarrer dev server si pas déjà fait.
# Le projet chromium-mobile n'est PAS dans la liste cross-browser par
# défaut de playwright.config.ts (qui scope les cross-projects à
# product-feed.spec.ts). On force donc l'opt-in.
PLAYWRIGHT_CROSS=1 bunx playwright test \
  --project=chromium-mobile \
  --project=chromium \
  e2e/chat-mobile-ux.spec.ts
```

⚠ Note opérationnelle : la config Playwright actuelle réserve les
projets cross-browser à `product-feed.spec.ts` (cf. `playwright.config.ts`
ligne ~120). Si l'opt-in `PLAYWRIGHT_CROSS=1` n'inclut pas
`chat-mobile-ux.spec.ts`, il faut étendre le filtre `testMatch` du
projet `chromium-mobile` pour inclure ce nouveau spec. Vérifier en
exécutant la commande ci-dessus, et patcher `playwright.config.ts`
si nécessaire (gate sub-step 8.1).

---

## Phase 9 — Suite de tests complète (régression globale)

**Objectif** : confirmer aucune régression ailleurs.

```sh
bun run typecheck
bun run lint
bun run test                           # full Vitest
PLAYWRIGHT_CROSS=1 bunx playwright test e2e/chat-mobile-ux.spec.ts
```

**Gate** : tout vert. Si rouge, root-cause + fix avant Phase 10.

---

## Phase 10 — QA manuelle live preview

**Objectif** : valider perceptivement sur viewport mobile réelle.

1. Démarrer dev server :
   ```sh
   bun run dev
   ```
2. Ouvrir le live preview (Chrome DevTools → device mode → iPhone 13).
3. Cliquer sur le launcher chat (bas-droite).
4. Tester :
   - [ ] Le panel couvre toute la viewport (pas de marges blanches).
   - [ ] Le drag-handle visuel est visible en haut.
   - [ ] Le launcher (FAB) a disparu.
   - [ ] Taper dans le champ : **aucun zoom**.
   - [ ] Le bouton « Envoyer » reste cliquable, visible.
   - [ ] Envoyer un message : la réponse apparaît, scroll auto OK.
   - [ ] Fermer via le `X` du header : retour normal, FAB réapparaît.
5. Tester en **desktop** (viewport 1280×720) :
   - [ ] Le panel s'affiche bien comme bubble 380×560 en bas-droite.
   - [ ] Aucun changement perceptible vs avant.

---

## Phase 11 — Commit + rapport

**Action** :

```sh
git status
git diff
git add apps/web/src/components/chat/ \
        apps/web/src/app/layout.tsx \
        apps/web/e2e/chat-mobile-ux.spec.ts \
        docs/chat-assistant/21-mobile-ux-plan.md \
        docs/chat-assistant/22-mobile-ux-runbook.md
```

⚠ **Ne pas committer sans demande utilisateur explicite** (cf. règle
projet : commits sur demande uniquement). En fin de runbook, présenter
le résumé des modifs + les tests verts au user et attendre `commit`.

---

## Tableau récapitulatif des gates

| Phase | Action                          | Gate de validation                                          | Bloquant ? |
|-------|----------------------------------|-------------------------------------------------------------|------------|
| 1     | Composer text-base              | `bun run typecheck`                                          | Oui        |
| 2     | Panel responsive sheet          | `bun run typecheck`                                          | Oui        |
| 3     | Launcher hidden mobile          | typecheck + ChatLauncher.test.tsx vert                       | Oui        |
| 4     | MessageList overscroll-contain  | typecheck                                                    | Oui        |
| 5     | Viewport interactiveWidget      | typecheck                                                    | Oui        |
| 6     | use-visual-viewport hook        | typecheck                                                    | Oui        |
| 7     | Tests unitaires Vitest          | 5 fichiers verts                                             | Oui        |
| 8     | E2E Playwright mobile           | spec vert sur chromium-mobile ET chromium                    | Oui        |
| 9     | Régression globale              | typecheck + lint + full test + e2e                           | Oui        |
| 10    | QA manuelle                     | checklist 10 items                                           | Non-bloquant (humain) |
| 11    | Rapport + commit                | Présenter au user, attendre OK                               | Oui        |

---

**Estimation** : 3 h pour les phases 1 à 9. QA manuelle : 15 min.

Le runbook est conçu pour être exécuté **séquentiellement** par
l'agent (auto-pilot) en mode autonome — chaque phase passe son gate
avant de débloquer la suivante (cf. règle mémoire utilisateur
« Autonomous phase execution »).

# 43 — Chat mobile UX fix (CHA-244)

**Date :** 2026-05-12 · **Owner :** El Azhar Jebbari · **Statut :** Implémenté

## Symptôme rapporté

> « Quand je clique sur le chat il me donne un écran tout blanc et on ne
> voit plus la zone de saisie ni la zone haute. Le sticky CTA est
> au-dessus, donc il barre la zone de texte, et le header aussi est
> au-dessus de la zone haute du chat. »

Confirmé en preview live (`http://localhost:3001/kit` → tap launcher).

## Diagnostic (audit)

| Élément              | Position                  | z-index calculé          |
|----------------------|---------------------------|--------------------------|
| `ChatPanel`          | `fixed inset-0`           | **40** (Tailwind `z-40`) |
| `Header` (page)      | `sticky top-0`            | **100** (`--z-sticky`)   |
| `StickyCartCTA`      | `fixed inset-x-0 bottom-0`| **100** (`--z-sticky`)   |
| Chat launcher (FAB)  | `fixed`                   | **40** (`z-40`)          |

→ Le panel chat est physiquement plein écran (`inset-0 h-[100dvh]`)
mais il est rendu **sous** le header et **sous** le sticky CTA. L'effet
visuel est :

- bandeau supérieur de la page (logo + bouton menu) **mange** la barre
  d'en-tête du chat (titre + bouton fermer) ;
- sticky CTA `/kit` (bandeau Commander + prix) **mange** le composer
  (textarea + bouton envoyer) ;
- la moitié du panel encadrée par ces deux barres apparaît « blanche »
  parce que la `MessageList` est vide tant que la session ne reçoit pas
  son greeting.

C'est aussi un problème d'**ergonomie typographique** (textes du chat à
`text-sm` = 14 px, trop petit pour la lecture en mobile sans zoom) et
d'**exit** : le bouton fermer (croix 14 × 14 px) est trop discret pour
être trouvé au premier regard.

## Plan d'action

### A. Z-index — passer le chat au-dessus de tout

1. Ajouter un token `--z-chat-overlay: 250` dans `tokens.css`, **entre**
   `--z-overlay` (200, banners) et `--z-modal` (300, dialogs lourds).
2. `ChatPanel` : `z-40` → `z-[var(--z-chat-overlay)]`.
3. `ChatLauncher` : pareil pour rester ancré quand le chat se ferme.

### B. Masquage animé du header + sticky CTA

L'utilisateur a explicitement demandé : « cacher le sticky cta quand on
ouvre le chat (animation sympa toggle quand on quitte) et pour le header
aussi ». L'approche :

- Exposer `isOpen` côté `Header` et `StickyCartCTA` via `useChatStore`.
- Quand `isOpen=true` :
  - `Header` → `translate-y-[-100%] opacity-0 pointer-events-none`
    (slide-up + fade)
  - `StickyCartCTA` → `translate-y-full opacity-0 pointer-events-none`
    (slide-down + fade)
- Transition CSS `200ms ease-out-soft` (déjà tokenisé).
- Au close : retour à l'état initial (toggle animation symétrique).
- `motion-reduce` → fallback `opacity` seul, pas de translate.

Avantage : le chat reste un overlay propre, le DOM des barres n'est pas
démonté → focus restauré naturellement.

### C. Exit clair

Remplacer la croix 14 × 14 du `ChatHeader` par :

- bouton **44 × 44** (cible WCAG 2.5.5 AAA),
- icône **chevron-down** (« retour à la page »),
- label texte **« Fermer »** visible (pas seulement aria-label).

Position : en haut à droite (LTR) / à gauche (RTL).

### D. Restauration scroll + body lock

À l'ouverture, sauvegarder `window.scrollY`. Verrouiller
`document.body.style.overflow = 'hidden'` pour empêcher le scroll de la
page sous-jacente (le sheet mobile couvre déjà tout, mais sur Safari iOS
le rubber-banding traverse). À la fermeture : restaurer overflow et
`window.scrollTo(0, savedY)`. Cleanup au démontage.

### E. Polices agrandies, scopées au chat

Pour éviter le « zoom utilisateur pour lire » :

| Élément              | Avant       | Après        | Notes                       |
|----------------------|-------------|--------------|-----------------------------|
| Greeting             | `text-sm`   | `text-base`  | 14 → 16 px                  |
| `MessageBubble`      | `text-sm`   | `text-base`  | confort lecture             |
| `ChatComposer` input | `text-base` | `text-lg`    | 16 → 18 px (anti-iOS zoom)  |
| `ChatHeader` titre   | `text-sm`   | `text-base`  | titre assistante            |
| `ChatHeader` sub     | `text-[11px]` | `text-xs`  | « En ligne · répond… »      |
| Suggestion pill      | `text-xs`   | `text-sm`    | tappable plus généreux      |

Scope : on n'élargit **que** dans `[data-chat-scope]` (attribut sur le
panel). Le reste du site reste inchangé.

## Fichiers modifiés / créés

```
apps/web/src/styles/tokens.css                ← +--z-chat-overlay token
apps/web/src/components/chat/ChatPanel.tsx    ← z-index + body lock + scroll restore + scope
apps/web/src/components/chat/ChatHeader.tsx   ← bouton fermer XL + label visible
apps/web/src/components/chat/ChatComposer.tsx ← text-lg, padding plus généreux
apps/web/src/components/chat/MessageList.tsx  ← greeting text-base
apps/web/src/components/chat/MessageBubble.tsx ← bulles text-base
apps/web/src/components/chat/ChatLauncher.tsx ← z-index aligné
apps/web/src/components/layout/Header.tsx     ← masquage si chat open
apps/web/src/components/commerce/StickyCartCTA.tsx ← masquage si chat open
apps/web/src/components/chat/ChatPanel.test.tsx ← +tests z-index + body lock + scope
apps/web/src/components/layout/Header.chat-aware.test.tsx ← NEW masquage
apps/web/src/components/commerce/StickyCartCTA.test.tsx ← +test masquage
apps/web/e2e/chat-mobile-ux.spec.ts            ← NEW E2E full scenario
```

## Tests

### Unitaires (Vitest)

```bash
cd apps/web
pnpm exec vitest run --no-coverage \
  src/components/chat/ChatPanel.test.tsx \
  src/components/chat/ChatComposer.test.tsx \
  src/components/chat/ChatLauncher.test.tsx \
  src/components/chat/ChatLauncher.mobile.test.tsx \
  src/components/commerce/StickyCartCTA.test.tsx \
  src/components/layout/Header.chat-aware.test.tsx
```

Contrats vérifiés :
- ChatPanel rendu avec `data-chat-scope` et `z-index` ≥ 250.
- Bouton fermer porte le label visible **« Fermer »** + `aria-label`.
- À l'ouverture : `body.style.overflow === 'hidden'` ; à la fermeture :
  overflow restauré et `scrollTo` rappelé avec la valeur sauvegardée.
- ChatComposer textarea : classe `text-lg` (anti-zoom iOS confirmé par
  ≥ 16 px) + `min-h` agrandi.
- Header : masqué (translate-y-[-100%]) si store `isOpen=true`.
- StickyCartCTA : masqué (translate-y-full) si store `isOpen=true`.

### E2E (Playwright)

```bash
cd apps/web
pnpm exec playwright test e2e/chat-mobile-ux.spec.ts
```

Scénarios (viewport mobile iPhone 12) :
1. Sur `/kit`, tap launcher → header invisible (`opacity=0`,
   bottom < 0), sticky CTA invisible, composer visible + cliquable.
2. Tap **Fermer** → header réapparaît, sticky CTA réapparaît,
   `window.scrollY` ≈ position avant ouverture (tolérance 4 px).
3. Esc (clavier) → idem.
4. Police composer ≥ 16 px (`getBoundingClientRect` + `font-size`
   computed style) — preuve anti-zoom iOS.
5. Cible bouton fermer ≥ 44 × 44 px (WCAG 2.5.5 AAA).

## Rollback

- Retirer `--z-chat-overlay` de `tokens.css` → revient à
  `z-40 = 40 < 100` (bug réintroduit, c'est le rollback complet).
- Retirer l'écoute `useChatStore(s=>s.isOpen)` dans Header + StickyCart
  → barres redeviennent toujours visibles (état pré-fix).
- Aucune migration DB, aucun seed à toucher.

## Décisions architecturales

1. **Token z-index dédié** plutôt que `z-modal` (300) → on reste sous
   les vrais modals lourds (admin) pour ne pas perturber l'admin
   live-preview qui empile aussi un dialog.
2. **Masquage par animation** plutôt qu'un `display:none` → préserve le
   focus DOM, évite un layout-shift à la fermeture, autorise
   `motion-reduce`.
3. **Scope CSS via `data-chat-scope`** plutôt qu'un `<ChatScope>`
   provider → zéro overhead React, déclaratif, facile à retirer.
4. **Restauration scroll synchrone** (pas via Framer) → fiable même si
   l'utilisateur a fermé pendant un stream SSE en cours.

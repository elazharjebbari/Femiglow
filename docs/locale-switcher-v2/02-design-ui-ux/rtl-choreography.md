# 02 · Design — RTL choreography (le retournement LTR↔RTL)

> **Aspect couvert** : (a) la chorégraphie optimale du flip de direction pendant le fondu, (b) ce qu'il faut vérifier.
> **Invariant central** : **INV-2** — En FR→AR, `<html dir>` passe à `rtl` **dans le même fondu** ; **jamais** d'état intermédiaire visible LTR (et symétriquement AR→FR/EN).
> **Tokens** : durées/courbes de [`design-tokens.json`](design-tokens.json) (`motion.switch`, `motion.veil`).

---

## 1. Le fonctionnement optimal visé

Le retournement de direction est traité comme un **geste**, pas un glitch. Pendant l'unique fondu de bascule (~280 ms), la page **se replie** dans un sens et **se redéploie** dans l'autre. L'observateur voit une page FR (LTR) **fondre** directement vers une page AR (RTL) **déjà en miroir** — il n'aperçoit **jamais** une page arabe affichée en LTR.

### Pourquoi c'est non trivial (rappel technique)

`<html dir>`/`<html lang>` est posé par un **script inline** au chargement du document. En soft-navigation next-intl (`router.replace`), React re-rend le `<script>` mais **le navigateur ne le ré-exécute pas**. Donc, sans intervention, FR→AR en soft-nav afficherait la **page arabe en LTR** (l'« entre-deux » interdit). La parade V1 était le reload. La V2 résout ça par une **synchro `dir/lang` impérative** posée **au bon instant** : **dans le callback de transition, avant la nouvelle frame**.

---

## 2. Ce qui mirror / ce qui reste

| Élément | Comportement au flip | Mécanisme |
|---|---|---|
| `<html dir>` / `<html lang>` | **Bascule** `ltr↔rtl` / `fr↔ar↔en` | Posé impérativement dans `apply()` |
| Layout global (header, nav, switcher, CTA, grilles) | **Miroir complet** | Propriétés **logiques** (`inline-start/end`) ⇒ miroir automatique dès que `dir` change |
| Switcher trigger + chevron | **Miroir** (chevron passe côté `inline-end`) | Flux logique |
| Panneau dropdown (`end-0`) | **Miroir** (s'ancre de l'autre côté) | `inset-inline-end` |
| Point actif (sauge) | **Miroir** (passe côté `inline-end`) | Alignement logique |
| Pills / segmented (ordre) | **Ordre inversé** visuellement | Flux logique |
| Nudge (offset, label) | **Miroir** (se réancre) | Offset logique |
| Scroll position | **Reste** (préservé) | INV-3 ; soft-nav ne réinitialise pas le scroll |
| Querystring / UTM | **Reste** | INV-4 ; `buildSwitchUrl` préserve |
| Contenu textuel | **Change** (FR→AR) mais **pas de re-flow visible** hors fondu | RSC re-rendus serveur, révélés sous le voile |
| Glyphe `FemiGlow` (wordmark) | **Reste latin** | Exception INV-6 |
| Veil overlay | **Neutre, non directionnel** | Couvre l'instant du flip |

> **Principe** : tout ce qui est directionnel est piloté par `dir` + propriétés logiques ⇒ le miroir est **gratuit et atomique** au changement de `dir`. Rien n'est animé « morceau par morceau » : c'est **un seul fondu** sur tout le document.

---

## 3. Pourquoi `dir` est posé DANS le callback de transition (anti-glitch)

C'est le cœur de INV-2. L'ordre est **impératif** :

```ts
const apply = () => {
  const html = document.documentElement;
  html.lang = next;            // 1) lang d'abord
  html.dir  = DIRECTION[next]; // 2) dir AVANT le rendu de la nouvelle frame
  announce(next);              // 3) aria-live (INV-10)
  router.replace(url, { locale: next }); // 4) soft-nav next-intl
};
```

- **View Transitions (C3)** : `document.startViewTransition(apply)` capture un **snapshot de l'ancien état** (FR/LTR), exécute `apply()` (qui pose `dir=rtl` **avant** que la nouvelle frame soit peinte), puis fait le **cross-fade old→new**. La nouvelle frame est donc **déjà en RTL** quand elle apparaît. ⇒ **Aucune frame LTR-arabe n'existe jamais.**
- **Veil fallback (C4)** : le voile crème est **opaque** (opacity 1) **pendant** `apply()`. Le flip `dir` se produit **derrière** le voile. Quand le voile redescend, la page est **déjà en RTL**. ⇒ même garantie, par occlusion.

> Si `dir` était posé **après** la nouvelle frame (ex. dans un `useEffect` post-navigation), le navigateur peindrait **au moins une frame** de page arabe en LTR avant correction ⇒ glitch visible ⇒ **INV-2 cassé**. D'où la règle : **`dir` dans le callback, avant la frame**.

---

## 4. Timing (tokens)

| Phase | Durée | Token | Note |
|---|---|---|---|
| **Fondu VT (C3)** | `280ms` | `motion.switch.duration` | `cubic-bezier(0.22,1,0.36,1)` (`motion.switch.easing`) sur `::view-transition-old/new(root)` |
| Voile fade-in (C4) | `160ms` | `motion.veil.fadeIn` | opacity 0→1 |
| `apply()` (flip + soft-nav) | ~instantané | — | exécuté pendant l'opacité 1 du voile / dans le callback VT |
| Voile fade-out (C4) | `160ms` | `motion.veil.fadeOut` | opacity 1→0, RTL révélé |
| **Total perçu** | ≤ ~320 ms p75 | `goals-kpis.md` K6 | borne charte 280–560 ms |

CSS de transition (charte) :

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 280ms;
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
```

---

## 5. Reduced-motion (INV-7)

`prefers-reduced-motion: reduce` ⇒ **bascule instantanée, sans animation, toujours sans reload** :

- **Pas** de `startViewTransition`, **pas** de voile monté.
- `apply()` est appelé **directement** : `dir/lang` posés + `aria-live` + soft-nav, **dans le même tick**.
- Le flip RTL reste **atomique** (toujours pas d'entre-deux LTR), simplement **sans fondu**.
- Event `locale_switch` émis avec `transition: 'reduced'`.

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) { animation: none; }
}
```

---

## 6. Edge cases du flip

| Cas | Comportement |
|---|---|
| AR→FR / AR→EN | Même chorégraphie, sens inverse ; `dir` repasse `ltr` dans le callback |
| FR→EN / EN→FR (LTR→LTR) | Fondu identique, **pas** de flip `dir` (les deux LTR) — toujours `aria-live` + soft-nav |
| Clic langue active | **No-op** (INV-11) : aucun fondu, aucun flip, panneau se ferme |
| VT absente (Firefox) | Voile C4 ⇒ flip derrière l'occlusion |
| Reduced-motion | Application directe (cf. §5) |
| Hors-ligne / erreur soft-nav | Reload de secours (`window.location.assign`) ⇒ `dir` correct côté serveur (INV-1 exception) |
| Sans JS | `<a hreflang>` ⇒ navigation pleine ⇒ `dir` posé serveur (INV-8) |

---

## 7. Éléments à vérifier / tester (RTL choreography)

- [ ] **INV-2 (cœur)** : FR→AR — **0 frame** de page arabe en LTR. Test Playwright frame-by-frame (capture vidéo / screenshots successifs) + compteur client de garde (K7 = 0 %).
- [ ] `dir`/`lang` posés **avant** la nouvelle frame (VT) et **derrière** le voile (C4) — test unitaire de l'ordre des appels dans `apply()`.
- [ ] **Miroir complet** : screenshots LTR vs RTL — header, switcher, panneau (`end-0`), point actif, pills, nudge tous en miroir.
- [ ] **Scroll préservé** au flip (INV-3) et **UTM/querystring préservés** (INV-4) — Playwright.
- [ ] **Reduced-motion** : flip instantané, sans fondu, sans reload, `transition='reduced'` (INV-7).
- [ ] **LTR→LTR** (FR↔EN) : pas de flip `dir`, fondu OK, annonce émise.
- [ ] **Wordmark `FemiGlow`** reste latin en `/ar` (exception INV-6).
- [ ] **No-op** langue active : aucun flip déclenché (INV-11).
- [ ] **Fallback voile** : crème opaque couvre l'instant du flip ; jamais de blanc pur ; jamais d'entre-deux visible.
- [ ] **Aucune** propriété physique `left/right` sur les éléments du switcher (lint/grep CSS).

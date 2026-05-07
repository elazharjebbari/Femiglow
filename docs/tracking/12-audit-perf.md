# Audit perf — pipeline tracking

> Mesure post-instrumentation des Phase 7 (commerce funnel + engagements P1).

## Méthode

Audit statique via `next build` en mode production. Lighthouse CI complet
(LHCI) doit être lancé séparément avec un tunnel public — voir
`.lighthouserc.json` à la racine. Cette page documente le diff bundle
introduit par la couche tracking.

## Résultats build production

```
+ First Load JS shared by all                87.1 kB
  ├ chunks/740-f3574f602299b1af.js           31.6 kB
  ├ chunks/a52579dc-00ba1ed27c771eb6.js      53.6 kB
  └ other shared chunks (total)              1.89 kB

ƒ Middleware                                 44.3 kB
```

| Route        | Page-only | First-Load JS | Évents émis                                                     |
| ------------ | --------- | ------------- | --------------------------------------------------------------- |
| `/` (maison) | 3.28 kB   | 130 kB        | `page_view`, `scroll`                                           |
| `/rituel`    | 3.53 kB   | 133 kB        | `page_view`, `scroll`, `video_start/complete/transcript_open`   |
| `/kit`       | 0.26 kB   | 169 kB        | `page_view`, `view_item`, `add_to_cart`                         |
| `/journal`   | 4.53 kB   | 134 kB        | `page_view`, `scroll`                                           |
| `/journal/*` | 3.73 kB   | 133 kB        | `page_view`, `journal_read_75`                                  |
| `/contact`   | 3.08 kB   | 172 kB        | `page_view`, `contact_submit`, `generate_lead`                  |
| `/panier`    | 6.97 kB   | 185 kB        | `page_view`, `view_cart`, `begin_checkout`                      |
| `/commander` | 2.64 kB   | 137 kB        | `page_view`, `add_shipping_info`, `add_payment_info`            |
| `/merci`     | 8.98 kB   | 104 kB        | `page_view`, `purchase`                                         |

Cibles internes (FemiGlow charte perf) :

- **Shared First-Load JS** : ≤ 100 kB → **87.1 kB ✓**
- **First-Load JS / route critique (kit, commander, panier)** : ≤ 200 kB → **169 / 137 / 185 kB ✓**
- **Middleware Edge** : ≤ 1 MB Vercel cap → **44.3 kB ✓**

## Optimisations appliquées

1. **Throttle scroll trackers via `requestAnimationFrame`** — `ScrollDepthTracker`
   et `ScrollMilestonesTracker` exécutent au plus une mesure par frame, INP non
   dégradé.
2. **Mount-once via `useRef`** — `ViewItemTracker`, `view_cart`,
   `begin_checkout`, `purchase` ne ré-émettent jamais après le premier mount.
3. **Découplage CSP / adaptateurs** — `tracking/providers/csp-hosts.ts`
   expose une table statique d'hôtes par kind ; le middleware ne pulle plus
   `node:crypto` (compatible Edge Runtime). Sans ça, `next build` échouait.
4. **TrackingProvider non bloquant** — `loadConsent()` exécuté en `useEffect`,
   le SSR n'attend pas la lecture localStorage. Le batcher flush sur
   `visibilitychange` / `pagehide` (pas de fetch synchrone au render).
5. **PromotionTracker via IntersectionObserver** — coût zéro tant que le
   bandeau est hors viewport ; déconnecté après émission.

## Risques résiduels

- **/contact 172 kB** : poids du formulaire react-hook-form + zod, déjà
  hérité avant tracking. Pas un blocage go-live ; à retravailler en pivot
  perf si LCP > 2.5 s sur 3G mobile.
- **/panier 185 kB** : Zustand cart + tracking ; surveiller LCP réel
  (Lighthouse mobile) avant la pré-vente.
- **MerciOrchestrator** sur `/merci` est lourd (8.98 kB page-only) à cause
  de `useCartStore` + `readLastOrder`. Acceptable car la page est terminale.

## Commandes de re-audit

```bash
# Bundle (rapide, locale)
pnpm --filter @femiglow/web build

# Lighthouse CI complet (CI ou local avec tunnel)
pnpm dlx @lhci/cli@0.13 autorun --config=.lighthouserc.json
```

## TODO post go-live

- Mesurer LCP terrain (CrUX) sur `/kit` et `/panier` dès J+30.
- Si dépassement budget perf > 10 % : tester `next/dynamic` sur
  `<ConsentBanner />` + `<DebugOverlay />`.
- Si conversion stagnante : étendre `view_promotion` aux blocs hero
  d'accueil (`<Hero data />`) avec un `<PromotionTracker>` slot.

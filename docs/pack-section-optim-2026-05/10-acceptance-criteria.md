# 10 — Critères d'acceptation et non-régression

Checklist exhaustive pour valider chaque phase et garantir l'absence de
régression. Référence : `08-plan-action-phases.md` (7 phases).

## 1. Critères globaux (toute phase)

Avant merge :

- [ ] `pnpm --filter web exec tsc --noEmit` clean (0 erreur).
- [ ] `pnpm -r lint` clean (warnings tolérables si pré-existants).
- [ ] `pnpm --filter web exec vitest run` 100 % vert (hors flakes
      pré-existants documentés dans le summary projet : `DeliveryCitiesEditor`,
      `orchestrator-lead-capture` flake parfois en parallel, pass en isolé).
- [ ] `pnpm --filter web exec playwright test --grep '@pack-'` 100 % vert.
- [ ] Couverture `lib/kit/pack/**` ≥ 90 % branches.
- [ ] Couverture `components/sections/PriceBlock|ValueBreakdownList|PackVisual`
      ≥ 85 % branches.
- [ ] Couverture `components/admin/kit-pack/**` ≥ 85 % branches.
- [ ] Pas de `eslint-disable` non commenté ajouté.
- [ ] Pas de `console.log` oublié.
- [ ] Commits respectent la convention : `feat(pack)` / `test(pack)` /
      `docs(pack)` / `chore(pack)`.
- [ ] Snapshot Playwright stable 3 runs consécutifs (0 flake).
- [ ] Aucune mention nominale de la fondatrice dans les chaînes copy
      (sweep `grep -ri "souheila" apps/web/src/`).

---

## 2. Phase 0 — Quick wins Pricing

### 2.1 Acceptation

- [ ] Helper `computePackSavings(priceFinal, priceCompareAt)` créé, pur,
      retourne `{eur: number, pct: number} | null`.
- [ ] Helper `buildPerUsageHint(priceCents, days)` créé, pur, retourne
      `string` formatée FR (`'≈ 0,75 € par soin sur 30 jours'`).
- [ ] Schemas `productFeedHeroSchema` étendus avec 3 champs optionnels :
      `valueBreakdown?`, `perUsageHint?`, `ctaAccent?`.
- [ ] Composant `ValueBreakdownList` (Server) :
  - [ ] Rend `<ul>` semantic avec items `<li>` (label / valueLabel).
  - [ ] Items marqués `muted: true` ont opacity 60 % + italic.
  - [ ] `aria-label` accessible.
- [ ] Composant `PriceBlock` (Client) :
  - [ ] Prix barré (`<s>` ou `text-decoration: line-through`) + prix XXL
        (`text-5xl` ou équivalent).
  - [ ] Bandeau « Vous économisez {eur} € · {pct} % » en couleur
        terracotta `#C28A6E` (color literal — pas Tailwind opacity-modifier
        sur var CSS).
  - [ ] Microcopy `perUsageHint` sous le prix.
  - [ ] CTA héritant du `ctaAccent`.
- [ ] Mock `productFeed.hero` enrichi avec :
  - [ ] `priceCompareAt: '49 €'`
  - [ ] `priceCompareAtAriaLabel: 'Prix non packagé'`
  - [ ] `valueBreakdown` : 4 items (1 Paste, 2 Powder, Polissoir, Notice offerte muted)
  - [ ] `perUsageHint: '≈ 0,75 € par soin sur 30 jours'`
  - [ ] `ctaAccent: 'sauge-dark'`
- [ ] Event `pack_economy_view` déclaré dans `tracking/schemas.ts`.
- [ ] IntersectionObserver attaché dans `PriceBlock` (seuil 0.3, once=true).
- [ ] Émet `pack_economy_view` avec `{savings_eur: 14, savings_pct: 29}`.

### 2.2 Non-régression Phase 0

- [ ] Tests existants `ProductFeedSection` toujours verts (refactor avec
      `PriceBlock` extrait).
- [ ] Builder `kit-feed.ts` toujours teste pass (le mock enrichi ne casse
      pas la validation `assertValidProductFeed`).
- [ ] Tests `feed.xml` Merchant inchangés (le builder XML ne lit pas les
      nouveaux champs).
- [ ] Schemas `productFeedHero` rétro-compat : un hero sans
      `valueBreakdown/perUsageHint/ctaAccent` reste valide.

### 2.3 Smoke

```bash
pnpm --filter web dev
# /kit → #product-feed
# - Prix barré 49 € visible (small, muted)
# - Prix XXL « 35 € » dominant
# - Bandeau terracotta « Vous économisez 14 € · 29 % »
# - Liste 4 items avec « Notice rituel + carte · offert » en muted
# - Microcopy « ≈ 0,75 € par soin sur 30 jours » sous le prix
# - DevTools Network → 1 event pack_economy_view au scroll
```

---

## 3. Phase 1 — CTA refonte

### 3.1 Acceptation

- [ ] Label CTA migré de `'Recevoir le pack'` à `'Commander le rituel'`.
- [ ] Variant `ctaAccent: 'sauge-dark'` rend `bg-sauge-700 text-creme`.
- [ ] Variant `ctaAccent: 'champagne'` reste compatible (fallback).
- [ ] Variant `ctaAccent: 'terracotta'` rend `bg-[#C28A6E] text-creme`.
- [ ] Keyframe `soft-pulse` ajoutée dans `tailwind.config.ts`.
- [ ] CTA porte `motion-safe:animate-soft-pulse` quand variant sauge-dark.
- [ ] `prefers-reduced-motion: reduce` désactive l'animation.
- [ ] Event `pack_cta_click` déclaré avec params `{source, cta_label, cta_accent}`.
- [ ] Click CTA → émet event + suit le `ctaHref` (anchor scroll).

### 3.2 Non-régression Phase 1

- [ ] Le `ctaHref` continue de pointer vers `#commander-femiglow`.
- [ ] Le CTA reste utilisable au clavier (Tab + Enter).
- [ ] Focus ring visible (`ring-2 ring-[#C8A876]` ou équivalent).
- [ ] Axe : 0 violation sur le CTA (contrast ratio sauge-dark + crème ≥ 4.5:1).

### 3.3 Smoke

- [ ] Visiter `/kit` → CTA vert sauge foncé avec micro-pulse perceptible
      sur 3,5 s.
- [ ] Activer DevTools Rendering → `prefers-reduced-motion: reduce` →
      animation disparaît instantanément.
- [ ] Click CTA → DevTools Network montre `pack_cta_click` puis scroll vers
      la zone `#commander-femiglow`.

---

## 4. Phase 2 — Social proof libellé + position

### 4.1 Acceptation

- [ ] `productFeedSocialProofSchema` étendu avec `countLabelGeo?` optionnel.
- [ ] Mock `socialProof.countLabelGeo: '287 maisons en France'`.
- [ ] Bloc social proof déplacé DANS `PriceBlock` (juste sous le CTA, au-dessus
      de la microcopy « Livraison + Satisfait ou remboursé »).
- [ ] Affichage priorité : `countLabelGeo` > `countLabel` (si absent).
- [ ] Étoiles `★★★★★` (Unicode U+2605) + rating `4,8/5`.
- [ ] Event `pack_social_proof_view` déclaré avec params
      `{rating, count, label_used: 'geo' | 'count'}`.
- [ ] IntersectionObserver émet l'event une seule fois au seuil 0.5.

### 4.2 Non-régression Phase 2

- [ ] L'ancien bloc social proof en bas de section retiré (pas de doublon).
- [ ] Tests existants `ProductFeedSection` à jour.
- [ ] Hierarchie ARIA OK (le bloc reste lisible aux lecteurs d'écran).
- [ ] Si `countLabelGeo` absent → fallback `countLabel` (rétro-compat).

### 4.3 Smoke

- [ ] Visiter `/kit` → la mention `★ 4,8/5 · 287 maisons en France`
      apparaît directement sous le CTA dans le bloc prix.
- [ ] DevTools Network au scroll → `pack_social_proof_view` émis 1 seule fois
      avec `label_used: 'geo'`.

---

## 5. Phase 3 — Packshot + reveal

### 5.1 Acceptation

- [ ] Composant `PackVisual` (Server) :
  - [ ] Utilise `next/image` avec `src='/products/kit-principale.svg'` par
        défaut.
  - [ ] Accepte prop `visualSrc?` pour override.
  - [ ] Alt text obligatoire (validation TypeScript).
  - [ ] Aspect ratio 4/5 préservé via `aspect-[4/5]`.
  - [ ] `loading="lazy"` (pas `priority` car en dessous du fold initial sur
        mobile).
- [ ] Composant `PackSectionTracker` (Client) :
  - [ ] IntersectionObserver attaché au mount.
  - [ ] Émet `pack_section_view` au seuil 0.3 (once=true).
  - [ ] Params : `{has_visual: boolean, layout: 'mobile' | 'desktop'}`.
- [ ] `ProductFeedSection` layout :
  - [ ] Mobile : 1 colonne, packshot SOUS le bloc prix.
  - [ ] Desktop (sm+) : 2 colonnes via `md:grid md:grid-cols-2`, packshot
        à droite.
- [ ] Reveal stagger via `LazyMotion` + `<m.div>` + `Reveal` :
  - [ ] Hero (kicker + H2) : delay 0
  - [ ] Lead : delay 0.05
  - [ ] PriceBlock : delay 0.1
  - [ ] PackVisual : delay 0.15
  - [ ] `prefers-reduced-motion` désactive l'animation (immédiat).

### 5.2 Non-régression Phase 3

- [ ] La grille 4 step cards (Préparation / Geste 1 / Geste 2 / Polissoir)
      reste rendue intacte.
- [ ] Les 3 claims (leaf / drop / sparkle) restent rendus intacts.
- [ ] LCP `/kit` mobile reste ≤ 2,5 s (le SVG est petit, < 30 kB).
- [ ] CLS ≤ 0.1 (aspect ratio préserve l'espace).
- [ ] Pas de hydration mismatch côté `PackSectionTracker`.

### 5.3 Smoke responsive

- [ ] Mobile 375×812 : layout 1 colonne, packshot visible sous le prix,
      pas de scroll horizontal.
- [ ] Desktop 1280×800 : layout 2 colonnes équilibré (50/50 ou 60/40), pack
      bien proportionné à droite.
- [ ] Reveal visible au scroll desktop : éléments arrivent en stagger 50ms.
- [ ] Toggle `prefers-reduced-motion` : animation disparaît, contenu immédiat.

---

## 6. Phase 4 — Admin éditeur singleton

### 6.A Acceptation backend (store + resolver)

- [ ] `lib/kit/pack/store.ts` : singleton id `'kit-pack'` via `ext()`.
- [ ] `upsertKitPackOverride(patch)` merge champ par champ (préserve les
      autres).
- [ ] `null` dans un patch → champ retourné au mock.
- [ ] `lib/kit/pack/resolver.ts` :
  - [ ] `resolveKitPack()` retourne mock si pas d'override publié.
  - [ ] Retourne `override-published` si publié, merge sur mock.
- [ ] `resolveKitPackDraft()` inclut les drafts non publiés (pour l'admin
      preview).
- [ ] Audit actions enregistrées dans `auditEvents` :
  - [ ] `kit_pack.update`
  - [ ] `kit_pack.publish`
  - [ ] `kit_pack.unpublish` (si applicable)
  - [ ] `kit_pack.reset`

### 6.B Acceptation API

- [ ] `GET /api/admin/kit/pack` :
  - [ ] 401 sans session admin.
  - [ ] 200 + JSON `{override, source}` avec session.
- [ ] `PATCH /api/admin/kit/pack` :
  - [ ] 401 sans session.
  - [ ] 422 si body invalide Zod.
  - [ ] 200 + `{override}` updated en cas de succès.
  - [ ] Side-effect : `auditLog('kit_pack.update', …)` appelé.
- [ ] `POST /api/admin/kit/pack/publish` :
  - [ ] 401 sans session.
  - [ ] 200 + `{override}` published.
  - [ ] Side-effects : `auditLog('kit_pack.publish', …)` +
        `revalidateTag('kit-pack')` + `revalidatePath('/kit')`.
- [ ] `POST /api/admin/kit/pack/reset` :
  - [ ] 401 sans session.
  - [ ] 200 + `{ok: true}` après suppression de l'override.
  - [ ] Side-effects : `auditLog('kit_pack.reset', …)` +
        `revalidateTag('kit-pack')`.

### 6.C Acceptation Admin UI

- [ ] `KitPackEditor` (Client) :
  - [ ] Form pré-rempli depuis override DB ou mock fallback.
  - [ ] Live validation Zod (erreurs affichées sous chaque champ).
  - [ ] Aperçu live à droite (composant `KitPackPreviewCard`) met à jour à
        chaque keystroke.
  - [ ] Bouton Save désactivé si dirty=false ou validation=false.
  - [ ] Save → toast/message « Brouillon enregistré ».
  - [ ] Publish désactivé tant que dirty (force Save d'abord).
  - [ ] Reset ouvre modale avec saisie `RESET-PACK` (magic word).
  - [ ] Reset confirmé → DELETE override + retour mock + redirect ou refresh.
- [ ] `ValueBreakdownEditor` :
  - [ ] Add/remove items (ordonné — pas de tri auto, l'ordre saisi est
        l'ordre rendu).
  - [ ] Toggle `muted` par item.
  - [ ] Max 6 items enforced.
- [ ] `KitPackPreviewCard` :
  - [ ] Rejoue le bloc prix complet (pas l'iframe entière, juste la card
        prix avec CTA).
  - [ ] Recalcule `computePackSavings` en live.
- [ ] `KitPackResetDialog` :
  - [ ] Modale `<dialog>` native ou Headless UI.
  - [ ] Bouton Confirm désactivé tant que `RESET-PACK` non saisi.
  - [ ] Escape ferme la modale.
  - [ ] Pas de race sur double-click Confirm.

### 6.D Acceptation pages admin + bind public

- [ ] `app/admin/kit/pack/page.tsx` (RSC) : appelle
      `resolveKitPackDraft()` puis rend `<KitPackEditor>`.
- [ ] `AdminShell.active` accepte `'kit-pack'` avec label « Pack /kit ».
- [ ] `components/sections/ProductFeedSectionBound.tsx` (RSC) :
  - [ ] Appelle `resolveKitPack()` (incluant cache `tag('kit-pack')`).
  - [ ] Merge l'override sur `productFeed` (champ par champ via `pickPatch`).
  - [ ] Délègue à `ProductFeedSection` avec content patché.
- [ ] `app/kit/page.tsx` utilise `<ProductFeedSectionBound>` au lieu du
      `<ProductFeedSection>` direct.

### 6.E Non-régression Phase 4

- [ ] Pages admin existantes (`/admin/seo`, `/admin/kit/video`,
      `/admin/kit/composition/*`) restent fonctionnelles.
- [ ] Sidebar `AdminShell` ajoute « Pack /kit » sans casser les autres
      entries.
- [ ] **Le feed Merchant XML (`/api/merchant-feed.xml`) reste inchangé** :
      le builder XML ne lit jamais l'override (decision sécuritaire — cf.
      doc 04). Test explicite via `feed.xml.test.ts`.
- [ ] Cycle Save → Publish → Visite `/kit` → revalidate visible en < 5 s.
- [ ] Cycle Reset → Visite `/kit` → retour mock en < 2 s.

---

## 7. Phase 5 — E2E Playwright + axe

### 7.1 Acceptation

- [ ] Spec `pack-section.spec.ts` :
  - [ ] `@pack-render` : section visible avec H2, prix barré, prix XXL,
        bandeau économie, valueBreakdown, perUsage, CTA, social proof.
  - [ ] `@pack-interaction` : click CTA → scroll vers
        `#commander-femiglow` ; event `pack_cta_click` capturé via
        `page.on('request')`.
  - [ ] `@pack-a11y` : 0 violation axe (wcag2a + wcag2aa + wcag21aa) sur
        `/kit` (filtre `main`).
  - [ ] `@pack-responsive` : viewport mobile (375×812) et desktop
        (1280×800) → layouts respectifs.
- [ ] Spec `admin-kit-pack.spec.ts` :
  - [ ] `@pack-admin` : login admin → modifier `priceCompareAt` → Save →
        Publish → vérifier sur `/kit`.
  - [ ] Reset modal bloque tant que `RESET-PACK` non saisi.
  - [ ] Axe `@pack-admin-a11y` : 0 violation sur l'éditeur.
- [ ] 0 flake sur 3 runs consécutifs (gate de merge).

### 7.2 Non-régression Phase 5

- [ ] Tous les autres tags Playwright (`@kit`, `@video-*`,
      `@composition-*`, `@og`, etc.) restent verts (0 régression).
- [ ] Pas d'augmentation du temps total Playwright > +30 s.

---

## 8. Phase 6 — README handoff + cleanup

### 8.1 Acceptation

- [ ] `apps/web/src/components/sections/README.md` (créé si absent) avec :
  - [ ] Inventaire des nouveaux composants : `PriceBlock`,
        `ValueBreakdownList`, `PackVisual`, `PackSectionTracker`,
        `ProductFeedSectionBound`.
  - [ ] Section Helpers : `computePackSavings`, `buildPerUsageHint`.
  - [ ] Section Conventions :
    - apostrophe `’` U+2019 dans JSX (pas ASCII)
    - `ctaAccent` optionnel (fallback champagne)
    - color literal `bg-[#C28A6E]/X` (pas `bg-encre/X` — pre-existing
      Tailwind opacity-modifier bug avec var CSS)
  - [ ] Section Tests (couverture cible ≥ 90 %).
  - [ ] Lien vers `docs/pack-section-optim-2026-05/`.
- [ ] Aucun import orphelin (`grep -rn "ProductFeedSection "` → tous remplacés
      par `ProductFeedSectionBound` dans `app/kit/page.tsx`).
- [ ] `pnpm --filter web exec eslint .` exit 0.
- [ ] `pnpm --filter web exec tsc --noEmit` exit 0.
- [ ] `pnpm --filter web build` exit 0.
- [ ] Coverage `lib/kit/pack/**` ≥ 90 % branches confirmée via
      `pnpm --filter web exec vitest run --coverage`.

---

## 9. Critères de non-régression globaux

### 9.1 Métadonnées critiques

- [ ] `<title>` `/kit` inchangé.
- [ ] `<meta name="description">` `/kit` inchangée.
- [ ] JSON-LD `Product` reste valide (inclut tous les sub-products via
      `additionalProperty`).
- [ ] OG image `/kit` inchangée (la refonte ne touche pas le head).
- [ ] Sitemap `/kit` toujours indexé.

### 9.2 Sections adjacentes intactes

- [ ] Hero `/kit` (refonte mai 2026) reste fonctionnel.
- [ ] Section composition (§4.3 refonte) reste fonctionnelle.
- [ ] Section ingredients (§4.5 refonte) reste fonctionnelle.
- [ ] Section vidéo (§4.4 refonte) reste fonctionnelle.
- [ ] Section témoignages (post-pack) reste fonctionnelle.
- [ ] CTA sticky mobile (si présent) inchangé.

### 9.3 Performance

- [ ] LCP `/kit` ≤ 2,5 s mobile (mesure Lighthouse).
- [ ] CLS ≤ 0,1.
- [ ] FID / INP ≤ 100 ms.
- [ ] Bundle delta total `/kit` ≤ +8 kB gzipped (PriceBlock + helpers +
      ValueBreakdownList + Tracker + PackVisual + Bound).
- [ ] TTFB SSR `/kit` ≤ 500 ms p75.
- [ ] Aucune image non optimisée (next/image partout).

### 9.4 Accessibilité

- [ ] `/kit` axe : 0 violation sérieuse/critique (post phase 5).
- [ ] `/admin/kit/pack` axe : 0 violation sérieuse/critique.
- [ ] Navigation clavier complète sur la section (Tab → CTA → social proof
      → microcopy).
- [ ] Focus visible sur tous les éléments interactifs (ring `#C8A876` ou
      équivalent).
- [ ] Contraste texte ≥ 4.5:1 (terracotta sur crème, sauge-dark sur crème).
- [ ] Lecteurs d'écran : annonce correcte du prix barré (« était
      49 euros ») via `aria-label`.

### 9.5 Comportement public

- [ ] Click CTA scroll vers `#commander-femiglow` en < 800 ms.
- [ ] `prefers-reduced-motion` désactive les transitions ET le pulse CTA.
- [ ] Aucun lien externe agressif visible.
- [ ] Tracking events conformes au schema (validation Zod runtime).
- [ ] `pack_section_view` émis 1 seule fois par session.
- [ ] `pack_economy_view` émis 1 seule fois par session.

### 9.6 Comportement admin (post phase 4)

- [ ] Édition save → publish → revalidation visible sur `/kit` en < 5 s.
- [ ] Reset → mock revient en < 2 s.
- [ ] Modale reset bloque tant que `RESET-PACK` non saisi correctement.
- [ ] Aucune fuite XSS via les champs texte (`label`, `valueLabel`,
      `perUsageHint`, `countLabelGeo`) — escape par défaut React.
- [ ] Audit log capture chaque action avec `userId`, `entity`,
      `entityId='kit-pack'`, `before`, `after`.
- [ ] Le feed Merchant XML reste inchangé même après publish d'un override
      (vérifier `curl /api/merchant-feed.xml | grep '<g:price>'`).

---

## 10. Sign-off

Une phase est close quand :

1. Toutes les cases à cocher de sa section sont validées.
2. PR review approuvée (ou auto-revue documentée dans le commit).
3. Smoke tests post-déploiement passés (cf. runbook §8.3).
4. Aucune alerte 5xx dans les 24 h suivant le déploiement.

Le plan global est livré quand :

- Phases 0–6 closes.
- Couverture tests atteinte (≥ 90 % branches `lib/kit/pack/**`).
- KPIs `02-vision-objectifs.md` §3 mesurés et conformes à J+7.
- Documentation `apps/web/src/components/sections/README.md` à jour.
- Un éditeur non-dev a publié une modification via `/admin/kit/pack` en
  < 60 s sans aide (test utilisateur).

---

## 11. Critères « show stoppers »

Bloquants absolus pour le merge sur `master` :

- ❌ Régression sur une section adjacente (hero, composition, ingredients,
  vidéo, témoignages).
- ❌ Hydration mismatch sur `/kit` (DevTools console error).
- ❌ Lighthouse `/kit` mobile < 90.
- ❌ Axe violation sérieuse/critique sur `/kit` ou `/admin/kit/pack`.
- ❌ Schema mock invalide (parse fail au démarrage du dev server).
- ❌ Bundle size delta `/kit` > 8 kB gzipped.
- ❌ Test flake > 1 fail sur 3 runs E2E.
- ❌ Feed Merchant XML modifié par l'override (sécurité business — Google
  Merchant doit voir le prix réel mock, jamais l'override admin).
- ❌ Mention nominale de la fondatrice dans la copy (brand voice).
- ❌ XSS via champ texte admin (sanitization manquante).

Si l'un de ces critères est touché, **revert immédiat de la phase
problématique** avant de débloquer le plan.

---

## 12. Métriques de qualité du dossier

Avant de livrer, vérifier que la documentation elle-même est cohérente :

- [ ] Les 10 fichiers `01-…` à `10-…` existent dans
      `docs/pack-section-optim-2026-05/`.
- [ ] Le `README.md` du dossier référence les 10 fichiers et donne un
      résumé.
- [ ] Les fichiers se citent les uns les autres (cross-références
      `(cf. doc 0X §Y)`).
- [ ] Aucune contradiction entre `08-plan-action-phases.md` et
      `09-runbook-execution.md` (mêmes phases, mêmes commandes).
- [ ] Aucune contradiction entre `07-tests-strategy.md` et les acceptances
      des tests par phase (sections 2–8 ci-dessus).
- [ ] Les chiffres `j-h` sont cohérents (somme ≈ 3,5 j).

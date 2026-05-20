# 10 — Acceptance criteria & non-régression

Checklist exhaustive. Référence : `08-plan-action-phases.md` (5 phases G0→G4
+ G5 optionnel).

## 1. Critères globaux (toute phase)

- [ ] `pnpm --filter web exec tsc --noEmit` clean (0 erreur fichiers steps)
- [ ] `pnpm -r lint` clean (warnings tolérables si pré-existants)
- [ ] `pnpm --filter web exec vitest run` 100 % vert
- [ ] `pnpm --filter web exec playwright test --grep '@steps-'` 100 % vert × 3 runs
- [ ] Couverture `lib/kit/steps/**` ≥ 90 % branches
- [ ] Couverture `components/sections/Step*` ≥ 85 % branches
- [ ] Pas de `eslint-disable` non commenté
- [ ] Pas de `console.log` oublié
- [ ] Commits respectent `feat(steps)` / `test(steps)` / `docs(steps)`
- [ ] Aucune mention nominale fondatrice
- [ ] Pas de cliché orientaliste

---

## 2. Phase G0 — Schema + builder enrichi

### 2.1 Acceptation
- [ ] Types : `duration?`, `isResult?`, `icon?` sur `ProductFeedStep`
- [ ] `ProductFeedStepIcon` enum : 'buffer' | 'drop' | 'sparkle' | 'mirror'
- [ ] `ProductFeedStepsHeader` (kicker / totalDuration / lead)
- [ ] `ProductFeedStepsPostCta` (label / anchorId)
- [ ] Zod : `productFeedSchema.steps` étendu, `stepsHeader.optional()`,
      `stepsPostCta.optional()`
- [ ] Builder produit 4 steps avec `duration` (30 s / 1 min / 2 min / 1 min)
- [ ] Step 4 a `isResult: true` et `icon: 'mirror'`
- [ ] Step 1/2/3 ont `icon: 'buffer' / 'drop' / 'sparkle'`
- [ ] `buildStepsHeader()` produit kicker EN TOUT, totalDuration « 5 minutes le soir », lead
- [ ] `buildStepsPostCta()` produit label « Démarrer le rituel », anchorId « commander-femiglow »
- [ ] Helpers purs `computeTotalDuration`, `pickResultStep` testés

### 2.2 Non-régression G0
- [ ] Tests existants `feed.xml`, `merchant-xml`, `json-ld`, `kit-feed`,
      `merchant-linter`, `merchant-xml-fuzz`, `product-feed/schema` restent verts (90 tests)
- [ ] Un `ProductFeed` sans `stepsHeader` / `stepsPostCta` reste valide
- [ ] Un `ProductFeedStep` sans `duration/isResult/icon` reste valide
- [ ] `assertValidProductFeed` strict pass sur le feed enrichi

---

## 3. Phase G1 — UI durée + outcome step 4

### 3.1 Acceptation
- [ ] `StepsHeader.tsx` rend kicker, h3 display-sm, lead
- [ ] `StepCard.tsx` :
  - [ ] Pastille avec accent color
  - [ ] Badge durée tabular-nums (« · 30 s » etc.) si `duration` présent
  - [ ] Pas de badge si absent (rétro-compat)
  - [ ] `data-is-result="true"` sur step result
  - [ ] Anneau doublé `ring-2 ring-{accent}-dark/30` sur isResult
  - [ ] Badge « RÉSULTAT » sous la pastille sur isResult
  - [ ] Description en `font-display italic` sur isResult
- [ ] `ProductFeedSection.tsx` utilise `<StepsHeader>` + `<StepCard>` à la place de l'inline

### 3.2 Non-régression G1
- [ ] Tests `ProductFeedSection.test.tsx` mis à jour passent
- [ ] Aria-label « Les quatre gestes du rituel » préservé
- [ ] Pas de hydration mismatch
- [ ] Lighthouse `/kit` mobile ≥ 92

---

## 4. Phase G2 — Connecteur visuel

### 4.1 Acceptation
- [ ] `StepsConnector` rend 2 spans `aria-hidden="true"`
- [ ] Desktop (≥ 1024) : ligne pointillée `border-t border-dashed border-encre/15` à top-6
- [ ] Mobile (< 640) : timeline verticale `bg-encre/10` à left-6, plein hauteur
- [ ] Tablet (640 ≤ x < 1024) : aucun connecteur visible
- [ ] `<ol>` parent en `relative`
- [ ] Pas de scroll horizontal mobile 375

### 4.2 Non-régression G2
- [ ] Cartes restent lisibles (z-index)
- [ ] Pas de chevauchement avec le contenu des cartes
- [ ] Axe 0 violation (connector marqué aria-hidden)

---

## 5. Phase G3 — Icônes + reveal stagger

### 5.1 Acceptation
- [ ] `StepIcon.tsx` :
  - [ ] 4 icônes : `buffer`, `drop`, `sparkle`, `mirror`
  - [ ] SVG inline stroke 1.5 currentColor
  - [ ] viewBox 0 0 24 24
  - [ ] aria-hidden="true"
  - [ ] className propagée
- [ ] Icônes rendues dans `StepCard` si `step.icon` présent
- [ ] `StepsTimeline.tsx` (Client) :
  - [ ] Wrap la grille avec LazyMotion + m.div stagger
  - [ ] `useReducedMotion` désactive le wrapper m.div
  - [ ] delay calculé `i * 0.08`, duration 0.5s ease out
- [ ] `ProductFeedSection.tsx` utilise `<StepsTimeline>`

### 5.2 Non-régression G3
- [ ] `prefers-reduced-motion: reduce` → animations désactivées
- [ ] Bundle delta `framer-motion` reste OK (déjà importé ailleurs sur le site)
- [ ] Pas de FOUC à l'arrivée des cartes

---

## 6. Phase G4 — PostCtaLink + tracking + E2E

### 6.1 Acceptation
- [ ] `StepsPostCtaLink.tsx` :
  - [ ] Rend `<a href="#anchorId">{label} ↓</a>`
  - [ ] Click → preventDefault + scrollIntoView smooth + émit event
  - [ ] Focus ring `#C8A876`
- [ ] `StepsTimeline` :
  - [ ] IO seuil 0.4 sur wrapper → émet `pack_steps_view` avec
        `{layout, total_steps, total_duration_label}`
  - [ ] IO seuil 0.5 sur step result → émet `pack_steps_complete_view`
  - [ ] Émet une seule fois par mount
  - [ ] Cleanup observers au unmount
- [ ] PostCtaLink rendu conditionnel si `postCta` présent
- [ ] Aucun event émis si `postCta` absent

### 6.2 E2E
- [ ] `@steps-render` : section visible avec header + 4 cartes + PostCta
- [ ] `@steps-render` : data-is-result="true" sur step 4
- [ ] `@steps-render` : pas de scroll horizontal mobile 375
- [ ] `@steps-interaction` : click PostCta → scroll vers wizard
- [ ] `@steps-interaction` : event `pack_steps_cta_click` capturé via `page.on('request')`
- [ ] `@steps-responsive` : desktop 4 colonnes / mobile 1 colonne avec timeline
- [ ] `@steps-a11y` : 0 violation axe sérieuse/critique
- [ ] 0 flake en 3 runs consécutifs

### 6.3 Non-régression G4
- [ ] Autres tags Playwright (`@kit`, `@video-*`, `@composition-*`, `@pack-*`, `@og`) restent verts
- [ ] Temps Playwright total ≤ +30 s

---

## 7. Phase G5 — Admin (optionnel J+30)

### 7.1 Acceptation backend
- [ ] Store memoryStore via `ext()` clé `'kit-steps'`
- [ ] Resolver cascade mock → override draft (admin) → override published (public)
- [ ] API routes auth admin (401), Zod validation (422), nominal (200), audit log
- [ ] Magic word `RESET-STEPS`

### 7.2 Acceptation UI
- [ ] `/admin/kit/steps` accessible, statut Mock/Draft/Published
- [ ] Form édite header.kicker, header.totalDuration, header.lead
- [ ] Form édite chaque step : duration, icon select, isResult checkbox
- [ ] Form édite postCta.label, postCta.anchorId
- [ ] Aperçu live à droite (`KitStepsPreviewCard`)
- [ ] Save désactivé si dirty=false ou validation Zod=false
- [ ] Publish désactivé si dirty=true
- [ ] Reset modale magic word `RESET-STEPS`
- [ ] AdminShell entry « Rituel /kit » ajoutée

### 7.3 Acceptation bind public
- [ ] `ProductFeedSectionBound` résout via `resolveKitSteps(feed)` après `resolveKitPack`
- [ ] L'override publié patche header + postCta + stepOverrides[1-4]
- [ ] Le feed XML Merchant reste inchangé

---

## 8. Non-régression globaux

### 8.1 Métadonnées critiques
- [ ] `<title>` `/kit` inchangé
- [ ] `<meta name="description">` `/kit` inchangée
- [ ] JSON-LD `Product` reste valide
- [ ] Aria-label « Les quatre gestes du rituel » préservé
- [ ] Aucun text-overlay parasite

### 8.2 Sections adjacentes intactes
- [ ] Hero `/kit` reste fonctionnel
- [ ] Section composition (§4.3 + §4.5) intacte
- [ ] Section vidéo (§4.4) intacte
- [ ] Section pack (§4.6) — PriceBlock, PackVisualBound intacts
- [ ] Témoignages mains intacts
- [ ] CTA sticky mobile inchangé

### 8.3 Performance
- [ ] LCP `/kit` mobile ≤ 2,5 s
- [ ] CLS ≤ 0.05
- [ ] FID / INP ≤ 100 ms
- [ ] Bundle delta `/kit` ≤ +3 kB gzipped
- [ ] TTFB SSR ≤ 500 ms p75

### 8.4 Accessibilité
- [ ] Axe 0 violation sérieuse/critique
- [ ] Navigation clavier : Tab → header → cartes (focusable si liens) → PostCta
- [ ] Focus visible sur PostCtaLink
- [ ] Contraste texte ≥ 4.5:1
- [ ] `aria-hidden` sur StepsConnector + Pastilles (déjà existant)
- [ ] Lecteurs d'écran : la timeline n'annonce pas les connecteurs

### 8.5 Comportement public
- [ ] Click PostCtaLink scroll < 800 ms
- [ ] `prefers-reduced-motion` désactive Framer Motion + soft-pulse
- [ ] Tracking events émis 1 seule fois par session
- [ ] Pas de re-emit en cas de scroll back

---

## 9. Sign-off

Une phase est close quand :
1. Cases section validées
2. PR review (auto-review minimum)
3. Smoke post-déploiement OK
4. Aucune alerte 5xx 24 h post-deploy

Le plan global est livré quand :
- G0-G4 closes
- Couverture ≥ 90 % `lib/kit/steps/**` (si G5 livré aussi)
- KPIs §2 mesurés J+7 et J+30
- `components/sections/README.md` à jour
- Démo : un éditeur non-dev a publié une modif `/admin/kit/steps` < 60 s sans aide (post G5)

---

## 10. Show stoppers

Bloquants absolus pour merge sur `master` :

- ❌ Régression sur section adjacente (hero, composition, ingredients, pack, vidéo, témoignages)
- ❌ Hydration mismatch sur `/kit`
- ❌ Lighthouse `/kit` mobile < 90
- ❌ Axe violation sérieuse/critique
- ❌ Schema mock invalide (parse fail au dev start)
- ❌ Bundle delta `/kit` > 3 kB gzipped
- ❌ E2E flake > 1 fail / 3 runs
- ❌ Mention nominale fondatrice dans copy
- ❌ Cliché orientaliste introduit
- ❌ XSS via champ admin (G5)

Si touché → revert immédiat de la phase problématique.

---

## 11. Métriques de qualité du dossier

- [ ] 11 docs présents (README + 01..10)
- [ ] Cross-références cohérentes
- [ ] Pas de contradiction entre 08 (plan) et 09 (runbook)
- [ ] Pas de contradiction entre 07 (tests) et acceptances §2-§7
- [ ] Sommes j-h cohérentes (~1,25 j-h pour G0-G4, +½ j G5)

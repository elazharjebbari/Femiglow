# 05 — Plan d'action (Phases 0 → 7)

> Plan d'exécution séquentiel. **Chaque phase doit être verte (tests + lint + typecheck) avant de passer à la suivante.** Pas de feature flag — chaque phase reste mergeable indépendamment.

---

## Phase 0 — Pré-flight & baseline

**Objectif** : préparer l'environnement, ancrer les captures avant.

### Étapes

| # | Action | Fichier(s) | Test |
|---|---|---|---|
| 0.1 | Vérifier `master` à jour et `pnpm install` propre | — | `git status` propre |
| 0.2 | Démarrer le dev server local (`pnpm dev`) | — | `curl localhost:3001/kit \| head` |
| 0.3 | Capturer `/kit` desktop 1280 × 800 → `docs/kit-hero-optim/captures/before-desktop.png` | — | Fichier présent |
| 0.4 | Capturer `/kit` mobile 375 × 812 → `docs/kit-hero-optim/captures/before-mobile.png` | — | Fichier présent |
| 0.5 | Sauvegarder la valeur DB actuelle du field `description` du composant `kit-hero-produit` (au cas où re-seed) | console SQL | Backup `.sql` archivé |
| 0.6 | Vérifier les fields déjà présents pour `kit-hero-produit` dans la DB locale | `psql` | Output noté |

### Checkpoint

- [ ] Captures `before-*` archivées dans `docs/kit-hero-optim/captures/`
- [ ] Backup SQL des bindings actuels de `kit-hero-produit`
- [ ] Dev server tourne sans erreur

**Estimation effort** : 30 min.

---

## Phase 1 — Seed registry & description

**Objectif** : étendre le registry du composant `kit-hero-produit` avec les nouveaux fields + nouveaux slots. Mettre à jour la description par défaut.

### Étapes

| # | Action | Fichier(s) | Test |
|---|---|---|---|
| 1.1 | Ajouter `fields[]` au composant `kit-hero-produit` dans `registry.ts` (cf. `02-architecture.md` §2.1) | `apps/web/src/lib/components/registry.ts` | `pnpm typecheck` passe |
| 1.2 | Ajouter 2 slots supplémentaires `context_1` et `context_2` | (idem) | `pnpm typecheck` passe |
| 1.3 | Mettre à jour la description par défaut avec la version retenue (`01-vision-design.md` §5.1) | (idem) | (idem) |
| 1.4 | Exécuter `pnpm --filter @femiglow/web seed:components` (sync schema en DB) | — | Console log "seeded N components" |
| 1.5 | Exécuter `pnpm --filter @femiglow/web seed:components-fields` (insert bindings par défaut) | — | Console log "seeded N field bindings" |
| 1.6 | Vérifier en DB : `SELECT * FROM site_components WHERE key='kit-hero-produit'` | psql | 1 row, fields cohérents |
| 1.7 | Vérifier l'admin `/admin/components/kit-hero-produit` : les nouveaux fields apparaissent | UI manuel | Tous les fields visibles |
| 1.8 | (Optionnel) Si la DB remote a une override manuelle du field `description`, la conserver. Sinon, force re-seed local | psql | Description = version retenue |

### Tests

- Aucun test automatisé pour cette phase (config only).
- Validation manuelle en admin + en DB.

### Checkpoint

- [ ] Tous les fields apparaissent dans `/admin/components/kit-hero-produit/fields`
- [ ] La description par défaut est la version retenue
- [ ] `pnpm typecheck` + `pnpm lint` verts

**Estimation effort** : 1-2 h.

---

## Phase 2 — Data layer (migration + helper galerie)

**Objectif** : créer la table `product_review_photos`, exposer `getKitHeroGalleryImages`.

### Étapes

| # | Action | Fichier(s) | Test |
|---|---|---|---|
| 2.1 | Créer migration `0057_review_photos.sql` (cf. `02-architecture.md` §2.2) | `apps/web/drizzle/migrations/0057_review_photos.sql` | — |
| 2.2 | Ajouter `productReviewPhotos` table dans le schema Drizzle | `apps/web/src/lib/db/schema.ts` | `pnpm typecheck` passe |
| 2.3 | Ajouter `productReviewPhotos: Map` dans `memoryStore` | `apps/web/src/lib/db/client.ts` | `pnpm typecheck` passe |
| 2.4 | Exporter `ProductReviewPhoto` type | `apps/web/src/lib/db/types.ts` | (idem) |
| 2.5 | Créer helper `getKitHeroGalleryImages(productId)` | `apps/web/src/lib/products/kit-hero-gallery.ts` | Test unit (4 cas) |
| 2.6 | Créer interface `HeroGalleryImage` exportée | (idem) | (idem) |
| 2.7 | Créer script `seed-reviews-photos.ts` qui scanne `/public/reviews/*` et seed le memoryStore + la DB | `apps/web/scripts/seed-reviews-photos.ts` | Test manuel : `pnpm seed:reviews-photos` log "seeded N" |
| 2.8 | Ajouter dans `package.json` la commande `"seed:reviews-photos": "tsx scripts/seed-reviews-photos.ts"` | `apps/web/package.json` | `pnpm seed:reviews-photos --help` ne crash pas |
| 2.9 | Exécuter `pnpm migrate` (custom runner `_migrate-safe.mjs`) | — | Table `product_review_photos` créée |
| 2.10 | Exécuter `pnpm seed:reviews-photos` localement | — | Si pas de photos dans `/public/reviews/`, log warning et exit clean |

### Tests à écrire

- `kit-hero-gallery.test.ts` (4 cas — cf. `04-test-strategy.md` §2.3)

### Checkpoint

- [ ] Migration appliquée localement (`SELECT * FROM product_review_photos LIMIT 1` ne crash pas)
- [ ] `getKitHeroGalleryImages('kit-femiglow')` retourne au minimum 1 image (le slot primary)
- [ ] 4 tests unit verts
- [ ] `pnpm typecheck` + `pnpm lint` verts

**Estimation effort** : 2-3 h.

---

## Phase 3 — Composant `HeroGallery` (le morceau central)

**Objectif** : implémenter le système de galerie vignettée complet (mobile + desktop).

### Étapes

| # | Action | Fichier(s) | Test |
|---|---|---|---|
| 3.1 | Créer `useGallery` hook | `apps/web/src/components/sections/hero/useGallery.ts` | `useGallery.test.ts` (7 cas) |
| 3.2 | Créer `HeroGalleryDots` | `apps/web/src/components/sections/hero/HeroGalleryDots.tsx` | `HeroGalleryDots.test.tsx` (4 cas) |
| 3.3 | Créer `HeroGalleryThumbnails` | `apps/web/src/components/sections/hero/HeroGalleryThumbnails.tsx` | `HeroGalleryThumbnails.test.tsx` (3 cas) |
| 3.4 | Créer `HeroGalleryMain` | `apps/web/src/components/sections/hero/HeroGalleryMain.tsx` | (couvert par `HeroGallery.test.tsx`) |
| 3.5 | Créer `HeroGalleryArrow` | `apps/web/src/components/sections/hero/HeroGalleryArrow.tsx` | (couvert par `HeroGallery.test.tsx`) |
| 3.6 | Créer `HeroGallery` orchestrateur | `apps/web/src/components/sections/hero/HeroGallery.tsx` | `HeroGallery.test.tsx` (4 cas) |
| 3.7 | Vérifier que `useReducedMotion` et `useMediaQuery` existent (sinon les créer dans `apps/web/src/lib/hooks/`) | (variable) | — |
| 3.8 | Vérifier le rendu isolé via une story manuelle (créer `apps/web/src/app/(playground)/hero-gallery-demo/page.tsx` — supprimé après V1) | (temporaire) | Visuel browser |

### Tests à écrire

- `useGallery.test.ts` (7 cas)
- `HeroGalleryDots.test.tsx` (4 cas)
- `HeroGalleryThumbnails.test.tsx` (3 cas)
- `HeroGallery.test.tsx` (4 cas)

### Checkpoint

- [ ] `HeroGallery` rendu en isolation fonctionne mobile + desktop
- [ ] Swipe mobile via touch fonctionne (vérification manuelle DevTools)
- [ ] Click thumbnail desktop change l'image principale
- [ ] Navigation clavier ← → fonctionne
- [ ] `prefers-reduced-motion: reduce` désactive les transitions
- [ ] 18 tests unit verts
- [ ] `pnpm typecheck` + `pnpm lint` verts

**Estimation effort** : 6-8 h. **C'est la phase la plus lourde.**

---

## Phase 4 — Composants annexes (chips, social proof, trust row)

**Objectif** : créer les 3 composants commerce-réutilisables.

### Étapes

| # | Action | Fichier(s) | Test |
|---|---|---|---|
| 4.1 | Créer `AttributeChips` | `apps/web/src/components/commerce/AttributeChips.tsx` | `AttributeChips.test.tsx` (4 cas) |
| 4.2 | Créer `SocialProofBadge` (avec SVG star custom ou icon library existante) | `apps/web/src/components/commerce/SocialProofBadge.tsx` | `SocialProofBadge.test.tsx` (7 cas) |
| 4.3 | Créer `TrustRow` | `apps/web/src/components/commerce/TrustRow.tsx` | `TrustRow.test.tsx` (3 cas) |
| 4.4 | Vérifier que les imports `lucide-react` sont utilisés pour les étoiles (`Star`, `StarHalf`) — sinon SVG inline | (idem) | Visual check |

### Tests à écrire

- `AttributeChips.test.tsx` (4 cas)
- `SocialProofBadge.test.tsx` (7 cas)
- `TrustRow.test.tsx` (3 cas)

### Checkpoint

- [ ] 14 nouveaux tests unit verts
- [ ] Composants accessibles : `aria-label` corrects, navigation clavier OK
- [ ] Score axe-core 0 violation sur stories isolées (peut être testé avec `vitest-axe`)

**Estimation effort** : 3-4 h.

---

## Phase 5 — Refonte `HeroProduit` + Bound

**Objectif** : intégrer tous les nouveaux composants dans `HeroProduit`. Refondre le layout mobile + desktop. C'est ici qu'on touche au layout existant.

### Étapes

| # | Action | Fichier(s) | Test |
|---|---|---|---|
| 5.1 | Refondre `HeroProduit.tsx` : nouvelle props interface, intégration galerie + chips + badge + trust row | `apps/web/src/components/sections/HeroProduit.tsx` | `pnpm typecheck` |
| 5.2 | Refondre `HeroProduitBound.tsx` : résoudre les nouveaux fields + galerie | `apps/web/src/components/sections/HeroProduitBound.tsx` | (idem) |
| 5.3 | Ajuster les valeurs CSS pour le layout mobile (ratio image 3:4, espacements réduits) | `HeroProduit.tsx` | Visual mobile |
| 5.4 | Changer le CTA : passer de `bg-encre` à `bg-sauge-profond` (ou `bg-[#4A5D4A]` si pas de token) — utiliser le bouton variant `primary` modifié | Soit `Button.tsx` (variant primary), soit `HeroProduit.tsx` (override) | Visual + e2e |
| 5.5 | Implémenter la micro-pulsation CSS du CTA (animation keyframes) | CSS (Tailwind config ou inline) | Visual |
| 5.6 | Réécrire le tagline par défaut (Bound) si le field CMS n'est pas défini, en lisant `fields.tagline` | (Bound) | — |
| 5.7 | Conserver le fallback `product.images[0]` si `getKitHeroGalleryImages` retourne `[]` | (Bound) | Test resilience |
| 5.8 | Conserver le `ViewItemTracker` GA4 (pas de breaking) | `HeroProduit.tsx` | E2E vérifie l'event |

### Tests à écrire

- Test d'intégration RSC (snapshot du rendu HTML attendu via vitest + `renderToString`) — 1 cas
- Test d'intégration data (mock du résolveur de fields + galerie) — 1 cas

### Checkpoint

- [ ] La page `/kit` charge sans erreur
- [ ] Tous les éléments du wireframe `01-vision-design.md` sont visibles
- [ ] La voix maison est respectée (zéro exclamation, zéro emoji, tagline finissant par "La main se révèle.")
- [ ] CTA en sauge profond (visuel)
- [ ] Micro-pulsation visible (très subtile)
- [ ] 2 nouveaux tests intégration verts
- [ ] `pnpm typecheck` + `pnpm lint` verts

**Estimation effort** : 4-5 h.

---

## Phase 6 — Tests E2E + a11y

**Objectif** : valider le parcours utilisateur complet via playwright. Vérifier l'accessibilité.

### Étapes

| # | Action | Fichier(s) | Test |
|---|---|---|---|
| 6.1 | Installer `@axe-core/playwright` | (package.json) | — |
| 6.2 | Créer `e2e/kit-hero.spec.ts` avec les 5 tests desktop + mobile | `apps/web/e2e/kit-hero.spec.ts` | — |
| 6.3 | Vérifier que le test "CTA visible above fold" passe (mobile 375 × 812) | (idem) | Vert |
| 6.4 | Vérifier les 2 tests axe-core (desktop + mobile) → 0 violation sérieuse | (idem) | Vert |
| 6.5 | (Optionnel) Capturer `after-desktop.png` et `after-mobile.png` via playwright `page.screenshot()` | E2E | Captures dans `captures/` |

### Tests à écrire

- 5 tests dans `e2e/kit-hero.spec.ts` (cf. `04-test-strategy.md` §4.2)

### Checkpoint

- [ ] 5 tests e2e verts (chromium-desktop + chromium-mobile)
- [ ] 0 violation axe-core sérieuse ou critique
- [ ] CTA visible above fold (y < 700 px)
- [ ] Captures `after-*` archivées

**Estimation effort** : 2-3 h (avec stabilisation des sélecteurs).

---

## Phase 7 — Polish & vérification finale

**Objectif** : nettoyage, vérif perf, vérif voix maison, captures avant/après côte à côte.

### Étapes

| # | Action | Fichier(s) | Test |
|---|---|---|---|
| 7.1 | Supprimer le playground `apps/web/src/app/(playground)/hero-gallery-demo/` créé en Phase 3 | — | Page n'existe plus |
| 7.2 | Vérifier LCP via Lighthouse local sur `/kit` mobile | DevTools | LCP ≤ 2,5 s |
| 7.3 | Vérifier le bundle size : `pnpm build` puis inspecter `.next/` | — | Diff bundle < +10 KB |
| 7.4 | Faire une **revue manuelle voix maison** : grep `!`, emoji, "tu", "vous tu", "MEGA", "OFFRE" — résultat vide | grep | Vide |
| 7.5 | Run complet : `pnpm lint && pnpm typecheck && pnpm test --run && pnpm test:e2e` | — | Tout vert |
| 7.6 | Capturer `after-mobile.png` + `after-desktop.png` finalisés | Browser DevTools | Captures `captures/` |
| 7.7 | Comparer visuel `before` vs `after` — annoter les différences clés dans `captures/README.md` | (idem) | Doc présent |
| 7.8 | Mettre à jour le `MEMORY.md` du projet : pointer vers ce dossier + résumer ce qui a changé sur le hero | `~/.claude/.../memory/MEMORY.md` | Entry ajoutée |
| 7.9 | (Optionnel) PR description avec captures avant/après | — | PR draft |

### Checkpoint final (Definition of Done)

- [ ] Tous les items du `README.md` §6 sont cochés
- [ ] Captures avant/après archivées
- [ ] Tableau de cohérence Kolenda `01-vision-design.md` §6 vérifié
- [ ] `pnpm build` passe
- [ ] LCP ≤ 2,5 s mobile (mesure)
- [ ] Aucun warning console au chargement de `/kit`

**Estimation effort** : 2 h.

---

## Récapitulatif effort global

| Phase | Description | Effort | Cumul |
|---|---|---|---|
| 0 | Pré-flight | 0,5 h | 0,5 h |
| 1 | Seed registry + description | 1,5 h | 2 h |
| 2 | Data layer (migration, helper, seed photos) | 2,5 h | 4,5 h |
| 3 | `HeroGallery` complet | 7 h | 11,5 h |
| 4 | Composants annexes | 3,5 h | 15 h |
| 5 | Refonte `HeroProduit` + Bound | 4,5 h | 19,5 h |
| 6 | Tests e2e + a11y | 2,5 h | 22 h |
| 7 | Polish & vérif finale | 2 h | 24 h |

**Total : ~24 heures de travail concentré.**

---

## Ordre d'exécution conseillé

Si exécution en mode "marathon" (sessions de 4-6 h) :

- **Session 1** : Phase 0 + 1 + 2 (data + config) → 4,5 h
- **Session 2** : Phase 3 (galerie) → 7 h
- **Session 3** : Phase 4 + 5 (composants + intégration) → 8 h
- **Session 4** : Phase 6 + 7 (e2e + polish) → 4,5 h

---

## Dépendances entre phases

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 ─┐
                              Phase 4 ─┼→ Phase 5 → Phase 6 → Phase 7
                                       ─┘
```

- Phase 3 et Phase 4 peuvent être faites **en parallèle** (composants indépendants).
- Phase 5 nécessite Phase 3 + 4 + 2 (besoin de tous les composants + helpers data).
- Phase 6 nécessite Phase 5.
- Phase 7 final.

---

## Stratégie de rollback par phase

Cf. `06-runbook.md` §6 pour les commandes exactes.

| Phase | Réversibilité | Méthode |
|---|---|---|
| 1 | 100 % | Revert commits + re-seed |
| 2 | 100 % | Drop table `product_review_photos` + revert |
| 3 | 100 % | Supprimer `apps/web/src/components/sections/hero/` |
| 4 | 100 % | Supprimer les 3 fichiers de composants |
| 5 | 100 % | Restaurer `HeroProduit.tsx` depuis l'historique git |
| 6 | 100 % | Supprimer `e2e/kit-hero.spec.ts` |
| 7 | 100 % | Pas d'action destructive |

**Aucune phase n'introduit de breaking irréversible.**

---

## Voir aussi

- [`06-runbook.md`](06-runbook.md) — commandes exactes pour chaque étape
- [`04-test-strategy.md`](04-test-strategy.md) — détail des tests
- [`02-architecture.md`](02-architecture.md) — schéma data et composants

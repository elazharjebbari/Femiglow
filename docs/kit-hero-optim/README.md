# Plan — Refonte Hero `/kit` (P0 → P2)

> **Objectif global** : augmenter le taux de conversion du hero de la page `/kit` en appliquant les principes Kolenda (cf. `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`), sans dénaturer la voix maison. Introduire un système de **galerie hero vignettée** robuste et ergonomique (produit + contextuel + photos clientes) et finaliser les chantiers P0 identifiés dans l'analyse précédente.

**Branche cible** : `master`
**Périmètre** : `/kit` hero — uniquement. Aucune autre page n'est modifiée par ce plan.
**Mode d'exécution** : phases autonomes, chaque phase validée par tests avant la suivante.

---

## 1. Pourquoi ce plan

L'analyse Kolenda × hero a fait remonter trois problèmes structurels :

| Bloc | État actuel | Conséquence |
|---|---|---|
| **A. Layout mobile** | Le CTA et le prix sont sous le fold. L'image occupe ~60 % de l'écran. | Le visiteur doit scroller pour décider. Baisse mécanique du CTR. |
| **B. Image hero** | Photo studio isolée (boîte + pots), aucun contexte, aucune main, aucune photo cliente. | Aucun déclencheur de désir mimétique. Aucune preuve sociale visuelle. |
| **C. Zone prix-CTA** | Pas de note sociale, pas de pastilles attribut, trust row petite (11 px) et incomplète, CTA noir au lieu du sauge maison. | La décision se prend sans appui de confiance ni signal palette cohérent. |

Le plan résout ces trois blocs **en respectant la voix maison** (silence, retenue, vocabulaire rituel/initié, zéro exclamation, zéro emoji).

---

## 2. Livrables

### Frontend
- `HeroGallery` — système de galerie vignettée mobile + desktop, accessible, performant
- `AttributeChips` — composant réutilisable pour les 4 chips d'attributs
- `SocialProofBadge` — étoiles + note + nombre d'avis
- `TrustRow` — composant pour la ligne de réassurance unifié
- `HeroProduit` — refonte pour intégrer les nouveaux composants et corriger le layout mobile

### Backend / Data
- Extension des `fields[]` du component `kit-hero-produit` (registry + seed)
- Nouvelle entité `product_review_photos` (Drizzle schema + migration) pour les photos clientes dans la galerie
- Mise à jour du copy par défaut (description longue) dans le seed
- Helper `getKitHeroGalleryImages(productId)` qui consolide produit + contextuelles + reviews

### Tests
- 12+ tests unitaires (vitest + RTL) — composants nouveaux et helpers
- 6+ tests d'intégration (vitest + memoryStore mock) — flux data resolver
- 4+ tests e2e (playwright) — hero desktop, hero mobile, gallery swipe, gallery thumbnails
- 1 setup MSW introduit pour les futurs tests de routes API (review images upload)
- Tests a11y (axe-core dans playwright)

### Documentation
- Ce dossier (`docs/kit-hero-optim/`) — 7 fichiers
- Annexes design (tokens utilisés, variantes copy)

---

## 3. Index du dossier

| Fichier | Contenu | Quand le lire |
|---|---|---|
| [`README.md`](README.md) | Ce fichier — vue d'ensemble, métriques, critères de fin | **Toujours en premier** |
| [`01-vision-design.md`](01-vision-design.md) | Wireframes ASCII desktop+mobile, design tokens, ergonomie, palette, animations | Avant de coder quoi que ce soit |
| [`02-architecture.md`](02-architecture.md) | Modèle de données, schema fields, migration, queries, data flow, composants à créer/modifier | Phase 1-2 |
| [`03-vignette-system.md`](03-vignette-system.md) | Spec complète du système `HeroGallery` (mobile swipe, desktop thumbs, a11y, perf) | Phase 3 |
| [`04-test-strategy.md`](04-test-strategy.md) | Vitest + Playwright + MSW + axe, patterns, couverture cible, exemples | Avant chaque phase |
| [`05-action-plan.md`](05-action-plan.md) | Phases 0 à 7, fichiers touchés, tests à écrire, checkpoint, ordre d'exécution | Tous les jours |
| [`06-runbook.md`](06-runbook.md) | Commandes exactes, pre-flight, vérifications, rollback, env vars | Au moment d'exécuter |

---

## 4. TL;DR — Ce qui change concrètement

### Visible utilisateur

1. **Galerie hero vignettée** (la grosse nouveauté)
   - Mobile : swipe horizontal snap-scroll + dots indicator, 4-6 images
   - Desktop : main image + colonne de thumbnails verticale à gauche, click pour swap, zoom au hover
   - Mix : 2 produit (packshot, eclatée) + 2 contextuelles (main qui applique, table de chevet) + 2 reviews (photos clientes anonymisées)

2. **Mobile : CTA et prix au-dessus du fold**
   - Image hero raccourcie (ratio 4:5 → 3:4 sur mobile)
   - Description condensée à une phrase au-dessus du prix
   - Description longue déplacée juste sous le CTA (lecture optionnelle)

3. **Note sociale en haut du contenu** : `★★★★⯨ 4,8/5 · 287 avis` (or poudré discret)

4. **4 chips d'attributs** sous le tagline : `Sans vernis · Sans UV · Sans acétone · Halal`

5. **Trust row au-dessus du CTA**, agrandi (13 px), réécrit en 30 j

6. **CTA en sauge profond** (`#4A5D4A`), micro-pulse 600 ms toutes les 3-4 s

7. **Tagline finissant par "La main se révèle."**

8. **Description longue** mise à jour avec la version remote DB, retravaillée pour plus de continuité d'image et moins de marketing.

### Invisible (technique)

- Nouvelle table `product_review_photos` (Drizzle migration `0057_review_photos.sql`)
- 7 nouveaux fields editorial sur le composant `kit-hero-produit`
- Helper SSR `getKitHeroGalleryImages()` qui fusionne produit + reviews
- Couverture tests : 85 %+ sur les composants nouveaux
- LCP : aucune régression (image principale reste `priority + fetchPriority="high"`)

---

## 5. Métriques de succès

| Métrique | Avant (estimé) | Cible | Comment mesurer |
|---|---|---|---|
| Taux de clic CTA hero mobile | inconnu, sticky bar dominant | **+30 % vs sticky bar seul** | GA4 event `cta_click` filtré sur device + element_id |
| Add-to-cart depuis hero | inconnu | **+15 %** sur 30 j post-déploiement | GA4 event `add_to_cart` filtré sur source `hero` |
| Temps avant clic | inconnu | **-2 s médiane mobile** | GA4 timing event |
| LCP `/kit` | actuel à mesurer | **≤ 2,5 s** (pas de régression) | Lighthouse CI ou Web Vitals report |
| Couverture tests composants hero | 0 % (HeroProduit n'a pas de test) | **≥ 85 %** lignes | `pnpm test:coverage` |
| Score a11y axe-core | inconnu | **0 violation sérieux/critique** | playwright + @axe-core/playwright |

> Note : les métriques business (taux de clic, AOV) sont estimées car aucune baseline n'est documentée. Phase 0 du plan d'action inclut la pose des trackers pour établir cette baseline avant déploiement.

---

## 6. Critères de fin (Definition of Done)

Le plan est **terminé** uniquement quand :

- [ ] Toutes les phases du `05-action-plan.md` sont marquées ✅
- [ ] `pnpm typecheck` passe (zéro erreur TS)
- [ ] `pnpm test` passe (zéro test rouge)
- [ ] `pnpm test:e2e` passe sur chromium mobile + desktop (zéro test rouge)
- [ ] `pnpm lint` passe (zéro warning bloquant)
- [ ] Capture before/after desktop et mobile, archivée dans `docs/kit-hero-optim/captures/`
- [ ] Tableau Kolenda de cohérence vérifié (cf. `01-vision-design.md` §6)
- [ ] Pas de régression visuelle sur les autres sections de `/kit` (vérification visuelle)
- [ ] Migration `0057_review_photos.sql` exécutée localement + seed re-exécuté
- [ ] Le serveur dev tourne sans warning console au chargement de `/kit`
- [ ] Une revue manuelle a confirmé que la voix maison est respectée (zéro exclamation, zéro emoji, vocabulaire rituel/initié)

---

## 7. Hors périmètre (à NE PAS faire dans ce plan)

Pour rester focused, ces chantiers sont **explicitement exclus** :

- ❌ Refonte des autres sections de `/kit` (composition, gestes vidéo, INCI, FAQ, etc.) — chantiers ultérieurs
- ❌ Refonte du checkout / wizard `KitCommander` — découplé
- ❌ Refonte de la galerie produit côté admin (upload, recadrage, etc.) — phase 2 à venir
- ❌ A/B test framework — phase ultérieure
- ❌ CTA terracotta final pivot — réservé à la section finale (chantier suivant)
- ❌ Internationalisation — la page reste FR-only
- ❌ Mode sombre — explicitement exclu par Kolenda (`Color` p. 20-21)

---

## 8. Ce qu'on garde tel quel

- Le nom produit `Pack FemiGlow` (H1)
- Le kicker `LE RITUEL`
- Le label du CTA `Commander le rituel`
- La structure 2 colonnes desktop
- Le routing wizard via ancre `#commander-femiglow`
- Le composant `PriceDisplay` (la logique promo reste exacte)
- Le `ViewItemTracker` GA4

---

## 9. Voir aussi

- `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` — synthèse Kolenda + tokens design (Annexe A) + réécritures copy (Annexe B)
- `apps/web/src/components/sections/HeroProduit.tsx` — fichier à refondre (entrée principale)
- `apps/web/src/lib/components/registry.ts` (ligne 679-710) — seed actuel kit-hero-produit
- `apps/web/src/lib/products/reviews.ts` — module reviews existant (à étendre)

---

**Prochaine étape** : lire `01-vision-design.md` pour valider la vision UX avant de toucher au code.

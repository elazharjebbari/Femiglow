# 10 — Critères d'acceptation et non-régression

Checklist exhaustive pour valider chaque phase et garantir l'absence de régression.

## 1. Critères globaux (toute phase)

Avant merge :

- [ ] `pnpm typecheck` clean.
- [ ] `pnpm -r lint` clean (warnings tolérables si pré-existants).
- [ ] `pnpm vitest run` 100 % vert (hors flakes pré-existants documentés).
- [ ] `pnpm playwright test --grep '@composition-'` 100 % vert.
- [ ] Couverture `lib/kit/composition/**` ≥ 90 % branches.
- [ ] Couverture `components/commerce/Ingredient*` ≥ 85 % branches.
- [ ] Pas de `eslint-disable` non commenté ajouté.
- [ ] Pas de `console.log` oublié.
- [ ] Commits respectent la convention `feat(composition)` / `test(composition)` / `chore(composition)`.
- [ ] Snapshot Playwright stable 3 runs consécutifs.

## 2. Phase 0 — Quick wins Kolenda

### 2.1 Acceptation

- [ ] Composant `PostCtaLink` créé avec props `{ href, subProductId }`.
- [ ] Lien « Voir le pack ↓ » présent sous chaque sous-produit (×3) avec
      `data-testid="composition-post-cta-{id}"`.
- [ ] Click sur le lien :
  - [ ] émet `composition_post_cta_click` avec `sub_product_id`, `cta_target`
  - [ ] scroll smooth vers `#commander-femiglow`
- [ ] Lignes alternées `bg-creme` / `bg-creme-warm/40` dans `IngredientsTable`.
- [ ] Event `composition_post_cta_click` déclaré dans `tracking/schemas.ts`.
- [ ] Aucune régression sur les tests existants `IngredientsTable`, `IngredientsDetails`.

### 2.2 Smoke test

```bash
pnpm --filter web dev
# Ouvrir /kit, scroller à la section composition.
# Cliquer sur « Voir le pack ↓ » sous 1 Paste → scroll smooth vers le pack.
# DevTools Network : un événement composition_post_cta_click visible.
```

## 3. Phase 1 — Schema étendu

### 3.1 Acceptation

- [ ] `ingredientDetailedSchema` accepte `inciDefinition` optionnel (≤ 200 chars).
- [ ] `subProductSchema` accepte `narrative` optionnel (1-320 chars, ponctuation finale).
- [ ] `subProductSchema` accepte `usageHint` optionnel (1-60 chars).
- [ ] Mock `mockKitPageContent.composition` enrichi :
  - [ ] 1 `narrative` par sous-produit (×3).
  - [ ] 1 `usageHint` par sous-produit (×3).
  - [ ] 1 `inciDefinition` par ingrédient majeur (≥ 12 définitions total).
- [ ] **Aucune mention nominale de la fondatrice** dans les narratives.
- [ ] Helper `sortByConcentrationDesc` créé + ≥ 5 tests verts.
- [ ] Mock passe `kitPageContentSchema` sans erreur.

### 3.2 Non-régression

- [ ] Tests `feed.xml`, `kit-feed`, `IngredientsTable`, `IngredientsDetails` existants passent.
- [ ] Un `SubProduct` sans aucun champ étendu reste valide.
- [ ] Un `IngredientDetailed` sans `inciDefinition` reste valide.

## 4. Phase 2 — IngredientCard mobile + SubProductBlock

### 4.1 Acceptation

- [ ] `IngredientCard` rend nom, INCI, %, fonction, origine.
- [ ] `IngredientCard` teinte le `%` en couleur d'accent du sous-produit.
- [ ] `ResponsiveIngredientList` rend cards mobile + table desktop.
- [ ] Tri par `%` décroissant côté affichage (mobile et desktop).
- [ ] `SubProductBlock` affiche titre + volume + `usageHint` inline si présent.
- [ ] Sur mobile (< 640 px) : `<details>` accordéon.
  - [ ] Premier sous-produit ouvert par défaut.
  - [ ] 2 autres fermés.
  - [ ] Click summary → ouvre/ferme.
- [ ] Sur desktop (≥ 640 px) : tous les sous-produits dépliés, pas de chevron.
- [ ] Aucun scroll horizontal sur mobile dans la section.
- [ ] Refactor `IngredientsTable` accepte `{ ingredients, subProductId, accentColor }`.

### 4.2 Non-régression

- [ ] Tests `IngredientsDetails` existants à jour (refactor signature).
- [ ] Anchor IDs `#ingredients-details-{id}` préservés.
- [ ] `role="region"` + `aria-label` toujours présents sur le tableau desktop.
- [ ] Pas de hydration mismatch sur `/kit` (DevTools console clean).
- [ ] Lighthouse `/kit` mobile ≥ 92 (préservé).

## 5. Phase 3 — InciTooltip

### 5.1 Acceptation

- [ ] `InciTooltip` rend `<button>` avec aria-label `Définition de {inci}`.
- [ ] Bouton ⓘ visible uniquement si `inciDefinition` présent.
- [ ] Click ⓘ :
  - [ ] ouvre le popover avec `role="tooltip"`.
  - [ ] affiche le terme INCI + la définition.
  - [ ] émet `composition_inci_tooltip_open` avec `inci_term`, `sub_product_id`.
- [ ] Esc ferme le popover.
- [ ] Tap-out / click hors zone ferme le popover.
- [ ] Focus visible ring `#C8A876` sur le bouton.
- [ ] `composition_inci_tooltip_open` déclaré dans schemas.

### 5.2 Non-régression

- [ ] Si `inciDefinition` absent → pas de bouton ⓘ (rétro-compat).
- [ ] Pas de fuite mémoire au mount/unmount du tooltip.
- [ ] Axe : 0 violation sur le popover.

## 6. Phase 4 — NarrativeIntro + tracking

### 6.1 Acceptation

- [ ] `NarrativeIntro` rendu en Cormorant italique, opacity 75 %, max-width prose.
- [ ] IntersectionObserver attaché au mount.
- [ ] Émet `composition_narrative_view` au franchissement seuil 0.5 du viewport.
- [ ] Émet une seule fois (pas de re-emit sur scroll back).
- [ ] Cleanup au unmount (pas de leak).
- [ ] `SubProductBlock` émit `composition_accordion_open` au déploiement.
  - [ ] avec `sub_product_id`, `sub_product_name`.
  - [ ] uniquement quand `open === true` (pas à la fermeture).
- [ ] Schemas tracking enrichis (4 events au total).

### 6.2 Non-régression

- [ ] Si `narrative` absent → pas de `NarrativeIntro` rendu.
- [ ] Tests existants `composition_post_cta_click` toujours verts.

## 7. Phase 5 — Admin éditeur composition

### 7.1 Acceptation backend

- [ ] `lib/kit/composition/store.ts` : 3 entrées max (1-paste, 2-powder, 3-polissoir).
- [ ] `upsertKitCompositionOverride` merge champ par champ (préserve les autres).
- [ ] `null` dans patch → champ retourné au mock.
- [ ] `lib/kit/composition/resolver.ts` :
  - [ ] `resolveKitComposition()` retourne mock si pas d'override publié.
  - [ ] Retourne `override-published` si publié, merge sur mock.
- [ ] `resolveKitCompositionDraft()` inclut les drafts non publiés.

### 7.2 Acceptation API

- [ ] `GET /api/admin/kit/composition/[id]` exige session admin (401 sinon).
- [ ] `PATCH` valide body via Zod (422 si invalid).
- [ ] `POST /publish` revalide `tag('kit-composition')` + `path('/kit')`.
- [ ] `POST /reset` supprime l'override DB + log audit.

### 7.3 Acceptation Admin UI

- [ ] `/admin/kit/composition` liste 3 cards avec statut Mock/Brouillon/Publié.
- [ ] `/admin/kit/composition/[id]` rend l'éditeur :
  - [ ] Form pré-rempli depuis override DB ou mock fallback.
  - [ ] Detection live validation Zod (erreurs affichées sous chaque champ).
  - [ ] Aperçu live à droite met à jour à chaque keystroke.
  - [ ] Save → toast/message « Brouillon enregistré ».
  - [ ] Publish désactivé tant que dirty.
  - [ ] Reset ouvre modale avec saisie `RESET-COMPOSITION-{ID}`.
  - [ ] Reset confirmé → DELETE override + retour mock.
- [ ] `IngredientsArrayEditor` :
  - [ ] Add/remove ingredients.
  - [ ] Tri par % décroissant visible côté preview.
  - [ ] INCI clé immuable warning si modifié.
- [ ] `CertificationsEditor` :
  - [ ] Add/remove certifications.
  - [ ] Max 8 enforced.

### 7.4 Non-régression

- [ ] Pages admin existantes (`/admin/seo`, `/admin/kit/video`, etc.) restent fonctionnelles.
- [ ] Cascade `mock → override → publish` cohérente.
- [ ] Audit events `kit_composition.*` posés dans `auditEvents`.
- [ ] Sidebar `AdminShell` ajoute « Composition /kit » sans casser les autres entries.

## 8. Phase 6 — E2E Playwright + axe

### 8.1 Acceptation

- [ ] Spec `@composition-render` : section visible, 3 sous-produits, narrative présent.
- [ ] Spec `@composition-interaction` : click accordion, click tooltip, click post-CTA.
- [ ] Spec `@composition-admin` : parcours nominal édition + publish + reset.
- [ ] Spec `@composition-a11y` : 0 violation axe sur `/kit#ingredients-details` et `/admin/kit/composition/[id]`.
- [ ] Spec `@composition-responsive` : viewport mobile + desktop OK.
- [ ] Aucun flake en 3 runs consécutifs.

### 8.2 Non-régression

- [ ] Tous les autres tags Playwright (`@kit`, `@video-*`, `@composition`, `@og`, etc.) restent verts.

## 9. Phase 7 — README handoff + cleanup

### 9.1 Acceptation

- [ ] `apps/web/src/components/kit/README.md` étendu avec section ingredients :
  - [ ] Inventaire des nouveaux composants (table)
  - [ ] Helpers (sortByConcentrationDesc)
  - [ ] Conventions (rétro-compat optionnels, mobile-first, tri %)
- [ ] Aucun import orphelin (`grep -rn "subProduct={" → tous mis à jour`).
- [ ] `pnpm lint` exit 0.
- [ ] `pnpm typecheck` exit 0.
- [ ] `pnpm build` exit 0.

## 10. Critères de non-régression globaux

### 10.1 Métadonnées critiques

- [ ] `<title>` `/kit` inchangé.
- [ ] `<meta name="description">` `/kit` inchangé.
- [ ] JSON-LD `Product` reste valide (inclut tous les ingredients via dataset).
- [ ] Section composition (refonte précédente §4.3) reste fonctionnelle.
- [ ] Section vidéo (refonte §4.4) reste fonctionnelle.

### 10.2 Performance

- [ ] LCP `/kit` ≤ 2,5 s mobile.
- [ ] CLS ≤ 0,1.
- [ ] FID ≤ 100 ms.
- [ ] Bundle size augmentation gzip ≤ 6 kB sur toute la refonte.

### 10.3 Accessibilité

- [ ] `/kit` axe 0 violations sérieuses/critiques (post phase 6).
- [ ] `/admin/kit/composition/[id]` axe 0 violations.
- [ ] Navigation clavier complète sur la section.
- [ ] Focus visible sur tous les éléments interactifs.

### 10.4 Comportement public

- [ ] Click post-CTA scroll vers `#commander-femiglow` en < 800 ms.
- [ ] Tap ⓘ ouvre tooltip en < 200 ms.
- [ ] Click summary ouvre accordion en < 200 ms (animation native).
- [ ] `prefers-reduced-motion` désactive les transitions.
- [ ] Aucun lien externe agressif visible.

### 10.5 Comportement admin (post phase 5)

- [ ] Édition save → publish → revalidation visible sur `/kit` en < 5 s.
- [ ] Reset → mock revient en < 2 s.
- [ ] Modale reset bloque tant que `RESET-COMPOSITION-{ID}` non saisi correctement.

## 11. Sign-off

Une phase est close quand :

1. Toutes les cases à cocher de sa section sont validées.
2. PR review approuvée (ou auto-revue documentée).
3. Smoke tests post-déploiement passés.
4. Aucune alerte 5xx dans les 24 h suivant le déploiement.

Le plan global est livré quand :

- Phases 0-7 closes.
- Couverture tests atteinte (≥ 90 % branches `lib/kit/composition/**`).
- KPIs `02-vision-objectifs.md` §3 mesurés et conformes à J+7.
- Documentation `apps/web/src/components/kit/README.md` à jour.
- Un éditeur non-dev a publié une modification via `/admin/kit/composition/[id]`
  en < 60 s sans aide.

## 12. Critères « show stoppers »

Bloquants absolus pour le merge sur `master` :

- ❌ Régression sur une section adjacente (vidéo, composition cards, hero)
- ❌ Hydration mismatch sur `/kit`
- ❌ Lighthouse `/kit` mobile < 90
- ❌ Axe violation sérieuse/critique sur `/kit`
- ❌ Schema mock invalide (parse fail)
- ❌ Bundle size delta > 6 kB
- ❌ Test flake > 1 fail sur 3 runs E2E

Si l'un de ces critères est touché, **revert immédiat de la phase
problématique** avant de débloquer le plan.

# 09 — Runbook d'exécution

Runbook opérationnel pour exécuter le plan de bout en bout. Commandes, validations, rollback, commits.

## 0. Pré-requis

### 0.1 Environnement

```bash
# Node 20 (le projet requiert ≥ 18.12, on utilise 20 pour cohérence CI)
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20

cd /Users/elazhar/PycharmProjects/template-femiglow
pnpm install --frozen-lockfile
```

### 0.2 Variables d'environnement

Confirmer dans `.env.local` :

```
NEXT_PUBLIC_SITE_URL=https://femiglow.ma
DATABASE_URL=postgresql://...
NEXT_PUBLIC_COMPOSITION_V2=true                # active la refonte (defaut true en local)
NEXT_PUBLIC_COMPOSITION_CONTEXTUAL=false       # Phase 3, à activer quand DA prête
```

### 0.3 Branche

```bash
git checkout master
git pull --ff-only origin master
git checkout -b composition-reveal-optim-2026-05
```

Branches dédiées par phase (recommandé pour revue PR) :

```bash
git checkout -b composition/phase-0-quick-wins
# ... travail ...
git checkout composition-reveal-optim-2026-05
git merge --no-ff composition/phase-0-quick-wins
```

### 0.4 Baseline

```bash
cd apps/web
pnpm typecheck            # baseline
pnpm vitest run           # baseline tests count
```

Noter le compte tests passants/échouants dans `composition-phase-baseline.txt`.

---

## Phase 0 — Quick wins visuels

### 0.1 Branche

```bash
git checkout -b composition/phase-0-quick-wins
```

### 0.2 Tests d'abord

```bash
# Créer le squelette
cat > apps/web/src/components/sections/CompositionReveal.test.tsx << 'EOF'
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CompositionReveal } from './CompositionReveal';
import { mockKitPageContent } from '@/data/mock/kit';

describe('CompositionReveal — phase 0', () => {
  it('rend le fond sable #EFE9DD', () => { /* TODO */ });
  it('chaque card a bordure gris-sauge + fond ivoire warm', () => { /* TODO */ });
});
EOF
pnpm vitest run CompositionReveal
```

Tests rouges (TDD red phase).

### 0.3 Implémenter

Modifier `CompositionReveal.tsx` :
- `bg-creme` → `bg-[#EFE9DD]`.

Modifier `ProductCard.tsx` (temporaire) :
- `border border-[#C7CCC2] bg-[#FBFAF6] p-4 sm:p-5`.
- Volume inline + lowercase.
- Lien : `Voir la composition` → `Lire le détail`.

### 0.4 Valider

```bash
pnpm typecheck
pnpm vitest run CompositionReveal ProductCard
```

Tests verts.

### 0.5 Smoke test manuel

```bash
pnpm --filter web dev
# Ouvrir http://localhost:3001/kit
# Scroll vers la section composition
# Vérifier : fond sable, bordures cards, volume inline, lien renommé
```

### 0.6 Commit + merge

```bash
git add -A
git commit -m "feat(composition): phase 0 — quick wins visuels Kolenda"
git push -u origin composition/phase-0-quick-wins
gh pr create --title "composition: phase 0" --body "..."
```

### 0.7 Rollback

```bash
git revert <commit-sha>
```

---

## Phase 1 — Schema étendu

### 1.1 Branche

```bash
git checkout composition-reveal-optim-2026-05
git pull
git checkout -b composition/phase-1-schema-extension
```

### 1.2 Tests d'abord

Créer `apps/web/src/lib/schemas/product.test.ts` avec les ~12 cas (cf. `07-tests-strategy.md` §4.2).

```bash
pnpm vitest run product.test
```

Tests rouges.

### 1.3 Implémenter

1. Étendre `subProductSchema` (cf. `03-data-model.md` §2).
2. Étendre `mockKitPageContent` (sensation + accentColor sur 3 sous-produits).
3. Créer `apps/web/src/data/mock/kit.test.ts`.

### 1.4 Valider

```bash
pnpm typecheck
pnpm vitest run product mock/kit
# vérifier rétrocompat
pnpm vitest run feed.xml kit-feed
```

### 1.5 Commit

```bash
git commit -am "feat(composition): phase 1 — schema SubProduct + mock enrichi"
```

---

## Phase 2 — `CompositionCard` dédié

### 2.1 Branche

```bash
git checkout -b composition/phase-2-composition-card
```

### 2.2 Tests d'abord

Créer les fichiers de test :

- `lib/composition/copy.test.ts` (~10 cas)
- `components/kit/CompositionCard.test.tsx` (~12 cas)
- `components/kit/NumberBadge.test.tsx` (~4 cas)
- `components/kit/SensationLine.test.tsx` (~3 cas)

```bash
pnpm vitest run composition
```

Tests rouges.

### 2.3 Implémenter

1. `lib/composition/copy.ts` — 4 fonctions pures.
2. `components/kit/NumberBadge.tsx`.
3. `components/kit/SensationLine.tsx`.
4. `components/kit/CompositionCard.tsx` (sans crossfade, sans motion).
5. Brancher `CompositionReveal.tsx` sur `CompositionCard`.

### 2.4 Valider

```bash
pnpm typecheck
pnpm vitest run composition
pnpm --filter web dev
# Vérifier visuellement : pastilles 01/02/03 + sensation visible
```

### 2.5 Commit

```bash
git commit -am "feat(composition): phase 2 — CompositionCard dédié + sensation + pastille"
```

---

## Phase 3 — Image contextuelle

### 3.1 Branche

```bash
git checkout -b composition/phase-3-contextual-image
```

### 3.2 Tests d'abord

`MediaCrossfade.test.tsx` avec ~8 cas.

```bash
pnpm vitest run MediaCrossfade
```

### 3.3 Implémenter

1. `components/kit/MediaCrossfade.tsx`.
2. `lib/composition/media.ts::resolveContextualSlot`.
3. Étendre `CompositionRevealBound` pour résoudre 3 nouveaux slots.
4. Brancher dans `CompositionCard`.

### 3.4 Component-Media — nouveaux slots

Ajouter 3 slots dans le registry :

```ts
// lib/components/registry.ts (extension)
{
  key: 'kit-comparatif',
  slots: [
    // existants
    { key: 'kit-base', ... },
    { key: 'kit-fortifiant', ... },
    { key: 'kit-lime', ... },
    // nouveaux
    { key: 'kit-base-contextual', label: 'Paste — en contexte', defaultSvgFallback: null },
    { key: 'kit-fortifiant-contextual', label: 'Powder — en contexte', defaultSvgFallback: null },
    { key: 'kit-lime-contextual', label: 'Polissoir — en contexte', defaultSvgFallback: null },
  ],
},
```

Reseed :

```bash
pnpm seed:components-fields:reconcile
```

### 3.5 Valider

```bash
pnpm typecheck
pnpm vitest run MediaCrossfade
NEXT_PUBLIC_COMPOSITION_CONTEXTUAL=true pnpm --filter web dev
# Hover sur une card -> crossfade visible (si visuels présents)
```

### 3.6 Commit

```bash
git commit -am "feat(composition): phase 3 — image contextuelle au hover/tap"
```

---

## Phase 4 — Animations reveal

### 4.1 Branche

```bash
git checkout -b composition/phase-4-motion
```

### 4.2 Tests d'abord

Étendre `CompositionCard.test.tsx` avec ~4 cas motion.

### 4.3 Implémenter

1. Wrap `<article>` avec `motion.article`.
2. Configurer `MotionConfig` global (parent layout ou layout marketing).

### 4.4 Valider

```bash
pnpm typecheck
pnpm vitest run CompositionCard
pnpm --filter web dev
# Scroll vers la section, vérifier fade + translateY
# Activer prefers-reduced-motion dans Chrome devtools, scroll → pas d'anim
```

### 4.5 Commit

```bash
git commit -am "feat(composition): phase 4 — reveal animations Framer Motion"
```

---

## Phase 5 — Vue éclatée

### 5.1 Pré-requis DA

Le visuel de vue éclatée doit être produit en parallèle (1 j DA). Format livré : PNG/AVIF responsive (md 768, lg 1280, xl 1920), fond sable, annotations vectorielles bien lisibles.

### 5.2 Branche

```bash
git checkout -b composition/phase-5-exploded-view
```

### 5.3 Tests d'abord

Étendre `CompositionReveal.test.tsx` (~2 cas).

### 5.4 Implémenter

1. Extension `KitPageContent.composition.exploded?` schema.
2. Component-Media slot `kit-exploded`.
3. Rendu `<figure>` dans `CompositionReveal`.
4. Mock : ajouter `exploded` dans `mockKitPageContent`.

### 5.5 Reseed

```bash
pnpm seed:components-fields:reconcile
# Puis upload du visuel via /admin/media + binding sur le slot kit-exploded
```

### 5.6 Valider

```bash
pnpm typecheck
pnpm vitest run CompositionReveal
pnpm --filter web dev
# Vérifier : visuel chargé en tête de section, responsive sur 3 tailles
```

### 5.7 Commit

```bash
git commit -am "feat(composition): phase 5 — vue éclatée annotée"
```

---

## Phase 6 — Admin éditeur

### 6.1 Branche

```bash
git checkout -b composition/phase-6-admin
```

### 6.2 Tests d'abord

Créer dans cet ordre :

1. `lib/composition/composition-resolver.test.ts` (~5 cas).
2. `app/api/admin/kit/composition/[id]/route.test.ts` (~6 cas).
3. `components/admin/kit/KitCompositionEditor.test.tsx` (~12 cas).

### 6.3 Implémenter

**Backend** :
1. Migration DB (table `kitSubProductsOverrides`) si retenue (cf. §03 §7.3).
2. Queries `lib/db/queries/kit-composition.ts`.
3. Resolver `lib/composition/composition-resolver.ts`.
4. API routes (`app/api/admin/kit/composition/*`).
5. Brancher `KitPage` sur `resolveKitComposition()`.

**Frontend admin** :
6. Schemas `lib/composition/schemas.ts`.
7. Composants admin (cf. `06-admin-ui-ux-design.md` §1.2).
8. Pages `/admin/kit/composition` + `[id]`.

### 6.4 Valider

```bash
pnpm typecheck
pnpm vitest run composition kit-composition
pnpm --filter web dev
# Naviguer vers /admin/kit/composition
# Modifier paste, save, publish
# Aller sur /kit, vérifier modif appliquée
# Reset, vérifier retour à la version mock
```

### 6.5 Commit

```bash
git commit -am "feat(composition): phase 6 — admin éditeur sous-produits"
```

---

## Phase 7 — Playwright E2E

### 7.1 Branche

```bash
git checkout -b composition/phase-7-e2e
```

### 7.2 Implémenter specs

Créer les specs dans `apps/web/e2e/composition/`:
- `render.spec.ts`
- `interaction.spec.ts`
- `admin.spec.ts`
- `a11y.spec.ts`

### 7.3 Valider

```bash
pnpm --filter web build
pnpm playwright install --with-deps
pnpm --filter web playwright test --grep '@composition'
# 0 fail, 0 flake
```

### 7.4 Commit

```bash
git commit -am "test(composition): E2E Playwright + a11y axe"
```

---

## Phase 8 — Cleanup

### 8.1 Branche

```bash
git checkout -b composition/phase-8-cleanup
```

### 8.2 Vérifier ProductCard non utilisé

```bash
grep -rn "ProductCard" apps/web/src --include="*.tsx" --include="*.ts" \
  | grep -v "\.test\." \
  | grep -v "CompositionCard"
# Doit retourner 0 résultats
```

Si OK, supprimer :

```bash
rm apps/web/src/components/commerce/ProductCard.tsx
rm apps/web/src/components/commerce/ProductCard.test.tsx  # si existait
```

### 8.3 README handoff

Créer `apps/web/src/components/kit/README.md` qui pointe vers `docs/composition-reveal-optim-2026-05/`.

### 8.4 Valider

```bash
pnpm typecheck
pnpm vitest run
pnpm --filter web build
```

### 8.5 Commit

```bash
git commit -am "chore(composition): cleanup ProductCard, README handoff"
```

---

## Validation cross-phases (avant merge final)

```bash
git checkout composition-reveal-optim-2026-05
git rebase master

# Tests complets
pnpm typecheck
pnpm -r lint
pnpm vitest run --coverage
# Vérifier couverture lib/composition/** + components/kit/Composition* >= 90%
pnpm playwright test --grep '@composition'

# Build prod
pnpm --filter web build
```

## Post-déploiement prod

### Smoke tests prod

```bash
# 1. La section composition rend bien sur /kit
curl -s https://femiglow.ma/kit | grep -c "composition-title"
# Attendu: 1

# 2. Le mock TS est utilisé en fallback si pas d'override DB
# (vérifier via /admin/kit/composition que les 3 sub-produits sont en statut "mock")

# 3. Animations désactivées si prefers-reduced-motion
# Test manuel avec OS macOS Préférences → Accessibilité → Réduire les animations
```

### Validation outils externes

- **Google PageSpeed** sur https://femiglow.ma/kit
  - LCP cible ≤ 2,5 s.
  - CLS cible ≤ 0,1.
- **Axe browser ext.** sur `/kit` et `/admin/kit/composition`
  - 0 violation.

### Monitoring 24-48 h

- Pas d'erreurs 5xx sur `/api/admin/kit/composition/*`.
- Pas de spike de 404 sur les nouveaux slots Component-Media.
- Latence P95 `/kit` inchangée (± 5 %).

## Rollback global

```bash
# Désactiver les flags
NEXT_PUBLIC_COMPOSITION_V2=false
NEXT_PUBLIC_COMPOSITION_CONTEXTUAL=false
# Redéployer

# Si besoin de revert code
git revert <phase-8-sha>
git revert <phase-7-sha>
# ... etc dans l'ordre inverse
```

## Aide-mémoire commandes

| Action | Commande |
|---|---|
| Lancer un test ciblé | `pnpm vitest run <pattern>` |
| Lancer Playwright composition | `pnpm playwright test --grep '@composition'` |
| Type check | `pnpm typecheck` |
| Lint | `pnpm -r lint` |
| Build prod | `pnpm --filter web build` |
| Dev server | `pnpm --filter web dev` |
| Coverage | `pnpm vitest run --coverage` |
| Reseed Component-Fields | `pnpm seed:components-fields:reconcile` |
| Inspect composition admin | `open http://localhost:3001/admin/kit/composition` |

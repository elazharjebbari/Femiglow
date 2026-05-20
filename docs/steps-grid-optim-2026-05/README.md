# Refonte « Le rituel en 4 gestes » `/kit` — mai 2026

> Plan complet de la refonte de la **grille des 4 étapes du rituel**
> dans la section `#product-feed` de `/kit` (Kolenda §4.7).
>
> Élément ciblé : `FeedStepCard` × 4 dans `ProductFeedSection.tsx`.

## Sommaire

| # | Document | Rôle |
|---|---|---|
| 00 | [README.md](README.md) | Vous êtes ici — index + KPIs |
| 01 | [01-context-analyse.md](01-context-analyse.md) | Audit Kolenda actuel, faiblesses W1-W10 |
| 02 | [02-vision-objectifs.md](02-vision-objectifs.md) | Vision, objectifs, KPIs cibles |
| 03 | [03-data-model.md](03-data-model.md) | Extension `ProductFeedStep` (`duration`, `isResult`) |
| 04 | [04-backend-design.md](04-backend-design.md) | Builder enrichi + override admin singleton |
| 05 | [05-frontend-public-design.md](05-frontend-public-design.md) | StepsHeader, StepCard refondé, StepIcon, StepsTimeline, PostCta |
| 06 | [06-admin-ui-ux-design.md](06-admin-ui-ux-design.md) | Admin éditeur `KitStepsEditor` (durée, isResult, copy) |
| 07 | [07-tests-strategy.md](07-tests-strategy.md) | Vitest + MSW + Playwright (`@steps-*`) |
| 08 | [08-plan-action-phases.md](08-plan-action-phases.md) | 5 phases G0→G4 (~1,25 j-h) |
| 09 | [09-runbook-execution.md](09-runbook-execution.md) | Pas-à-pas + rollback par phase |
| 10 | [10-acceptance-criteria.md](10-acceptance-criteria.md) | Checklist + show stoppers |

## Périmètre

**In-scope** :
- Refondre la grille `<ol grid-cols-1 sm:grid-cols-2 lg:grid-cols-4>` en
  composant timeline rythmée (StepsTimeline).
- Ajouter durée par step + durée totale au-dessus de la grille.
- Connecteur visuel (ligne pointillée desktop, timeline verticale mobile).
- Icône SVG par step (4 pictos inline, charte cohérente claims).
- Outcome step 4 mis en évidence (anneau doublé + italique).
- CTA post-grille « Démarrer le rituel ↓ » + 3 events tracking.
- Reveal stagger Framer Motion.
- Override admin singleton (titre EN TOUT + label total + 4 durées + flags).
- Tests vitest + Playwright + axe a11y.

**Out-of-scope** :
- Refonte du contenu textuel (verbes/copy) — déjà fait, on enrichit la
  structure pas la voix.
- A/B test position grille (option B : avant le PriceBlock) — décidé à J+30
  selon KPIs (cf. doc 02).
- Vidéo intégrée par step (existe déjà dans la section vidéo `/kit`).

## KPIs cibles à 90 jours

| KPI | Baseline (mai 2026) | Cible J+90 |
|---|---|---|
| Scroll-through section pack (atteint le step 4) | ~50 % (estimé sans tracking) | **≥ 70 %** |
| Temps moyen passé sur grille | ~6 s | **≥ 12 s** |
| CTR PostCtaLink « Démarrer le rituel » | 0 (n'existe pas) | **≥ 4 %** |
| Lift CTR « Commander le rituel » (effet halo de la grille) | 6 % | **≥ 8 %** |
| Lighthouse `/kit` mobile | ≥ 92 | ≥ 92 (préservé) |

## Effort estimé

**~1,25 j-h** (1 j 2 h), 5 phases atomiques :
- G0 — Schema + builder enrichi (¼ j)
- G1 — UI durées + outcome step 4 (¼ j)
- G2 — Connecteur visuel timeline (¼ j)
- G3 — Icônes SVG + reveal stagger (¼ j)
- G4 — PostCtaLink + tracking + tests (¼ j)

Phases admin optionnelles :
- G5 — Override admin singleton (½ j, peut être décalé itération suivante)

## Décisions de cadrage actées

Cf. réponse de cadrage en amont :

1. **Position grille** = conservée (après PriceBlock, Option A).
2. **Durées** = 30 s · 1 min · 2 min · 1 min = **5 min total**.
3. **Icônes** = SVG inline maison, pas de Components-CMS (cohérent claims).
4. **Outcome step 4** = « L'ongle devient miroir » en `font-display italic`.
5. **CTA label** = « Démarrer le rituel ↓ » (verbe d'invitation, pas d'achat sec).

## Référence

- Playbook Kolenda : `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §4.7
- Section parent : `docs/pack-section-optim-2026-05/`
- Composants source : `apps/web/src/components/sections/ProductFeedSection.tsx`

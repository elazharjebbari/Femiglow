# Plan d'action — refonte « Les gestes » (vidéo /kit)

Refonte du bloc `VideoPlayer4Gestes` selon le playbook Kolenda (§4.4) : pédagogie en 90 s, image dynamique, voix maison, captation des signaux d'attention et de conversion sans agresser. Plan complet backend / frontend / data / tests / runbook.

## Statut

| Phase | Sujet | Effort | Risque | Statut |
|---|---|---|---|---|
| 0 | Quick wins iframe (cohérence titre, mute, captions, fond) | 0,5 j | Très faible | À faire |
| 1 | Schema `RituelVideo` étendu (chapters, provenance, durée display) | 0,5 j | Faible | À faire |
| 2 | `VideoPosterCover` (click-to-play overlay branded) | 1 j | Moyen | À faire |
| 3 | `VideoChapters` (mini-timeline cliquable 4 segments) | 1 j | Moyen | À faire |
| 4 | IFrame API YouTube — `video_complete` + 25/50/75 % | 0,5 j | Faible | À faire |
| 5 | Provenance maison + CTA post-vidéo | 0,5 j | Très faible | À faire |
| 6 | Admin éditeur `/admin/kit/video` | 2 j | Moyen | À faire |
| 7 | Migration self-hosted (variante existante rebranchée) | 3 j (dont 1 j DA master) | Moyen | À faire |
| 8 | E2E Playwright + a11y axe | 1 j | Faible | À faire |
| 9 | Cleanup + handoff README | 0,5 j | Très faible | À faire |

**Total** : ~10 j homme. Phases 0-2 livrables dans la semaine ; phase 7 (migration self-hosted) reste tributaire de la livraison du master vidéo par la direction artistique.

## Documents du dossier

1. [`01-context-analyse.md`](01-context-analyse.md) — Analyse Kolenda du composant actuel, forces / faiblesses, citations playbook.
2. [`02-vision-objectifs.md`](02-vision-objectifs.md) — Vision « 90 secondes de geste », OKR mesurables, principes directeurs.
3. [`03-data-model.md`](03-data-model.md) — Schema `RituelVideo` étendu (chapters, provenance, posterCustom, durationDisplay), mock, Sanity (Phase 2 backlog).
4. [`04-backend-design.md`](04-backend-design.md) — Service `resolveVideoContent`, API admin, validation Zod, cache et revalidation.
5. [`05-frontend-public-design.md`](05-frontend-public-design.md) — `VideoPosterCover`, `VideoChapters`, `VideoIFrameTracker`, fallback skeleton, responsive, charte visuelle.
6. [`06-admin-ui-ux-design.md`](06-admin-ui-ux-design.md) — Éditeur admin sous `/admin/kit/video`, formulaire, preview, conventions UX.
7. [`07-tests-strategy.md`](07-tests-strategy.md) — Stratégie Vitest (unit + MSW) + Playwright (E2E + a11y), pyramide, fixtures.
8. [`08-plan-action-phases.md`](08-plan-action-phases.md) — Découpage 10 phases avec étapes test-first, fichiers touchés, critères de done.
9. [`09-runbook-execution.md`](09-runbook-execution.md) — Runbook opérationnel : branche par phase, commandes, validations, rollback.
10. [`10-acceptance-criteria.md`](10-acceptance-criteria.md) — Critères d'acceptation par phase et non-régression globale.

## Ordre de lecture

- **Pour cadrer** : `01` → `02` → `08`.
- **Pour designer** : `03` → `04` → `05` → `06`.
- **Pour implémenter** : `08` (phases) + `07` (tests) en parallèle.
- **Pour exécuter** : `09` (runbook) + `10` (acceptation) en filet.

## Principes directeurs

1. **Test-first sur la logique métier**. Schema Zod, parsing chapitres, calcul progression IFrame API : tests avant code.
2. **Composant modulaire**. `VideoPosterCover`, `VideoChapters`, `VideoIFrameTracker` extraits, réutilisables, branchés par composition.
3. **CMS-piloté**. Tous les champs nouveaux (chapters, provenance, posterCustom, durationDisplay) passent par le schema. Pas de hardcode.
4. **Aucun lien externe agressif** : pas de bouton « Watch on YouTube » mis en avant ; le branding maison reste prioritaire.
5. **Voix maison stricte**. Aucun superlatif, aucune urgence, durée en lettres pour l'expérience (« quatre-vingt-dix secondes »), digits pour les chiffres de preuve (`90″` badge poster).
6. **Zéro régression**. Snapshot tests sur le rendu actuel pinés avant chaque phase.
7. **Accessibilité WCAG AA**. `aria-pressed`, focus trap, navigation clavier sur les chapitres, prefers-reduced-motion respecté.
8. **Backward-compat** : la variante `SelfHostedVariant` reste vivante pour la phase 7 (migration). Les deux variantes partagent les nouveaux composants modulaires.

## Hors périmètre

- La production du **master vidéo self-hosted** (DA externe).
- L'intégration Sanity CMS (Phase 2 du roadmap CMS, hors scope ici).
- Le tracking côté `dispatchToProviders` (Meta CAPI, Snap, etc.) — déjà aligné, on n'y touche pas.
- L'optimisation de la transcription (FR/AR) — domaine éditorial séparé.

## Référence

- Playbook source : [`docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`](../kolenda/FEMIGLOW-KIT-PLAYBOOK.md) §4.4 « Les gestes (vidéo) ».
- Analyse de référence : conversation revue Kolenda du 2026-05-20.
- Dossier précédent (composition) : [`docs/composition-reveal-optim-2026-05/`](../composition-reveal-optim-2026-05/) — mêmes conventions.

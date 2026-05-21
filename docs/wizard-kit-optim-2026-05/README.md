# Refonte du wizard `/kit` — mai 2026

> Plan complet de l'optimisation du **formulaire wizard checkout embarqué**
> dans la section `#commander-femiglow` de `/kit` (Mode A — `wizard_kit`).
>
> Élément ciblé : `KitCommanderSection` + `WizardShell` + `LeadCaptureStep`
> + `AddressStep` + `WizardStepIndicator`.

## Sommaire

| # | Document | Rôle |
|---|---|---|
| 00 | [README.md](README.md) | Vous êtes ici — index + KPIs |
| 01 | [01-context-analyse.md](01-context-analyse.md) | Dissection structurelle + audit Kolenda W1-W12 |
| 02 | [02-vision-objectifs.md](02-vision-objectifs.md) | Vision, KPIs cibles, hypothèses conversion |
| 03 | [03-data-model.md](03-data-model.md) | Extensions schemas wizard-store + form-config + tracking events |
| 04 | [04-backend-design.md](04-backend-design.md) | Tracking enrichi, micro-events, A/B variants CTA |
| 05 | [05-frontend-public-design.md](05-frontend-public-design.md) | WizardCartRecap, NoCommitmentBadge, TimeEstimateBadge, PhoneMaskInput, ResumeBanner, WizardCheckmark, etc. |
| 06 | [06-admin-ui-ux-design.md](06-admin-ui-ux-design.md) | Override admin singleton wizard-kit (copy CTA, badge labels) |
| 07 | [07-tests-strategy.md](07-tests-strategy.md) | Vitest + MSW (mutations) + Playwright `@wizard-*` |
| 08 | [08-plan-action-phases.md](08-plan-action-phases.md) | 5 phases W0→W4 (~2 j-h) |
| 09 | [09-runbook-execution.md](09-runbook-execution.md) | Pas-à-pas par phase + rollback + monitoring J+7/J+30 |
| 10 | [10-acceptance-criteria.md](10-acceptance-criteria.md) | Checklist + show stoppers + non-régression |

## Périmètre

**In-scope** :
- Mini cart-recap permanent en header wizard (P1)
- CTA Lead réécrit en outcome (P2)
- Badge « 0 € maintenant » au-dessus du CTA Address (P3)
- Estimateur temps global + par step (P4)
- Masque téléphone live + check ✓ champs valides (P5)
- Bannière « Bon retour, Yasmine » si leadDraft restauré (P6)
- Mini photo pack header wizard mobile (P7)
- Tracking enrichi `wizard_field_filled` / `wizard_field_corrected` / `wizard_step_abandoned` (P8)
- Hierarchy bouton Retour réduite (P9)
- Reformulation consent « Je veux » + ligne anti-spam (P10)

**Out-of-scope** :
- Refonte du parcours (steps lead → address → thank_you reste figé)
- Ajout d'un step paiement UI (supprimé en CHA-231, reste serveur-side)
- Refonte de `CityAutocomplete` (composant éprouvé, à conserver)
- A/B test multi-variants CTA (peut venir en itération 2)
- Mode B (full page `/commander`) — out of scope, à itérer séparément

## KPIs cibles à 90 jours

| KPI | Baseline (estim. mai 2026) | Cible J+90 |
|---|---|---|
| Drop-off entre `lead_capture` et `address_completed` | ~25-30 % | **≤ 15 %** |
| Drop-off entre `checkout_intent` (1ère frappe) et `lead_capture` | ~40-50 % | **≤ 30 %** |
| Conversion globale `/kit visit → purchase` | ~2-3 % | **≥ 4 %** |
| Temps moyen pour compléter le wizard | ~3 min | **≤ 110 s** |
| Mobile completion rate | ~70 % desktop / ~50 % mobile | **≥ 65 % mobile** |
| Erreurs de validation champ téléphone (`invalid_input`) | ~8-12 % | **≤ 4 %** |
| Lighthouse `/kit` mobile | ≥ 92 | ≥ 92 (préservé) |

## Effort estimé

**~2 j-h** total, 5 phases atomiques + 1 phase optionnelle :

| Phase | Durée | Livrable |
|---|---|---|
| W0 — Setup + tracking enrichi (P8) | ¼ j | 3 events micro + helpers correction detector + abandon detector |
| W1 — Quick wins copy (P2, P9, P10) | ¼ j | CTA outcome + hierarchy Retour + consent reformulé |
| W2 — Réassurance (P3, P4) | ½ j | NoCommitmentBadge + TimeEstimateBadge + WizardStepIndicator enrichi |
| W3 — Cart-recap permanent (P1, P7) | ½ j | WizardCartRecap (sticky mobile) + thumbnail pack |
| W4 — Micro-feedback (P5, P6) | ½ j | PhoneMaskInput + WizardCheckmark + ResumeBanner |
| W5 (opt.) — Admin override singleton | ½ j | KitWizardOverride (copy CTA, badges) |

## Décisions de cadrage actées

Sur la base de l'analyse Kolenda :

1. **CTA Lead** = `« Continuer · paiement à la livraison »` — désamorce la peur du paiement upfront (cf. Trust #1 loss aversion)
2. **Mini cart-recap** = sticky `top-12` sur mobile, statique haut wizard desktop
3. **Estimateur temps** = global header `« ≈ 90 s pour confirmer »` + par step dans `WizardStepIndicator` (60/30/5)
4. **Photo pack header** = mobile only (`< lg`) — desktop a déjà PackVisual à droite
5. **Reformulation consent** = `« Je veux être rappelée »` + microcopy *« Pas de revente, pas de spam »*
6. **Tracking enrichi P8** = livré en W0 (mesure dès le départ pour A/B futur)
7. **Override admin** = G5 optionnel — décision GO/NO-GO à J+30

## Référence

- Playbook Kolenda : `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §5 (Checkout)
- Composants source :
  - `apps/web/src/components/sections/KitCommanderSection.tsx`
  - `apps/web/src/components/checkout/wizard/WizardShell.tsx`
  - `apps/web/src/components/checkout/wizard/steps/LeadCaptureStep.tsx`
  - `apps/web/src/components/checkout/wizard/steps/AddressStep.tsx`
  - `apps/web/src/components/checkout/wizard/WizardStepIndicator.tsx`
- Sections adjacentes refondues :
  - `docs/pack-section-optim-2026-05/` — bloc prix au-dessus
  - `docs/steps-grid-optim-2026-05/` — grille 4 gestes au-dessus

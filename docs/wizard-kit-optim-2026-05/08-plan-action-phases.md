# 08 — Plan d'action — 5 phases (+ 1 optionnelle)

> Effort total **~2 j-h** (G0→G4). Chaque phase = 1 commit atomique
> rétro-compatible et déployable indépendamment. Phases W4-W5 ont des
> dépendances sur W0 (helpers + store extension).
>
> Phase **W5** (admin override) est **optionnelle** — décision GO/NO-GO
> à J+30 selon métriques (cf. doc 02).

## Vue d'ensemble

| Phase | Durée | Livrable | Branch | Gate |
|---|---|---|---|---|
| W0 | ¼ j | Helpers + store extensions + tracking events (P8) | `feat/wizard-phase-0-tracking` | Tests purs verts |
| W1 | ¼ j | Quick wins copy (P2, P9, P10) | `feat/wizard-phase-1-copy` | Tests existants verts + snapshot copy |
| W2 | ½ j | Réassurance : NoCommitmentBadge + TimeEstimate (P3, P4) | `feat/wizard-phase-2-reassurance` | Smoke step 2 + indicator |
| W3 | ½ j | Mini cart-recap permanent + photo pack mobile (P1, P7) | `feat/wizard-phase-3-cart-recap` | Responsive 3 viewports + axe |
| W4 | ½ j | Micro-feedback : PhoneMask + Checkmark + ResumeBanner (P5, P6) | `feat/wizard-phase-4-microfeedback` | E2E `@wizard-*` 0 flake |
| W5 | ½ j | Admin override singleton (optionnel J+30) | `feat/wizard-phase-5-admin` | Cycle Save/Publish/Reset OK |

---

## Phase W0 — Setup + tracking enrichi (¼ j-h)

### W0.1 Setup

```bash
git checkout master && git pull
git checkout -b feat/wizard-phase-0-tracking
```

### W0.2 Étapes

#### W0.2.1 Helpers purs

- `lib/checkout/helpers/phone-mask.ts` + tests (10 cas)
  - `formatPhoneFR`, `parsePhoneFR`
- `lib/checkout/helpers/field-correction-detector.ts` + tests (6 cas)
  - `detectCorrection`
- `lib/checkout/helpers/resume-banner-template.ts` + tests (3 cas)
  - `formatResumeBanner(template, name)`

#### W0.2.2 Copy module

- `lib/checkout/copy/wizard-copy.ts` : exporte `DEFAULT_WIZARD_COPY` + types `WizardCopy`, `WizardFeatureFlags`
- `lib/checkout/copy/wizard-copy.test.ts` : 3-4 cas sur résolution + merge

#### W0.2.3 Schemas tracking

- Étendre `lib/tracking/schemas.ts` avec :
  - `wizard_field_filled`, `wizard_field_corrected`, `wizard_step_abandoned`, `wizard_resume_shown`, `wizard_resume_dismissed`
- Étendre `eventCategoryByName` (5 nouveaux events = 'engagement')
- Tests `schemas.test.ts` : 5 cas (1 par event)

#### W0.2.4 Store extensions

- Étendre `lib/checkout/state/wizard-store.ts` :
  - Nouveaux fields : `fieldFocusedAt`, `fieldCorrections`, `filledFieldsThisSession`, `lastVisibleAt`, `resumeBannerShown`, `resumeBannerDismissed`
  - Nouvelles actions : `registerFieldFocus`, `markFieldFilled`, `incrementFieldCorrection`, `markResumeBannerShown`, `dismissResumeBanner`
  - Update `persist.partialize` pour exclure les fields non-persistents
- Tests `wizard-store.test.ts` : +8 cas

#### W0.2.5 Visibility hook

- `lib/checkout/state/use-wizard-visibility.ts` + tests (~5 cas)
  - IO + timer 10s → `onAbandon(timeInStepMs)`

### W0.3 Verify

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run \
  src/lib/checkout/helpers \
  src/lib/checkout/copy \
  src/lib/checkout/state \
  src/lib/tracking/schemas
```

Aucune régression sur les tests existants wizard.

### W0.4 Commit

```bash
git commit -m "feat(wizard): phase 0 — tracking enrichi + helpers + store extensions"
git push origin feat/wizard-phase-0-tracking
```

### W0.5 Rollback

`git revert` sans impact runtime — aucun composant ne lit encore les
nouveaux champs.

---

## Phase W1 — Quick wins copy (¼ j-h)

### W1.1 Étapes

#### W1.1.1 CTA Lead réécrit (P2)

Modifier `KitCommanderSection.tsx` :
```diff
- ctaLead: 'Continuer',
+ ctaLead: 'Continuer · paiement à la livraison',
```

Et passer la prop au `WizardShell` ; OU brancher `useWizardCopy()` dans
`LeadCaptureStep`.

Décision : on branche `useWizardCopy()` (plus propre, prépare W5).

#### W1.1.2 Consent reformulé (P10)

Modifier `LeadCaptureStep.tsx` :
```diff
- J'accepte d'être contactée par la maison FemiGlow pour ma commande.
- Voir nos mentions légales.
+ {copy.consentLabel}
+ <span className="text-xs text-encre/55">{copy.consentFootnote.replace('mentions légales', '')}<Link>mentions légales</Link></span>
```

Tests `LeadCaptureStep.test.tsx` : ajuster assertion sur le texte.

#### W1.1.3 Hierarchy bouton Retour (P9)

Modifier `AddressStep.tsx` :
```diff
- <Button variant="secondary" size="md" onClick={() => goToStep('lead')}>
+ <Button variant="link" size="md" onClick={() => goToStep('lead')}>
    {t.common.back}
  </Button>
```

Tests `AddressStep.test.tsx` : vérifier variant link.

### W1.2 Smoke

```bash
pnpm --filter web dev
# /kit → scroll wizard
# Step 1 : CTA = « Continuer · paiement à la livraison »
# Step 1 : consent = « Je veux être rappelée pour confirmer ma commande »
#                   « Pas de revente, pas de spam — mentions légales »
# Step 2 : bouton Retour = lien souligné chuchoté, pas une box border
```

### W1.3 Commit

```bash
git commit -m "feat(wizard): phase 1 — quick wins copy (CTA outcome + consent reformulé + hierarchy Retour)"
```

### W1.4 Rollback

`git revert`. La copy retombe sur les valeurs précédentes.

---

## Phase W2 — Réassurance : NoCommitmentBadge + TimeEstimate (½ j-h)

### W2.1 Étapes

#### W2.1.1 NoCommitmentBadge (P3)

- Créer `components/checkout/wizard/NoCommitmentBadge.tsx` (Server pur)
- Tests `NoCommitmentBadge.test.tsx` (5 cas)
- Brancher dans `AddressStep.tsx` au-dessus du CTA Confirmer

#### W2.1.2 TimeEstimateBadge (P4)

- Créer `components/checkout/wizard/TimeEstimateBadge.tsx` (Server pur)
- Tests (3 cas)
- Brancher dans `WizardShell.tsx` après le header global

#### W2.1.3 WizardStepIndicator enrichi (P4)

- Modifier `WizardStepIndicator.tsx` : nouvelle prop `timesPerStep?: Record<StepName, string>`
- Rendre time à côté du label, condition d'affichage si prop fournie
- Tests update (3 nouveaux cas)
- Brancher dans `WizardShell.tsx` avec `timesPerStep` calculé depuis `copy`

### W2.2 Smoke

```bash
# /kit → scroll wizard
# Header wizard : « ≈ 90 secondes pour confirmer » centré italique
# Indicator : « 01 · Vos coordonnées · 60 s » / « 02 · Adresse · 30 s » / « 03 · Confirmation · 5 s »
# Step 2 : NoCommitmentBadge sauge soft au-dessus du CTA « Aucun paiement maintenant » + sub
```

### W2.3 Commit

```bash
git commit -m "feat(wizard): phase 2 — réassurance (NoCommitmentBadge + TimeEstimate global + per-step)"
```

---

## Phase W3 — Mini cart-recap permanent + thumb pack mobile (½ j-h)

### W3.1 Étapes

#### W3.1.1 WizardCartRecap (P1)

- Créer `components/checkout/wizard/WizardCartRecap.tsx` (Server)
- Tests (8 cas)
- Brancher dans `WizardShell.tsx` (en premier enfant) — passé via prop `initialCart`
- Comportement sticky mobile / statique desktop via Tailwind

#### W3.1.2 WizardMobilePackThumb (P7)

- Créer `components/checkout/wizard/WizardMobilePackThumb.tsx` (Server)
- Tests (3 cas)
- Brancher dans `KitCommanderSection.tsx` header (avant le H2)

### W3.2 Smoke responsive

```bash
# Mobile 375 :
# - cart-recap sticky top-0 (suit le scroll)
# - thumb pack 64×80 à gauche du H2 « Trois gestes, livrés chez vous. »
# Tablet 768 :
# - cart-recap statique 2 lignes en haut du wizard box
# - thumb pack absent
# Desktop 1280 :
# - cart-recap statique 2 lignes
# - thumb pack absent
```

### W3.3 Commit

```bash
git commit -m "feat(wizard): phase 3 — mini cart-recap permanent + thumb pack mobile header"
```

---

## Phase W4 — Micro-feedback : PhoneMask + Checkmark + ResumeBanner (½ j-h)

### W4.1 Étapes

#### W4.1.1 PhoneMaskInput (P5)

- Créer `components/checkout/wizard/PhoneMaskInput.tsx` (Client)
- Tests (7 cas)
- Remplacer `TextField` par `PhoneMaskInput` dans `LeadCaptureStep.tsx`

#### W4.1.2 WizardCheckmark (P5)

- Créer `components/checkout/wizard/WizardCheckmark.tsx` (Server)
- Ajouter keyframe `fade-in` dans `tailwind.config.ts`
- Tests (4 cas)
- Brancher dans `LeadCaptureStep` à droite des labels (firstName + phone)

#### W4.1.3 ResumeBanner (P6)

- Créer `components/checkout/wizard/ResumeBanner.tsx` (Client)
- Tests (7 cas)
- Brancher dans `LeadCaptureStep` en haut, conditionnel sur leadDraft.firstName
- Émission tracking events au mount + dismiss

#### W4.1.4 Tracking enrichi runtime (P8)

- Brancher `useFieldCorrectionTracker` dans LeadCaptureStep + AddressStep
- Brancher `useWizardVisibility` pour `wizard_step_abandoned`
- Émission `wizard_field_filled` quand un champ devient valide (via watch + isValid)

### W4.2 Tests E2E

- Créer `apps/web/e2e/wizard-kit.spec.ts` avec ~13 cas (cf. doc 07 §5)
- Run `playwright test --grep '@wizard-'` × 3 → 0 flake

### W4.3 README handoff

- Mettre à jour `apps/web/src/components/checkout/wizard/README.md` (créer
  si absent) avec inventaire des composants + helpers + tracking events

### W4.4 Commit

```bash
git commit -m "feat(wizard): phase 4 — micro-feedback (PhoneMask + Checkmark + ResumeBanner + tracking enrichi runtime)"
```

---

## Phase W5 — Admin override singleton (½ j-h, optionnel)

Si J+30 valide le besoin (cf. décisions 06) :

### W5.A Store + resolver + types + schemas (¼ j)
- `lib/kit/wizard/types.ts`
- `lib/kit/wizard/store.ts` (memoryStore via `ext('kit-wizard')`)
- `lib/kit/wizard/resolver.ts`
- `lib/kit/wizard/schemas.ts` (Zod `kitWizardOverrideUpsertSchema`)
- Tests 20+ cas

### W5.B API routes (¼ j)
- `GET / PATCH /api/admin/kit/wizard`
- `POST /api/admin/kit/wizard/publish`
- `POST /api/admin/kit/wizard/reset`
- Audit `kit_wizard.update/publish/reset`
- Magic word `RESET-WIZARD`

### W5.C Admin UI (¼ j)
- `KitWizardEditor.tsx`
- `KitWizardPreviewCard.tsx`
- `KitWizardResetDialog.tsx`
- `WizardFeatureToggle.tsx`
- AdminShell entry `kit-wizard`

### W5.D Bind public
- Modifier `KitCommanderSection.tsx` pour `await resolveKitWizard()` côté serveur et passer `copy`/`features` en props
- OU créer `KitCommanderSectionBound.tsx` wrapper RSC (préférable)

---

## Anti-patterns à éviter dans l'exécution

| Anti-pattern | Risque | Mitigation |
|---|---|---|
| Mélanger W1 + W2 + W3 dans 1 commit | Rollback impossible | 1 phase = 1 branche = 1 commit |
| Sauter test-first sur PhoneMaskInput | Régression de format | Tests purs phone-mask en W0 |
| Modifier `WizardShell` ET tous les step components en parallèle sans verify | Hydration mismatch | Builds + smoke browser après chaque phase |
| Override admin sans validation Zod stricte | Sécurité | Zod `.strict()` + `getAdminSession` |
| Tracking events sans guard `filledFieldsThisSession` | Pollution analytics | Set côté store + guard explicite |
| ResumeBanner réaffichée à chaque navigation | UX intrusive | One-shot via `resumeBannerShown` flag |
| CartRecap sticky bloque le scroll iOS | UX critique | Tester sur Safari iOS 16+ minimum |
| Masque phone interfère avec autocomplete Apple/Chrome | Friction inversée | Tester avec autofill mock + smoke devices |
| Mention nominale fondatrice dans copy | Voix maison | Sweep `grep -ri "souheila"` avant push |

## Séquence des commits attendue

```
feat(wizard): phase 0 — tracking enrichi + helpers + store extensions
feat(wizard): phase 1 — quick wins copy (CTA outcome + consent + hierarchy)
feat(wizard): phase 2 — réassurance (NoCommitmentBadge + TimeEstimate)
feat(wizard): phase 3 — mini cart-recap permanent + thumb pack mobile
feat(wizard): phase 4 — micro-feedback (PhoneMask + Checkmark + ResumeBanner)
test(wizard): phase 4 — E2E Playwright + axe
docs(wizard): handoff README wizard + tracking events
[optionnel W5 — feat/test/docs]
```

## Checklist générale par phase

Avant chaque commit :

- [ ] `pnpm --filter web exec tsc --noEmit` exit 0 sur fichiers touchés
- [ ] `pnpm --filter web exec vitest run <ciblé>` 100 % vert
- [ ] Smoke navigateur sur 3 viewports (375, 768, 1280)
- [ ] Aucune erreur console
- [ ] Aucune régression sur tests adjacents (pack, steps, etc.)
- [ ] Conventions FemiGlow respectées (apostrophes, NBSP, palette)
- [ ] Pas de mention nominale fondatrice

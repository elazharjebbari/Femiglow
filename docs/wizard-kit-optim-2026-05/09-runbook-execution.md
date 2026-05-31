# 09 — Runbook d'exécution

Procédure pas-à-pas pour livrer la refonte du wizard `/kit`.
À suivre **dans l'ordre**. Chaque phase a son **rollback** documenté
et son **smoke test** avant commit.

> Référence du plan : `08-plan-action-phases.md`.
> Référence Kolenda : `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §5 (Checkout).

## 0. Pré-requis

```bash
# Sanity environnement
node --version         # ≥ 20.x
pnpm --version         # ≥ 9.15.x
git status             # working tree clean
git pull origin master

pnpm install --frozen-lockfile
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run --reporter=verbose 2>&1 | tail -5
# Expected: tous verts (hors flakes pré-existants documentés)

pnpm --filter web build
# Expected: exit 0
```

Si check échoue → **stop, investiguer**.

### 0.1 Pré-lecture

1. `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §5 (Checkout)
2. `docs/wizard-kit-optim-2026-05/01-context-analyse.md` (W1-W12)
3. `apps/web/src/components/checkout/wizard/WizardShell.tsx` (état actuel)
4. `apps/web/src/components/checkout/wizard/steps/LeadCaptureStep.tsx`
5. `apps/web/src/components/checkout/wizard/steps/AddressStep.tsx`
6. `apps/web/src/components/sections/KitCommanderSection.tsx`

### 0.2 Conventions de branches

| Phase | Branche | Commit prefix |
|---|---|---|
| W0 | `feat/wizard-phase-0-tracking` | `feat(wizard):` |
| W1 | `feat/wizard-phase-1-copy` | `feat(wizard):` |
| W2 | `feat/wizard-phase-2-reassurance` | `feat(wizard):` |
| W3 | `feat/wizard-phase-3-cart-recap` | `feat(wizard):` |
| W4 | `feat/wizard-phase-4-microfeedback` | `feat(wizard):` puis `test(wizard):` |
| W5 | `feat/wizard-phase-5-admin` | `feat(wizard):` |

---

## 1. Phase W0 — Tracking + helpers + store extensions (¼ j-h)

### 1.1 Setup

```bash
git checkout master && git pull
git checkout -b feat/wizard-phase-0-tracking
```

### 1.2 Étapes

#### 1.2.1 Helpers purs test-first

**`lib/checkout/helpers/phone-mask.ts`** + tests (10 cas)
```bash
pnpm --filter web exec vitest run src/lib/checkout/helpers/phone-mask.test.ts
# ✗ Tests échouent (helper non implémenté)
```

Implémenter `formatPhoneFR` + `parsePhoneFR` :

```ts
export function formatPhoneFR(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}
export function parsePhoneFR(masked: string): string {
  return masked.replace(/\D/g, '');
}
```

Lancer tests → ✓ verts.

**`lib/checkout/helpers/field-correction-detector.ts`** + tests (6 cas)
Voir doc 03 §1.2 pour code.

**`lib/checkout/helpers/resume-banner-template.ts`** + tests (3 cas)

#### 1.2.2 Copy module

`lib/checkout/copy/wizard-copy.ts` :
- Exporte `DEFAULT_WIZARD_COPY` constant
- Types `WizardCopy`, `WizardFeatureFlags`
- Helper `resolveWizardCopy(override)` qui merge partial sur defaults

#### 1.2.3 Schemas tracking

Étendre `lib/tracking/schemas.ts` avec 5 nouveaux events Zod (voir doc 03 §2).

Étendre `eventCategoryByName` :
```ts
wizard_field_filled: 'engagement',
wizard_field_corrected: 'engagement',
wizard_step_abandoned: 'engagement',
wizard_resume_shown: 'engagement',
wizard_resume_dismissed: 'engagement',
```

Tests : 5 cas dans `schemas.test.ts` (valid + reject cas edge).

#### 1.2.4 Store extensions

Étendre `lib/checkout/state/wizard-store.ts` :
- Nouveaux fields éphémères + persistents (voir doc 03 §1)
- Nouvelles actions
- Update `persist.partialize`

Tests `wizard-store.test.ts` : +8 cas (state transitions).

#### 1.2.5 Visibility hook

`lib/checkout/state/use-wizard-visibility.ts` :
- IO + timer 10s → callback `onAbandon`
- Tests ~5 cas avec mock IO + fake timers

### 1.3 Verify

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run \
  src/lib/checkout/helpers \
  src/lib/checkout/copy \
  src/lib/checkout/state \
  src/lib/tracking/schemas
# Tous verts. +20-30 tests nouveaux.
```

### 1.4 Commit + push

```bash
git add apps/web/src/lib/checkout/helpers \
        apps/web/src/lib/checkout/copy \
        apps/web/src/lib/checkout/state \
        apps/web/src/lib/tracking/schemas.ts
git commit -m "feat(wizard): phase 0 — tracking enrichi + helpers + store extensions"
git push origin feat/wizard-phase-0-tracking
```

### 1.5 Rollback
`git revert <commit>`. Aucun impact runtime — les nouveaux champs / events
ne sont pas encore utilisés.

---

## 2. Phase W1 — Quick wins copy (¼ j-h)

### 2.1 Setup

```bash
git checkout -b feat/wizard-phase-1-copy
```

### 2.2 Étapes

#### 2.2.1 CTA Lead réécrit (P2)

`apps/web/src/components/sections/KitCommanderSection.tsx` :
```diff
copy={{
   title: 'Commander le rituel FemiGlow',
-  ctaLead: 'Continuer',
+  ctaLead: 'Continuer · paiement à la livraison',
   ctaAddress: 'Confirmer la commande',
   thankYouTitle: 'Commande reçue, on vous rappelle.',
}}
```

#### 2.2.2 Consent reformulé (P10)

`apps/web/src/components/checkout/wizard/steps/LeadCaptureStep.tsx` :
- Remplacer le `<label>` du consent avec la nouvelle copy + footnote
- Lien `mentions légales` préservé en bas dans la footnote

#### 2.2.3 Hierarchy bouton Retour (P9)

`apps/web/src/components/checkout/wizard/steps/AddressStep.tsx` :
```diff
- <Button variant="secondary" size="md" onClick={() => goToStep('lead')}>
+ <Button variant="link" size="md" onClick={() => goToStep('lead')}>
```

#### 2.2.4 Tests mis à jour

- `LeadCaptureStep.test.tsx` : ajuster assertion sur texte consent
- `AddressStep.test.tsx` : vérifier variant link sur bouton Retour

### 2.3 Smoke

```bash
pnpm --filter web dev
# /kit → scroll wizard
# Step 1 : CTA = « Continuer · paiement à la livraison »
# Step 1 : consent = « Je veux être rappelée pour confirmer ma commande »
#                   « Pas de revente, pas de spam — mentions légales »
# Step 2 : bouton Retour = lien souligné (text underline), pas une box
```

### 2.4 Commit

```bash
git commit -m "feat(wizard): phase 1 — quick wins copy (CTA outcome + consent + hierarchy Retour)"
git push origin feat/wizard-phase-1-copy
```

### 2.5 Rollback
`git revert`. La copy retombe sur les valeurs précédentes.

---

## 3. Phase W2 — Réassurance (½ j-h)

### 3.1 Étapes

#### 3.1.1 NoCommitmentBadge (P3)

Créer `apps/web/src/components/checkout/wizard/NoCommitmentBadge.tsx`
(Server pur — voir doc 05 §3).

Tests `NoCommitmentBadge.test.tsx` (5 cas).

Brancher dans `AddressStep.tsx` au-dessus des boutons :
```diff
+ <NoCommitmentBadge
+   label="Aucun paiement maintenant"
+   sub="Vous payez à la livraison, en main"
+ />
  <div className="flex flex-col gap-3 pt-2 sm:flex-row …">
    <Button variant="link" …>Retour</Button>
    <Button variant="primary" …>Confirmer la commande</Button>
  </div>
```

#### 3.1.2 TimeEstimateBadge (P4)

Créer `apps/web/src/components/checkout/wizard/TimeEstimateBadge.tsx` (Server pur).
Tests (3 cas).
Brancher dans `WizardShell.tsx` après le header global.

#### 3.1.3 WizardStepIndicator enrichi (P4)

Modifier `WizardStepIndicator.tsx` : nouvelle prop optionnelle `timesPerStep`.

Tests (3 nouveaux cas + 5 existants préservés).

### 3.2 Smoke

```bash
# /kit Step 1 :
# - Header wizard : « ≈ 90 secondes pour confirmer » centré italique
# - Indicator : « 01 · Vos coordonnées · 60 s »
# /kit submit step 1 → Step 2 :
# - Indicator : « 02 · Adresse · 30 s » current
# - NoCommitmentBadge sauge soft visible au-dessus CTA + sub italique
```

### 3.3 Commit

```bash
git commit -m "feat(wizard): phase 2 — réassurance (NoCommitmentBadge + TimeEstimate global + per-step)"
```

### 3.4 Rollback
`git revert`. Steps repassent en mode sans réassurance.

---

## 4. Phase W3 — Cart-recap permanent + thumb pack (½ j-h)

### 4.1 Étapes

#### 4.1.1 WizardCartRecap (P1)

Créer `apps/web/src/components/checkout/wizard/WizardCartRecap.tsx` (Server).
Tests (8 cas).

Brancher dans `WizardShell.tsx` comme **premier enfant** du wrapper.
Important : utiliser `sticky top-0` mobile + `static` desktop.

#### 4.1.2 WizardMobilePackThumb (P7)

Créer `apps/web/src/components/checkout/wizard/WizardMobilePackThumb.tsx`.
Tests (3 cas).

Brancher dans `KitCommanderSection.tsx` header :
```diff
- <header className="mb-10 max-w-2xl space-y-3">
+ <header className="mb-10 flex max-w-2xl gap-4">
+   <WizardMobilePackThumb />
+   <div className="space-y-3">
    <Text ...>{kicker}</Text>
    <Heading ...>{title}</Heading>
    <Text ...>{subtitle}</Text>
+   </div>
- </header>
+ </header>
```

### 4.2 Smoke responsive

```bash
# Mobile 375 :
# - cart-recap sticky top-0, suit le scroll, n'écrase pas le contenu
# - thumb pack 64×80 à gauche du H2
# Tablet 768 :
# - cart-recap statique 2 lignes top wizard
# - thumb pack absent
# Desktop 1280 :
# - cart-recap statique 2 lignes top wizard
# - thumb pack absent
# Test iOS Safari (réel ou simulé) : sticky fonctionne sans freeze
```

### 4.3 Commit

```bash
git commit -m "feat(wizard): phase 3 — mini cart-recap permanent + thumb pack mobile header"
```

---

## 5. Phase W4 — Micro-feedback (½ j-h)

### 5.1 Étapes

#### 5.1.1 PhoneMaskInput (P5)

Créer `apps/web/src/components/checkout/wizard/PhoneMaskInput.tsx`.
Tests (7 cas).

Dans `LeadCaptureStep.tsx`, remplacer `TextField` du phone par `PhoneMaskInput`.

#### 5.1.2 WizardCheckmark (P5)

Créer `apps/web/src/components/checkout/wizard/WizardCheckmark.tsx`.
Ajouter keyframe `fade-in` dans `tailwind.config.ts`.
Tests (4 cas).

Brancher dans labels des TextField + PhoneMaskInput dans `LeadCaptureStep`.

#### 5.1.3 ResumeBanner (P6)

Créer `apps/web/src/components/checkout/wizard/ResumeBanner.tsx` (Client).
Tests (7 cas).

Brancher dans `LeadCaptureStep` en haut de la section (conditionnel sur leadDraft.firstName).

#### 5.1.4 Tracking enrichi runtime (P8)

Créer hooks :
- `lib/tracking/use-wizard-field-tracking.ts` (gère `wizard_field_filled` + `wizard_field_corrected`)

Brancher dans LeadCaptureStep + AddressStep sur tous les champs.

Brancher `useWizardVisibility` dans `WizardShell` pour `wizard_step_abandoned`.

#### 5.1.5 Tests E2E

Créer `apps/web/e2e/wizard-kit.spec.ts` avec 13 cas (voir doc 07 §5).
Run × 3 → 0 flake.

### 5.2 Quality gates finaux

```bash
pnpm --filter web exec tsc --noEmit       # 0 erreur sur fichiers W0-W4
pnpm --filter web exec vitest run         # tous verts
pnpm --filter web exec playwright test --grep '@wizard-'  # 0 flake × 3 runs
pnpm --filter web build                   # exit 0
```

### 5.3 Commit + handoff README

```bash
git commit -m "feat(wizard): phase 4 — micro-feedback (PhoneMask + Checkmark + ResumeBanner + tracking enrichi runtime)"

# Mettre à jour apps/web/src/components/checkout/wizard/README.md
git commit -m "docs(wizard): handoff README wizard + tracking events §5"
```

---

## 6. Déploiement (post W4)

### 6.1 Pré-déploiement

```bash
# Sur la branche merge candidate
git checkout master && git pull
git merge feat/wizard-phase-0-tracking --no-ff
git merge feat/wizard-phase-1-copy --no-ff
git merge feat/wizard-phase-2-reassurance --no-ff
git merge feat/wizard-phase-3-cart-recap --no-ff
git merge feat/wizard-phase-4-microfeedback --no-ff
# (ou via PR + squash sur GitHub)

pnpm install --frozen-lockfile
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run
pnpm --filter web build
```

### 6.2 Push

```bash
git push origin master
```

Vercel CI déclenche le build prod. Smoke prod :

```bash
curl -s https://femiglow.example.com/kit | \
  grep -oE "(wizard-cart-recap|wizard-no-commitment-badge|wizard-time-estimate|Continuer · paiement)"
# Doit retourner : wizard-cart-recap, wizard-time-estimate, Continuer · paiement
# (le badge et l'indicator sont rendus côté client après hydration)
```

### 6.3 Rollback prod

`git revert <merge-commit>` ou rollback Vercel UI.

---

## 7. Post-déploiement (J+7 / J+30)

### 7.1 Monitoring J+7

| KPI | Cible | Action si non atteint |
|---|---|---|
| `wizard_field_filled` count / `checkout_intent` count | ≥ 70 % | Investiguer quel champ bloque (filtrer `field_name`) |
| `wizard_field_corrected` count moyen / session | ≤ 1.5 | Investiguer quel champ génère des corrections |
| `wizard_step_abandoned` (step lead) | ≤ 30 % | Vérifier scroll/focus, peut-être trop tôt après scroll-anchor |
| Drop-off `lead_capture` → `address_completed` | ≤ 15 % | Vérifier que NoCommitmentBadge est bien rendu |
| Erreurs validation phone (`invalid_input`) | ≤ 5 % | Vérifier que le mask ne casse pas le format serveur |
| Aucune erreur 5xx sur /api/checkout/* | 0 | Vérifier logs Vercel |
| Lighthouse `/kit` mobile | ≥ 92 | Audit bundle delta |

### 7.2 Décision GO/NO-GO W5

À J+30, décider :
- Si métriques OK et besoin d'A/B testing visible → livrer W5 (admin override)
- Si métriques OK et pas de demande éditoriale → rester sur mock (édition git)
- Si métriques non atteintes → itération 2 avant W5 (focus sur point bloquant)

### 7.3 Bilan J+90

Comparer :
- Conversion globale avant/après (baseline ~2-3 % vs cible ≥ 4 %)
- Drop-off par étape avant/après
- Temps moyen complétion avant/après
- Mobile rate avant/après

Rédiger un post-mortem dans `docs/wizard-kit-iter-2026-08/` si nouvelle
itération nécessaire.

---

## 8. Anti-patterns d'exécution

| Anti-pattern | Mitigation |
|---|---|
| Sauter test-first sur PhoneMaskInput | Tests purs phone-mask en W0 obligatoirement |
| Mélanger W1 + W2 dans 1 commit | 1 phase = 1 branche = 1 commit |
| Push sans rebuild .next (cache stale dev) | `rm -rf .next` avant smoke navigateur |
| Tester E2E sur dev server hot-reload | Toujours `pnpm build` + `pnpm start` pour E2E |
| ResumeBanner réaffichée à chaque keystroke | Guard via store `resumeBannerShown` Set |
| Cart-recap sticky bloque scroll iOS | Tester sur Safari iOS Simulator avant push |
| Tracking events sans guard 1×/session | `filledFieldsThisSession` Set obligatoire |
| Push sans `tsc --noEmit` réussi local | Pre-commit hook (déjà actif) |
| Mention fondatrice dans copy | Sweep `grep -ri "souheila" apps/web/src/` |

## 9. Communication

### 9.1 Annonce démarrage

> « Démarrage refonte wizard checkout `/kit`. 5 phases, ~2 j-h, livraison
> cible 1 semaine. Plan : `docs/wizard-kit-optim-2026-05/`. Tracking enrichi
> dès la W0 pour mesurer l'impact réel. »

### 9.2 Annonce déploiement

> « Refonte wizard déployée en prod. Nouveaux events tracking
> `wizard_field_filled`, `_corrected`, `_step_abandoned`. KPIs à monitorer
> J+7 et J+30. Décision GO/NO-GO admin éditeur (W5) à J+30. »

### 9.3 Bilan J+90

Bilan factuel : valeurs atteintes vs cibles, hypothèses validées /
infirmées, prochaines itérations.

---

## 10. Checklist de fin

Avant merge final :

- [ ] W0→W4 commités et mergés sur master
- [ ] `tsc --noEmit` 0 erreur sur fichiers wizard-*
- [ ] `vitest run` 0 fail
- [ ] `playwright test --grep '@wizard-'` 0 flake × 3 runs
- [ ] `next build` exit 0, bundle delta `/kit` ≤ +5 kB gzipped
- [ ] Lighthouse `/kit` mobile ≥ 92
- [ ] Smoke prod `/kit` contient :
  - cart-recap visible
  - « ≈ 90 secondes pour confirmer »
  - « Continuer · paiement à la livraison »
  - « Aucun paiement maintenant » (step 2)
  - « Je veux être rappelée » (consent)
- [ ] Tests responsive 3 viewports OK
- [ ] Axe 0 violation sérieuse/critique
- [ ] Aucune mention nominale fondatrice
- [ ] README handoff publié
- [ ] KPIs J+7 monitorés

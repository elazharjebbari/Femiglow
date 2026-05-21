# 07 — Stratégie de tests

## 1. Pyramide

```
                    ▲
                   ╱ ╲      E2E Playwright (smoke + conv flow)
                  ╱   ╲     ~10 cas — @wizard-*
                 ╱─────╲
                ╱       ╲   Integration / MSW
               ╱         ╲  ~6 cas (lead + address mutations)
              ╱───────────╲
             ╱             ╲ Unit Vitest (composants + helpers)
            ╱_______________╲ ~50 cas
```

## 2. Couverture cible

| Module | Couverture branches |
|---|---|
| `lib/checkout/helpers/phone-mask.ts` | ≥ 95 % |
| `lib/checkout/helpers/field-correction-detector.ts` | ≥ 95 % |
| `lib/checkout/copy/wizard-copy.ts` | ≥ 90 % (helpers résolution) |
| `lib/checkout/state/wizard-store.ts` (nouveaux fields) | ≥ 90 % |
| `lib/checkout/state/use-wizard-visibility.ts` | ≥ 85 % |
| `components/checkout/wizard/WizardCartRecap.tsx` | ≥ 90 % |
| `components/checkout/wizard/NoCommitmentBadge.tsx` | ≥ 90 % |
| `components/checkout/wizard/TimeEstimateBadge.tsx` | ≥ 90 % |
| `components/checkout/wizard/PhoneMaskInput.tsx` | ≥ 90 % |
| `components/checkout/wizard/WizardCheckmark.tsx` | ≥ 90 % |
| `components/checkout/wizard/ResumeBanner.tsx` | ≥ 90 % |
| `components/checkout/wizard/WizardMobilePackThumb.tsx` | ≥ 90 % |
| `components/checkout/wizard/WizardStepIndicator.tsx` (modifié) | ≥ 90 % |
| `components/checkout/wizard/WizardShell.tsx` (modifié) | ≥ 80 % |
| `components/checkout/wizard/steps/LeadCaptureStep.tsx` (modifié) | ≥ 85 % |
| `components/checkout/wizard/steps/AddressStep.tsx` (modifié) | ≥ 85 % |
| `lib/kit/wizard/**` (W5 si livré) | ≥ 90 % |

## 3. Tests unitaires Vitest (détail)

### 3.1 Helpers

**`phone-mask.test.ts`** (~10 cas)
- `formatPhoneFR('')` → `''`
- `formatPhoneFR('0')` → `'0'`
- `formatPhoneFR('06')` → `'06'`
- `formatPhoneFR('0612345')` → `'06 12 34 5'`
- `formatPhoneFR('0612345678')` → `'06 12 34 56 78'`
- `formatPhoneFR('06123456789')` → `'06 12 34 56 78'` (trim à 10 digits)
- `formatPhoneFR('+212612345678')` → strip non-digit puis format
- Idempotence : `formatPhoneFR(formatPhoneFR('0612345678'))` === `'06 12 34 56 78'`
- Rejette caractères spéciaux : `formatPhoneFR('06-12-34')` → `'06 12 34'`
- `parsePhoneFR('06 12 34 56 78')` → `'0612345678'` (réciproque)

**`field-correction-detector.test.ts`** (~6 cas)
- Champ vide → vide : pas de correction
- Champ vide → 1 char : pas de correction (frappe normale)
- Champ "Yasmine" → "Yasmin" : pas de correction (delete normal 1 char)
- Champ "Yasmine" → "Yas" : correction (drop > 50 %)
- Champ "Yasmine" → "" : correction (full clear)
- Champ "0612345678" → "061234" : correction (drop > 50 %)

### 3.2 Composants Server purs

**`WizardCartRecap.test.tsx`** (~8 cas)
- Rend null si cart vide
- Rend label `1 × Pack FemiGlow` pour 1 item
- Rend prix total formaté
- Rend prix barré si `priceCompareAt` fourni
- Image thumbnail rendue avec alt vide (decorative)
- Sticky `top-0` mobile, statique desktop (vérif className)
- `aria-label` correct
- Multi-items : `2 × Pack FemiGlow` (cas edge)

**`NoCommitmentBadge.test.tsx`** (~5 cas)
- Rend label + sub par défaut
- Override labels via props
- Icône cadenas SVG aria-hidden
- `role="note"` + `aria-label`
- Classes sauge correctes

**`TimeEstimateBadge.test.tsx`** (~3 cas)
- Rend label
- `data-testid="wizard-time-estimate"`
- Style italic + text-encre/60

**`WizardCheckmark.test.tsx`** (~4 cas)
- Rend `✓` si visible=true
- Retourne `null` si visible=false
- Aria-hidden=true
- Classe `text-sauge-dark` présente

**`WizardMobilePackThumb.test.tsx`** (~3 cas)
- Rend Image
- Classes responsive `lg:hidden`
- Props src + alt propagés

### 3.3 Composants Client

**`PhoneMaskInput.test.tsx`** (~7 cas)
- Affiche valeur masquée à l'init si `value` non vide
- Au change : applique `formatPhoneFR` au displayValue
- Au change : passe la valeur RAW au onChange parent (pour Zod)
- Reject caractères non-numériques
- Max 10 digits enforced
- ref propagé
- autoComplete='tel' préservé

**`ResumeBanner.test.tsx`** (~7 cas)
- Rend template avec `{firstName}` remplacé
- Émet `wizard_resume_shown` au mount (1 fois)
- Click ✕ → `wizard_resume_dismissed` + `setVisible(false)`
- Auto-hide après `autoHideMs` (vi.useFakeTimers)
- `role="status"` + `aria-live="polite"`
- Ne s'affiche pas si déjà dismiss (store flag)
- focus visible ring sur bouton ✕

**`WizardStepIndicator.test.tsx`** (mis à jour, +3 cas)
- Existants 5 cas préservés
- Ajout : rend time per step si `timesPerStep` fourni
- Ajout : pas de time si prop absente (rétro-compat)
- Ajout : time positionné après label sur même ligne

### 3.4 Composants modifiés

**`LeadCaptureStep.test.tsx`** (+5 cas)
- Existants préservés
- Ajout : rend ResumeBanner si leadDraft.firstName présent
- Ajout : ne rend pas ResumeBanner si resumeBannerDismissed=true
- Ajout : WizardCheckmark visible quand firstName valide
- Ajout : PhoneMaskInput utilisé à la place de TextField
- Ajout : CTA contient `copy.ctaLead`

**`AddressStep.test.tsx`** (+3 cas, mais peut être hors scope)
- Ajout : NoCommitmentBadge rendu si feature ON
- Ajout : bouton Retour en variant="link" (pas secondary)
- Ajout : CTA contient `copy.ctaAddress`

**`WizardShell.test.tsx`** (si existe — sinon créer minimal +4 cas)
- Rend WizardCartRecap si initialCart + feature ON
- Rend TimeEstimateBadge si feature ON
- Indicator reçoit timesPerStep
- HydrationFallback affiché avant hydration

### 3.5 Store wizard

**`wizard-store.test.ts`** (+8 cas, en complément existant)
- `registerFieldFocus(name)` → enregistre timestamp dans fieldFocusedAt
- `markFieldFilled(name, step)` → ajoute à filledFieldsThisSession (Set)
- Re-call markFieldFilled même champ → no-op (set)
- `incrementFieldCorrection(name)` → incrémente compteur
- `markResumeBannerShown()` → flip resumeBannerShown=true
- `dismissResumeBanner()` → flip resumeBannerDismissed=true (persistent)
- Persistence : resumeBannerDismissed survit reset state
- Persistence : filledFieldsThisSession ne survit PAS (Set reset)

### 3.6 Schemas tracking

**`schemas.test.ts`** (+5 cas)
- `wizard_field_filled` schema accepte payload valide
- `wizard_field_corrected` schema accepte payload valide
- `wizard_step_abandoned` schema accepte payload valide
- `wizard_resume_shown` + `_dismissed` schemas valides
- Rejette field_name inconnu (enum strict)

## 4. Tests MSW (Mock Service Worker) — Phase W0 + W4

### 4.1 `LeadCaptureStep + MSW.test.tsx` (~3 cas)

- Submit lead success → mutation appelée + `lead_capture` émis + navigate step `address`
- Submit lead 422 invalid_input → setError sur phone + banner OK
- Submit lead 0 (network offline) → networkBanner « Connexion réseau impossible »

### 4.2 `AddressStep + MSW.test.tsx` (~3 cas)

- Submit address success → mutation + `address_completed` + `purchase` + navigate step `thank_you`
- Submit address 422 stock_insufficient → banner spécifique
- Submit address 0 → networkBanner

## 5. Tests E2E Playwright

### 5.1 `e2e/wizard-kit.spec.ts`

| Tag | Scénario |
|---|---|
| `@wizard-render` | KitCommanderSection visible, WizardShell mount, indicator 01/02/03 visible |
| `@wizard-render` | WizardCartRecap affiche `1 × Pack FemiGlow` + `199 MAD` + `~~390 MAD~~` |
| `@wizard-render` | TimeEstimateBadge `≈ 90 secondes` visible |
| `@wizard-render` | NoCommitmentBadge visible APRÈS Step 1 submit (= sur step Address) |
| `@wizard-interaction` | Step 1 : firstName + phone valides → WizardCheckmark ✓ |
| `@wizard-interaction` | PhoneMaskInput formate live `0612345678` → `06 12 34 56 78` |
| `@wizard-interaction` | CTA Step 1 disabled tant que !isValid, enabled quand valid |
| `@wizard-interaction` | Submit step 1 → navigate step 2 |
| `@wizard-interaction` | Bouton « Retour » step 2 a `variant="link"` (pas de bg) |
| `@wizard-resume` | Refresh à mi-step 1 → ResumeBanner affichée avec `firstName` |
| `@wizard-resume` | Click ✕ ResumeBanner → banner disparaît |
| `@wizard-tracking` | `wizard_field_filled` émis pour chaque champ valide |
| `@wizard-responsive` | Mobile 375 : cart-recap sticky top-0, pack thumb visible |
| `@wizard-responsive` | Desktop 1280 : cart-recap statique, pas de pack thumb |
| `@wizard-a11y` | 0 violation axe sérieuse/critique sur le wizard |

### 5.2 `e2e/admin-kit-wizard.spec.ts` (W5 uniquement)

| Tag | Scénario |
|---|---|
| `@wizard-admin` | Page protégée (redirect login sans session) |
| `@wizard-admin` | Charge statut Mock par défaut |
| `@wizard-admin` | Save activé après modif copy |
| `@wizard-admin` | Reset bloque tant que `RESET-WIZARD` non saisi |
| `@wizard-admin-a11y` | Axe 0 violation sur l'éditeur |

## 6. Setup spécifique

- Mock `IntersectionObserver` déjà présent (vitest.setup.ts)
- Mock custom IO qui déclenche callback à `intersectionRatio: 0.6` pour
  tests visibility et tracking
- Mock `framer-motion` `useReducedMotion → true` (pas utilisé directement
  par le wizard mais cohérent avec les autres tests)
- Mock `next/image` pour les Server Components qui utilisent Image
- Mock `next/link` (si pas déjà global)
- Mock `useTracking().emit` partout — déjà éprouvé sur les autres tests
- Mock `useFormTracking()` pour éviter le contexte tracking complet

## 7. Anti-flake gates

- E2E `@wizard-*` × **3 runs consécutifs sans flake** = gate de merge
- Tests qui utilisent timers (`ResumeBanner` autoHide, visibility timeout) :
  utilisation systématique de `vi.useFakeTimers()` + `vi.advanceTimersByTime()`
- Tests qui mockent IO : reset entre tests (`window.IntersectionObserver = original`)

## 8. Coverage CI gate

```bash
pnpm --filter web exec vitest run --coverage \
  src/lib/checkout/helpers \
  src/lib/checkout/copy \
  src/lib/checkout/state \
  src/components/checkout/wizard
```

Seuils minimum dans `vitest.config.ts` :

```ts
coverage: {
  thresholds: {
    'src/lib/checkout/helpers/**': { branches: 90, lines: 90 },
    'src/components/checkout/wizard/**': { branches: 80, lines: 85 },
  }
}
```

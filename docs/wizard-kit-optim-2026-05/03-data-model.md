# 03 — Data model

## 1. Extensions du `wizardStore` Zustand

Le store actuel (`lib/checkout/state/wizard-store.ts`) gère déjà :
- `formContext` (formId, formMode, variantKey)
- `cartSnapshot`
- `leadDraft` (firstName, phone, consent, consentVersion)
- `addressDraft` (city, addressLine1, citySlug, notes…)
- `currentStep`
- `leadId`

### 1.1 Nouveaux champs (additifs, rétro-compat)

```ts
// apps/web/src/lib/checkout/state/wizard-store.ts
export interface WizardStore {
  // ... existant

  /**
   * Timestamp ms de la première frappe (pour calcul time_since_focus_ms
   * dans wizard_field_filled). Reset au changement de step.
   */
  fieldFocusedAt: Record<string, number>;

  /**
   * Compteur de corrections par champ (frappe puis effacement complet).
   * Permet de mesurer le wizard_field_corrected.
   */
  fieldCorrections: Record<string, number>;

  /**
   * Liste des champs ayant émis wizard_field_filled — utilisé pour
   * éviter de réémettre l'event si le champ devient valide → invalide
   * → valide à nouveau dans la même session.
   */
  filledFieldsThisSession: Set<string>;

  /**
   * Timestamp ms du dernier check de visibilité du wizard (utilisé
   * pour wizard_step_abandoned avec Visibility API). Reset au focus
   * d'un champ.
   */
  lastVisibleAt: number;

  /**
   * Indique si la ResumeBanner a été montrée pour cette session
   * (one-shot — pas de réaffichage en navigation).
   */
  resumeBannerShown: boolean;

  /**
   * Indique si la ResumeBanner a été explicitement dismissed par
   * l'utilisateur (clic ✕). Cache jusqu'à la prochaine session.
   */
  resumeBannerDismissed: boolean;

  // Actions
  registerFieldFocus: (fieldName: string) => void;
  markFieldFilled: (fieldName: string, stepName: StepName) => void;
  incrementFieldCorrection: (fieldName: string) => void;
  markResumeBannerShown: () => void;
  dismissResumeBanner: () => void;
}
```

**Important** : les nouveaux champs sont **dépannés** du `persist` Zustand
sauf `filledFieldsThisSession` (qui doit reset à chaque visite) et
`resumeBannerShown` (idem). Voir §1.3.

### 1.2 Détection de correction de champ

```ts
// lib/checkout/state/field-correction-detector.ts
export function detectCorrection(
  previousValue: string,
  newValue: string,
): boolean {
  // Une correction = on avait un champ non-vide, et il devient vide
  // OU sa longueur diminue de > 50 % en 1 frappe (suggère un select-all + delete)
  if (previousValue.length === 0) return false;
  if (newValue.length === 0) return true;
  return newValue.length < previousValue.length * 0.5;
}
```

### 1.3 Persistence selective

Zustand `persist` middleware doit exclure les champs éphémères :

```ts
persist(
  (set, get) => ({ /* ... */ }),
  {
    name: 'wizard-store',
    partialize: (state) => ({
      // Persistés (resume après refresh)
      currentStep: state.currentStep,
      formContext: state.formContext,
      cartSnapshot: state.cartSnapshot,
      leadDraft: state.leadDraft,
      addressDraft: state.addressDraft,
      leadId: state.leadId,
      // NOUVEAUX persistés
      resumeBannerDismissed: state.resumeBannerDismissed,
      // NON-persistés (reset par session)
      // - fieldFocusedAt, fieldCorrections, filledFieldsThisSession,
      //   lastVisibleAt, resumeBannerShown
    }),
  },
)
```

## 2. Schemas tracking events (Zod)

```ts
// apps/web/src/lib/tracking/schemas.ts — ajout dans eventSchemas
wizard_field_filled: z.object({
  field_name: z.enum(['firstName', 'phone', 'consent', 'city', 'addressLine1', 'notes']),
  step_name: z.enum(['lead', 'address']),
  form_id: z.string().min(1).max(60),
  time_since_focus_ms: z.number().int().nonnegative(),
}).strict(),

wizard_field_corrected: z.object({
  field_name: z.enum(['firstName', 'phone', 'consent', 'city', 'addressLine1', 'notes']),
  step_name: z.enum(['lead', 'address']),
  attempts: z.number().int().positive(),
}).strict(),

wizard_step_abandoned: z.object({
  step_name: z.enum(['lead', 'address']),
  fields_completed: z.number().int().nonnegative(),
  time_in_step_ms: z.number().int().nonnegative(),
}).strict(),

wizard_resume_shown: z.object({
  step_name: z.enum(['lead', 'address']),
  time_since_last_visit_ms: z.number().int().nonnegative(),
}).strict(),

wizard_resume_dismissed: z.object({
  step_name: z.enum(['lead', 'address']),
}).strict(),
```

Ajouter aussi dans `eventCategoryByName` :

```ts
wizard_field_filled: 'engagement',
wizard_field_corrected: 'engagement',
wizard_step_abandoned: 'engagement',
wizard_resume_shown: 'engagement',
wizard_resume_dismissed: 'engagement',
```

## 3. Configuration A/B variants (latente)

Pour permettre des A/B tests futurs sur le CTA Lead sans refactor :

```ts
// apps/web/src/lib/checkout/copy/wizard-copy.ts
export interface WizardCopy {
  ctaLead: string;
  ctaAddress: string;
  noCommitmentLabel: string;
  noCommitmentSub: string;
  timeEstimateTotal: string;
  timeEstimateLead: string;
  timeEstimateAddress: string;
  timeEstimateThankYou: string;
  consentLabel: string;
  consentFootnote: string;
  resumeBannerTemplate: string;
}

export const DEFAULT_WIZARD_COPY: WizardCopy = {
  ctaLead: 'Continuer · paiement à la livraison',
  ctaAddress: 'Confirmer la commande',
  noCommitmentLabel: 'Aucun paiement maintenant',
  noCommitmentSub: 'Vous payez à la livraison, en main',
  timeEstimateTotal: '≈ 90 secondes pour confirmer',
  timeEstimateLead: '60 s',
  timeEstimateAddress: '30 s',
  timeEstimateThankYou: '5 s',
  consentLabel: 'Je veux être rappelée pour confirmer ma commande',
  consentFootnote: 'Pas de revente, pas de spam — mentions légales',
  resumeBannerTemplate: 'Bon retour, {firstName} — on reprend où vous en étiez.',
};
```

## 4. Override admin singleton (Phase W5 optionnelle)

Pattern identique à `KitPackOverride`, `KitVideoOverride` etc.

```ts
// apps/web/src/lib/kit/wizard/types.ts
export interface KitWizardOverridePatch {
  /** Copy override partiel — les champs absents reprennent DEFAULT_WIZARD_COPY. */
  copy?: Partial<WizardCopy> | null;
  /** Toggle pour activer/désactiver chaque amélioration individuellement. */
  features?: {
    cartRecap?: boolean | null;
    noCommitmentBadge?: boolean | null;
    timeEstimate?: boolean | null;
    phoneMask?: boolean | null;
    fieldCheckmark?: boolean | null;
    resumeBanner?: boolean | null;
    mobilePackThumbnail?: boolean | null;
  } | null;
}

export interface KitWizardOverride extends KitWizardOverridePatch {
  id: 'kit:wizard';
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  draftedAt: Date | null;
  createdBy: string | null;
}
```

Store + resolver + API miroir des autres singletons. Magic word :
`RESET-WIZARD`.

## 5. Helpers purs (lib/checkout/helpers/)

| Helper | Signature | Rôle |
|---|---|---|
| `formatPhoneFR(raw)` | `(raw: string) => string` | Convertit `0612345678` → `06 12 34 56 78` (live mask, idempotent) |
| `parsePhoneFR(masked)` | `(masked: string) => string` | Convertit `06 12 34 56 78` → `0612345678` |
| `detectCorrection(prev, next)` | `(prev: string, next: string) => boolean` | Détecte une correction utilisateur |
| `formatResumeBanner(template, firstName)` | `(template: string, name: string) => string` | Resolves `{firstName}` placeholder |
| `pickEstimateForStep(copy, step)` | `(copy: WizardCopy, step: StepName) => string` | Retourne `copy.timeEstimateLead`/`Address`/`ThankYou` |

Chacun testé unitairement (vitest).

## 6. Visibility API tracking

Pour `wizard_step_abandoned` :

```ts
// lib/checkout/state/use-wizard-visibility.ts
export function useWizardVisibility(opts: {
  ref: RefObject<HTMLElement>;
  onAbandon: (timeInStepMs: number) => void;
  thresholdMs?: number;
  enabled?: boolean;
}) {
  // 1. IntersectionObserver pour détecter si le wizard est dans le viewport
  // 2. Timer démarré quand wizard quitte le viewport
  // 3. Si timer > thresholdMs (default 10000) → onAbandon()
  // 4. Reset timer quand wizard revient dans le viewport
  // 5. Cleanup au unmount
}
```

## 7. Rétro-compatibilité

- Tous les nouveaux fields du store sont **optionnels** et **éphémères**
  (pas dans `persist.partialize` par défaut)
- Le `WizardShell` accepte de nouvelles props **toutes optionnelles** :
  `copy?: Partial<WizardCopy>`, `features?: WizardFeatureFlags`
- Les composants `WizardCartRecap`, `NoCommitmentBadge`, etc. ne sont
  rendus que si `cartSnapshot` (déjà existant) est présent — pas de
  régression si la prop manque
- Les events tracking sont opt-in (rien ne crash si le client tracking
  ne valide pas un schema additionnel)
- L'override admin (W5) est **optionnel** — sans lui, copy par défaut

## 8. Diagramme cascade

```
                     ┌──────────────────────────────────────┐
                     │  KitCommanderSection (Client)        │
                     │  - initialCart (SSR-fetched)         │
                     │  - copy ?= override admin           │
                     │  - features ?= override admin       │
                     └────────────────┬─────────────────────┘
                                      │
                                      ▼
                     ┌──────────────────────────────────────┐
                     │  WizardShell (Client)                │
                     │  - Zustand store (persistent partial)│
                     │  - useWizardCopy() → DEFAULT_WIZARD_COPY ⊕ override
                     │  - useWizardFeatures() → flags       │
                     └────────────────┬─────────────────────┘
                                      │
                  ┌───────────────────┼───────────────────────────┐
                  ▼                   ▼                           ▼
        ┌─────────────────┐ ┌─────────────────┐         ┌─────────────────┐
        │ WizardCartRecap │ │ TimeEstimateBg  │   …     │ ResumeBanner    │
        │ (sticky mobile) │ │ (header total)  │         │ (one-shot session)│
        └─────────────────┘ └─────────────────┘         └─────────────────┘
                  │                   │                           │
                  ▼                   ▼                           ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  WizardStepIndicator (enrichi avec time per step)           │
        └────────────────────────────┬────────────────────────────────┘
                                     │
            ┌────────────────────────┴────────────────────────┐
            ▼                                                  ▼
  ┌────────────────────┐                          ┌────────────────────┐
  │ LeadCaptureStep    │                          │ AddressStep        │
  │  - PhoneMaskInput  │                          │  - StockIndicator  │
  │  - WizardCheckmark │                          │  - CityAutocomplete│
  │  - ConsentReformul │                          │  - NoCommitmentBadge│
  │  - CTA outcome     │                          │  - CTA + Retour link│
  └────────────────────┘                          └────────────────────┘
```

# 05 — Frontend public — design

## 1. Inventaire des composants

| Composant | Type | Rôle |
|---|---|---|
| `WizardCartRecap.tsx` | Server | Bandeau récap panier permanent (sticky mobile, fixe haut desktop). 1 ligne avec thumbnail + label + prix + barré |
| `WizardCartRecap.test.tsx` | Test | 8 cas |
| `NoCommitmentBadge.tsx` | Server | Petit bloc « 🔒 Aucun paiement maintenant » sauge soft, ≤ 60 px de haut, collé au-dessus du CTA Address |
| `TimeEstimateBadge.tsx` | Server | « ≈ 90 secondes pour confirmer » sous le header WizardShell |
| `WizardStepIndicator.tsx` | (modifié) | Ajout du time per step (`60 s`, `30 s`, `5 s`) à côté du label |
| `PhoneMaskInput.tsx` | Client | TextField customisé avec formatage live `06 12 34 56 78` |
| `WizardCheckmark.tsx` | Server | ✓ sauge-dark 12 px qui apparaît à droite du label quand le champ est valide |
| `ResumeBanner.tsx` | Client | « Bon retour, {firstName} » + ✕ dismiss + fade-out auto 5s, 1 fois par session |
| `WizardMobilePackThumb.tsx` | Server | Photo pack 64×80 dans le header `KitCommanderSection` mobile only |
| `useWizardCopy.ts` | Hook Client | Lit `WizardCopy` depuis context ou défaut (futur override admin) |
| `useWizardFeatures.ts` | Hook Client | Flags features on/off (utile pour W5 admin) |
| `useWizardVisibility.ts` | Hook Client | Détection abandon via IntersectionObserver + timeout 10s |
| `useFieldCorrectionTracker.ts` | Hook Client | Suit les corrections par champ → émet `wizard_field_corrected` |

## 2. WizardCartRecap

### 2.1 Maquette schématique

**Mobile (< sm)** — sticky `top-0` :

```
┌─────────────────────────────────────────────────────┐
│ ▢   Pack FemiGlow                  199 MAD  ~~390~~ │
└─────────────────────────────────────────────────────┘
```

**Desktop (≥ sm)** — statique haut du wizard, 2 lignes :

```
┌─────────────────────────────────────────────────────────────┐
│ ▢   Pack FemiGlow                          199 MAD         │
│     Paste · Powder · Polissoir · livraison incluse  ~~390 MAD~~ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Code

```tsx
import 'server-only';
import Image from 'next/image';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';

export interface WizardCartRecapProps {
  cart: CartSnapshot;
  /** Image packshot — réutilise media `kit-pack-visual/primary`. */
  thumbnailSrc?: string;
  /** Optionnel — prix barré pour cohérence avec la section pack. */
  priceCompareAt?: string;
}

export function WizardCartRecap({
  cart,
  thumbnailSrc = '/products/kit-principale.svg',
  priceCompareAt,
}: WizardCartRecapProps) {
  if (!cart || !cart.items || cart.items.length === 0) return null;
  const totalLabel = `${(cart.totalCents / 100).toFixed(0)} ${cart.currency}`;
  const productLabel = cart.items.map((i) => i.name).join(' + ');

  return (
    <aside
      role="region"
      aria-label="Récapitulatif de votre commande"
      data-testid="wizard-cart-recap"
      className="sticky top-0 z-30 -mx-6 mb-6 flex items-center gap-3 border-b border-encre/10 bg-creme/95 px-6 py-3 backdrop-blur sm:static sm:rounded sm:border sm:py-4"
    >
      <Image
        src={thumbnailSrc}
        alt=""
        width={48}
        height={60}
        className="h-12 w-10 shrink-0 rounded object-cover"
      />
      <div className="flex flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-encre">
            {cart.items.length} × Pack FemiGlow
          </p>
          <p className="hidden text-xs text-encre/60 sm:block">
            {productLabel} · livraison incluse
          </p>
        </div>
        <p className="flex items-baseline gap-2 text-sm">
          <span className="font-medium tabular-nums text-encre">
            {totalLabel}
          </span>
          {priceCompareAt && (
            <span
              className="text-xs text-encre/40 line-through"
              data-testid="wizard-cart-recap-barre"
            >
              {priceCompareAt}
            </span>
          )}
        </p>
      </div>
    </aside>
  );
}
```

## 3. NoCommitmentBadge

```tsx
// Server Component pur, affiché juste au-dessus du CTA Address.
export function NoCommitmentBadge({
  label = 'Aucun paiement maintenant',
  sub = 'Vous payez à la livraison, en main',
}: { label?: string; sub?: string }) {
  return (
    <section
      role="note"
      aria-label="Garantie sans engagement"
      data-testid="wizard-no-commitment-badge"
      className="flex items-start gap-3 rounded border border-sauge-dark/25 bg-sauge-soft/40 p-3"
    >
      <svg
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-sauge-dark"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="11" width="14" height="9" rx="1.5" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-encre">{label}</p>
        <p className="text-xs italic text-encre/65">{sub}</p>
      </div>
    </section>
  );
}
```

## 4. TimeEstimateBadge + WizardStepIndicator enrichi

### 4.1 TimeEstimateBadge

```tsx
// Server Component pur, sous le header WizardShell.
export function TimeEstimateBadge({ label }: { label: string }) {
  return (
    <p
      data-testid="wizard-time-estimate"
      className="text-center text-xs italic text-encre/60"
    >
      {label}
    </p>
  );
}
```

### 4.2 WizardStepIndicator (enrichi)

```diff
 <span className={cn('text-sm leading-tight', state === 'current' && 'font-medium')}>
   {label}
+  {timeEstimate && (
+    <span className="ml-1 text-[10px] text-encre/45 tabular-nums">
+      · {timeEstimate}
+    </span>
+  )}
 </span>
```

Nouvelle prop `timesPerStep?: Record<StepName, string>` pour passer les
durées depuis `WizardCopy`.

## 5. PhoneMaskInput

```tsx
'use client';

import { forwardRef, useState, type ChangeEvent } from 'react';
import { TextField, type TextFieldProps } from '@/components/forms/Field';
import { formatPhoneFR } from '@/lib/checkout/helpers/phone-mask';

export const PhoneMaskInput = forwardRef<HTMLInputElement, TextFieldProps>(
  function PhoneMaskInput({ onChange, value, ...rest }, ref) {
    const [displayValue, setDisplayValue] = useState(() =>
      typeof value === 'string' ? formatPhoneFR(value) : '',
    );

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '');
      const masked = formatPhoneFR(raw);
      setDisplayValue(masked);
      // Renvoie la valeur RAW au form (pas la masquée) — Zod transform
      // continuera à fonctionner sans modif.
      e.target.value = raw;
      onChange?.(e);
    };

    return (
      <TextField
        ref={ref}
        {...rest}
        value={displayValue}
        onChange={handleChange}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
      />
    );
  },
);
```

### 5.1 `formatPhoneFR` helper

```ts
// lib/checkout/helpers/phone-mask.ts
export function formatPhoneFR(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  // Format : XX XX XX XX XX (5 paires)
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}
```

## 6. WizardCheckmark

```tsx
// Server Component pur — affiché à droite du label TextField.
export function WizardCheckmark({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span
      aria-hidden="true"
      className="ml-2 inline-block text-xs text-sauge-dark motion-safe:animate-fade-in"
      data-testid="wizard-checkmark"
    >
      ✓
    </span>
  );
}
```

Keyframe `fade-in` à ajouter dans tailwind.config :

```ts
keyframes: {
  'fade-in': {
    '0%': { opacity: '0', transform: 'translateY(2px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
},
animation: {
  'fade-in': 'fade-in 0.2s ease-out',
},
```

## 7. ResumeBanner

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

import { useTracking } from '@/lib/tracking/use-tracking';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';

export interface ResumeBannerProps {
  firstName: string;
  template?: string;
  /** Auto-hide après ms (0 = pas d'auto-hide). */
  autoHideMs?: number;
}

export function ResumeBanner({
  firstName,
  template = 'Bon retour, {firstName} — on reprend où vous en étiez.',
  autoHideMs = 5000,
}: ResumeBannerProps) {
  const { emit } = useTracking();
  const [visible, setVisible] = useState(true);
  const fired = useRef(false);
  const currentStep = useWizardStore((s) => s.currentStep);
  const markShown = useWizardStore((s) => s.markResumeBannerShown);
  const dismiss = useWizardStore((s) => s.dismissResumeBanner);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    emit('wizard_resume_shown', {
      step_name: currentStep,
      time_since_last_visit_ms: 0, // TODO: compute from lastVisitedAt
    });
    markShown();
    if (autoHideMs > 0) {
      const t = setTimeout(() => setVisible(false), autoHideMs);
      return () => clearTimeout(t);
    }
  }, [emit, currentStep, markShown, autoHideMs]);

  const onDismiss = () => {
    emit('wizard_resume_dismissed', { step_name: currentStep });
    dismiss();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="wizard-resume-banner"
      className="flex items-center justify-between gap-3 rounded border border-champagne-dark/25 bg-champagne-soft/40 px-3 py-2 text-sm text-encre"
    >
      <span>
        {template.replace('{firstName}', firstName)}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer la bannière"
        data-testid="wizard-resume-dismiss"
        className="-mr-1 ml-2 h-6 w-6 rounded text-encre/50 hover:text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-encre/40"
      >
        ✕
      </button>
    </div>
  );
}
```

## 8. WizardMobilePackThumb

```tsx
// Server Component — affiché uniquement < lg dans KitCommanderSection header.
import Image from 'next/image';

export function WizardMobilePackThumb({
  src = '/products/kit-principale.svg',
  alt = 'Pack FemiGlow',
}: { src?: string; alt?: string }) {
  return (
    <div
      data-testid="wizard-mobile-pack-thumb"
      className="block shrink-0 lg:hidden"
    >
      <Image src={src} alt={alt} width={64} height={80} className="rounded" />
    </div>
  );
}
```

Intégration dans `KitCommanderSection` :

```diff
- <header className="mb-10 max-w-2xl space-y-3">
+ <header className="mb-10 flex max-w-2xl gap-4">
+   <WizardMobilePackThumb />
+   <div className="space-y-3">
    <Text size="small" tone="secondary" className="uppercase tracking-[0.18em]">
      {kicker}
    </Text>
    {/* ... */}
+   </div>
- </header>
+ </header>
```

## 9. Refonte LeadCaptureStep — diff conceptuel

```diff
 export function LeadCaptureStep({ cta, title }: LeadCaptureStepProps) {
+  const { copy, features } = useWizardCopy();
+  const leadDraftFirstName = useWizardStore((s) => s.leadDraft.firstName);
+  const resumeBannerDismissed = useWizardStore((s) => s.resumeBannerDismissed);
+
   const { register, handleSubmit, watch, setError, formState: { errors, isValid } } = useForm({...});
+
+  const phoneValid = !errors.phone && watchedPhone && watchedPhone.length >= 9;
+  const firstNameValid = !errors.firstName && watchedFirstName && watchedFirstName.length >= 2;
+
   return (
     <section ...>
+      {leadDraftFirstName && !resumeBannerDismissed && features.resumeBanner && (
+        <ResumeBanner firstName={leadDraftFirstName} template={copy.resumeBannerTemplate} />
+      )}
+
       <header className="space-y-2">
-        <Heading as="h2" size="md" italic="always">{heading}</Heading>
+        <Heading as="h2" size="md" italic="always">
+          {heading}
+          <WizardCheckmark visible={firstNameValid && phoneValid && watchedConsent === true} />
+        </Heading>
         <Text size="small" tone="secondary">Deux informations seulement…</Text>
       </header>
       <form onSubmit={onSubmit} noValidate className="space-y-7">
         <div className="grid gap-6 sm:grid-cols-2">
           <TextField
-            label="Votre prénom"
+            label={<>Votre prénom <WizardCheckmark visible={firstNameValid} /></>}
             ...
           />
-          <TextField
+          <PhoneMaskInput
-            label="Téléphone"
+            label={<>Téléphone <WizardCheckmark visible={phoneValid} /></>}
             ...
           />
         </div>

         <div className="space-y-3">
           <label className="flex items-start gap-3 text-sm text-encre">
             <input type="checkbox" ... />
             <span>
-              J&rsquo;accepte d&rsquo;être contactée par la maison FemiGlow pour ma commande.
-              Voir nos <Link ...>mentions légales</Link>.
+              {copy.consentLabel}
+              <br />
+              <span className="text-xs text-encre/55">
+                {copy.consentFootnote.replace('mentions légales', '')}
+                <Link ...>mentions légales</Link>
+              </span>
             </span>
           </label>
         </div>
         ...
         <Button ... fullWidth>
-          {ctaLabel}
+          {copy.ctaLead /* « Continuer · paiement à la livraison » */}
         </Button>
       </form>
     </section>
   );
 }
```

## 10. Refonte AddressStep — diff conceptuel

```diff
 export function AddressStep({ cta }: AddressStepProps) {
+  const { copy, features } = useWizardCopy();
   ...
   return (
     <section ...>
       <header ...>...</header>
       {primaryVariantId && <StockIndicator ... />}
       <form onSubmit={onSubmit} ...>
         <Controller ... />  {/* CityAutocomplete */}
         <TextField {...register('addressLine1')} ... />
         <ShippingNotice ... />
         <TextAreaField {...register('notes')} ... />
         {networkBanner && <div role="alert">...</div>}

+        {features.noCommitmentBadge && (
+          <NoCommitmentBadge
+            label={copy.noCommitmentLabel}
+            sub={copy.noCommitmentSub}
+          />
+        )}

         <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
-          <Button variant="secondary" size="md" onClick={() => goToStep('lead')}>
+          <Button variant="link" size="md" onClick={() => goToStep('lead')}>
             {t.common.back}
           </Button>
           <Button type="submit" variant="primary" size="lg" ...>
             {cta ?? copy.ctaAddress}
           </Button>
         </div>
       </form>
     </section>
   );
 }
```

## 11. Refonte WizardShell — intégration globale

```diff
 export function WizardShell({ formContext, steps, initialCart, copy, ... }) {
+  const wizardCopy = useWizardCopy({ overrides: copy });
+  const features = useWizardFeatures();
   ...
   return (
     <div className="space-y-8" data-testid="wizard-shell">
       {header}
+      {initialCart && features.cartRecap && (
+        <WizardCartRecap cart={initialCart} priceCompareAt="390 MAD" />
+      )}
+      {features.timeEstimate && (
+        <TimeEstimateBadge label={wizardCopy.timeEstimateTotal} />
+      )}
-      <WizardStepIndicator steps={steps} currentStep={currentStep} />
+      <WizardStepIndicator
+        steps={steps}
+        currentStep={currentStep}
+        timesPerStep={features.timeEstimate ? {
+          lead: wizardCopy.timeEstimateLead,
+          address: wizardCopy.timeEstimateAddress,
+          thank_you: wizardCopy.timeEstimateThankYou,
+        } : undefined}
+      />
       <Suspense ...>{stepView}</Suspense>
       {footer}
     </div>
   );
 }
```

## 12. Responsive comportements

| Breakpoint | WizardCartRecap | TimeEstimateBadge | StepIndicator | NoCommitmentBadge | MobilePackThumb |
|---|---|---|---|---|---|
| < 640 (mobile) | sticky `top-0` z-30 | visible centré | 01/02/03 + time | visible | visible (64×80) |
| ≥ 640 < 1024 | statique haut wizard | visible | + time labels | visible | masqué |
| ≥ 1024 (desktop) | statique 2 lignes | visible | + time labels | visible | masqué |

## 13. Conventions FemiGlow (rappel)

- Apostrophe `'` U+2019 dans toute la copy
- `motion-safe:` désactive auto si `prefers-reduced-motion`
- Color literal `bg-[#C28A6E]/X` si opacity sur var CSS (cf. workaround `bg-encre/X`)
- Pas de mention nominale fondatrice
- Pas de cliché orientaliste
- Charte palette respectée (sauge / champagne / pétale soft + dark)
- Apostrophes U+2019 partout
- Tabular-nums sur les prix et durées

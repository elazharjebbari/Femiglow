# Architecture Frontend — Composants, état, i18n, routing

> Spec exhaustive du front : arbre composants, state management, routes,
> i18n RTL, error boundaries, perf, bundle splitting.

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Arborescence des fichiers](#2-arborescence-des-fichiers)
3. [Component tree](#3-component-tree)
4. [State management](#4-state-management)
5. [Routing & navigation](#5-routing--navigation)
6. [i18n FR/AR & RTL](#6-i18n-frar--rtl)
7. [Error boundaries & fallbacks](#7-error-boundaries--fallbacks)
8. [Bundle splitting & lazy loading](#8-bundle-splitting--lazy-loading)
9. [Form handling pattern](#9-form-handling-pattern)
10. [Hooks réutilisables](#10-hooks-réutilisables)
11. [Side-effects & analytics](#11-side-effects--analytics)
12. [Performance budgets](#12-performance-budgets)

---

## 1. Vue d'ensemble

**Stack** :
- Next.js 14 App Router (RSC où possible, Client Components pour le wizard)
- React 18.3
- TypeScript 5.4 strict
- Tailwind 3.4 + shadcn/ui (existant)
- Zustand 5 + persist middleware
- React Hook Form 7 + Zod resolvers
- @dnd-kit/sortable (admin form editor)
- React Aria (combobox a11y, focus trap)
- next-intl 3 (i18n)
- @lottiefiles/dotlottie-react (animation thank-you)
- Fuse.js (autocomplete villes)

**Principes** :
- Wizard = Client Component obligatoire (state, animations)
- Tout ce qui n'est pas interactif → RSC par défaut
- Pas de useEffect pour fetch — utiliser server actions ou route handlers
- Pas de prop drilling > 2 niveaux → Zustand store ou Context si très local

---

## 2. Arborescence des fichiers

```
apps/web/src/
├── app/
│   ├── [locale]/
│   │   ├── commander/
│   │   │   ├── page.tsx                      # MODE B entry — wrappe CheckoutFlow
│   │   │   └── loading.tsx
│   │   ├── kit/
│   │   │   ├── page.tsx                      # MODE A entry — embed wizard
│   │   │   └── loading.tsx
│   │   └── merci/
│   │       └── [orderId]/
│   │           ├── page.tsx                  # Thank-you SSR + Lottie client
│   │           └── loading.tsx
│   ├── admin/
│   │   ├── checkout/
│   │   │   └── forms/
│   │   │       ├── page.tsx                  # Liste form configs
│   │   │       ├── new/
│   │   │       │   └── page.tsx              # Création
│   │   │       └── [id]/
│   │   │           └── page.tsx              # Éditeur 5 tabs
│   │   └── preview/
│   │       └── checkout/
│   │           └── page.tsx                  # Iframe preview wizard
│   └── api/
│       ├── checkout/
│       │   ├── lead/
│       │   │   ├── route.ts                  # POST
│       │   │   └── [leadId]/
│       │   │       ├── route.ts              # PATCH
│       │   │       └── finalize/
│       │   │           └── route.ts          # POST
│       │   └── form-config/
│       │       └── active/
│       │           └── route.ts              # GET cached
│       └── admin/
│           └── form-config/
│               ├── route.ts                  # GET list, POST create
│               └── [id]/
│                   ├── route.ts              # GET, PUT
│                   ├── publish/route.ts
│                   ├── archive/route.ts
│                   ├── rollback/route.ts
│                   └── history/
│                       ├── route.ts
│                       └── [version]/route.ts
│
├── components/
│   ├── commerce/
│   │   ├── CheckoutFlow.tsx                  # Wrapper variant-aware (legacy|wizard)
│   │   ├── CheckoutFlow.legacy.tsx           # Ancien flow (rename de l'actuel)
│   │   ├── AddToCartButton.tsx               # (existant, modifié)
│   │   ├── CartContents.tsx                  # (existant)
│   │   ├── wizard/
│   │   │   ├── Wizard.tsx                    # Orchestrateur principal
│   │   │   ├── WizardLayout.tsx
│   │   │   ├── WizardProgress.tsx
│   │   │   ├── WizardHeader.tsx
│   │   │   ├── WizardFooter.tsx
│   │   │   ├── ThankYou.tsx
│   │   │   ├── ThankYouEmailOptIn.tsx       # Email opt-in optionnel sur Thank-You
│   │   │   ├── StockIndicator.tsx           # RSC stock card sur Step 2
│   │   │   ├── StockIndicator/
│   │   │   │   └── LowStockPulse.tsx        # Client child, micro-animation pulse
│   │   │   ├── ConsentDisclaimer.tsx        # Micro-copy sous CTA Step 3 (pas de checkbox)
│   │   │   ├── steps/
│   │   │   │   ├── Step1Lead.tsx
│   │   │   │   ├── Step2Address.tsx
│   │   │   │   ├── Step3Payment.tsx
│   │   │   │   └── index.ts
│   │   │   ├── fields/
│   │   │   │   ├── WizardField.tsx
│   │   │   │   ├── WizardCombobox.tsx
│   │   │   │   ├── WizardRadioGroup.tsx
│   │   │   │   ├── WizardCheckbox.tsx
│   │   │   │   ├── PhoneInput.tsx            # Composant spécialisé +212
│   │   │   │   └── index.ts
│   │   │   ├── state/
│   │   │   │   ├── wizard-store.ts           # Zustand
│   │   │   │   ├── wizard-machine.ts         # FSM (XState-light ou plain reducer)
│   │   │   │   └── types.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useWizardFlow.ts
│   │   │   │   ├── useLeadAutosave.ts
│   │   │   │   ├── useDebouncedCallback.ts
│   │   │   │   └── useWizardAnalytics.ts
│   │   │   └── utils/
│   │   │       ├── applyVariantOverrides.ts
│   │   │       ├── validateFormConfig.ts
│   │   │       └── normalizePhoneInput.ts
│   │   └── kit/
│   │       ├── EmbedWizard.tsx               # Wrapper /kit (drawer mobile, sidebar desktop)
│   │       └── KitCTA.tsx                    # Bouton "Commander en 30s"
│   ├── admin/
│   │   └── forms/
│   │       ├── FormConfigList.tsx
│   │       ├── FormConfigEditor.tsx
│   │       ├── FormConfigEditorTabs/
│   │       │   ├── FieldsTab.tsx
│   │       │   ├── LogicTab.tsx
│   │       │   ├── VariantsTab.tsx
│   │       │   ├── PreviewTab.tsx
│   │       │   └── HistoryTab.tsx
│   │       ├── SortableFieldList.tsx
│   │       └── DiffViewer.tsx
│   └── ui/                                    # shadcn (existant)
│
├── lib/
│   ├── checkout/
│   │   ├── form-config/
│   │   │   ├── types.ts
│   │   │   ├── schema.ts                     # Zod
│   │   │   ├── default.ts                    # Fallback config
│   │   │   ├── apply-overrides.ts
│   │   │   └── variant-assignment.ts
│   │   ├── schemas/
│   │   │   ├── lead.ts
│   │   │   └── index.ts
│   │   ├── repos/
│   │   │   ├── lead.ts
│   │   │   ├── form-config.ts
│   │   │   ├── variant-assignment.ts
│   │   │   └── idempotency.ts
│   │   └── actions/
│   │       ├── create-lead.ts                # 'use server'
│   │       ├── patch-lead.ts
│   │       ├── finalize-lead.ts
│   │       ├── publish-form-config.ts
│   │       └── rollback-form-config.ts
│   ├── geo/
│   │   ├── morocco-cities.ts                 # Dataset statique
│   │   ├── morocco-cities.json               # Source
│   │   └── city-search.ts                    # Fuse.js wrapper
│   ├── tracking/
│   │   └── gtm/
│   │       └── builders.ts                   # (étendu)
│   └── i18n/
│       └── checkout.ts                       # Type helpers messages
│
└── messages/
    ├── fr/
    │   └── checkout.json
    └── ar/
        └── checkout.json
```

---

## 3. Component tree

### 3.1 Page `/[locale]/commander`

```tsx
// apps/web/src/app/[locale]/commander/page.tsx (Server Component)

export default async function CommanderPage({ params }: { params: { locale: 'fr' | 'ar' } }) {
  const formConfig = await fetchActiveFormConfig('checkout_wizard');
  const t = await getTranslations({ locale: params.locale, namespace: 'checkout' });

  return (
    <main className="min-h-screen bg-background py-12">
      <ErrorBoundary fallback={<CheckoutErrorFallback />}>
        <CheckoutFlow
          mode="cart"
          formConfig={formConfig}
          locale={params.locale}
        />
      </ErrorBoundary>
    </main>
  );
}
```

### 3.2 Component tree visualisé

```
<CheckoutFlow mode>                      Client Component (wrapper variant-aware)
└── variant === 'legacy'
    └── <CheckoutFlow.legacy />          (ancien flow, intact)
└── variant === 'wizard'
    └── <Wizard mode={cart|embed}>      Client Component principal
        ├── <WizardHeader />
        │   ├── <Logo />
        │   ├── <BackButton />
        │   ├── <ProgressIndicator />
        │   └── <LocaleToggle />
        │
        ├── <WizardProgress steps={[]} active={} />
        │
        ├── <main>
        │   ├── currentStep === 'lead'    → <Step1Lead />
        │   │                                ├── <WizardField label firstName>
        │   │                                │   └── <Input />
        │   │                                ├── <WizardField label phone>
        │   │                                │   └── <PhoneInput />
        │   │                                ├── <WizardField label email optional>
        │   │                                │   └── <Input />
        │   │                                └── <WizardButton primary>
        │   ├── currentStep === 'address' → <Step2Address />
        │   │                                ├── <StockIndicator productId={kit.productId} />  (RSC, premium card)
        │   │                                ├── <WizardCombobox cityCombo />
        │   │                                ├── <WizardField address>
        │   │                                ├── <WizardField postal optional>
        │   │                                ├── <WizardField landmark optional>
        │   │                                └── <WizardButton primary>
        │   └── currentStep === 'payment' → <Step3Payment />
        │                                    ├── <WizardRadioGroup payment>
        │                                    ├── <CartSummary />
        │                                    ├── <PromoCodeInput />
        │                                    ├── <WizardButton primary>
        │                                    └── <ConsentDisclaimer />  (micro-copy sous CTA, pas de checkbox)
        │
        ├── <WizardFooter />              (mobile only)
        │
        └── <Toast.Container />          react-hot-toast or shadcn sonner
```

### 3.3 Page `/[locale]/kit` (Mode A)

```tsx
// apps/web/src/app/[locale]/kit/page.tsx (mostly Server Component)

export default async function KitPage({ params, searchParams }) {
  const product = await fetchKitProduct();
  const formConfig = await fetchActiveFormConfig('checkout_wizard');
  const isEmbedMode = process.env.NEXT_PUBLIC_KIT_EMBED === '1';
  const isMobile = ...; // headers based detection (hint)

  return (
    <main>
      <ProductHero product={product} />        {/* RSC */}
      <ProductGallery images={product.images} /> {/* RSC */}

      {/* Mode A embed */}
      {isEmbedMode ? (
        <EmbedWizard
          formConfig={formConfig}
          product={product}
          locale={params.locale}
        />
      ) : (
        <ProductCTA product={product} />        // legacy "Ajouter au panier"
      )}

      <ProductDescription />                    {/* RSC */}
      <ProductReviews />                        {/* RSC */}
      <ProductFAQ />                            {/* RSC */}
    </main>
  );
}
```

### 3.4 `<EmbedWizard>` (Mode A wrapper)

```tsx
'use client';

export function EmbedWizard({ formConfig, product, locale }) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  // Pré-remplit le panier au mount (silent)
  useEffect(() => {
    useCartStore.getState().prefillIfEmpty([{ productId: product.id, qty: 1 }]);
  }, [product.id]);

  if (isMobile) {
    return (
      <>
        <KitCTA onClick={() => setIsOpen(true)} sticky />
        <Drawer open={isOpen} onClose={() => setIsOpen(false)}>
          <Wizard mode="embed" formConfig={formConfig} locale={locale} onClose={() => setIsOpen(false)} />
        </Drawer>
      </>
    );
  }

  // Desktop: sidebar sticky
  return (
    <aside className="sticky top-24 w-[560px]">
      <Wizard mode="embed" formConfig={formConfig} locale={locale} />
    </aside>
  );
}
```

---

## 4. State management

### 4.1 Zustand store

```ts
// apps/web/src/components/commerce/wizard/state/wizard-store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WizardStep = 'lead' | 'address' | 'payment' | 'thank_you';
export type FormMode = 'wizard_embed' | 'wizard_cart';

type WizardState = {
  // Identity
  leadId: string | null;
  variantKey: string | null;
  formConfigId: string | null;
  formMode: FormMode | null;

  // Step state
  currentStep: WizardStep;
  completedSteps: WizardStep[];

  // Field values (snapshot — la SoT reste côté serveur)
  values: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: {
      line1?: string;
      cityId?: string;
      cityName?: string;
      cityNameAr?: string;
      postalCode?: string;
      landmark?: string;
    };
    paymentMethod?: 'cod' | 'bank';
    promoCode?: string;
    // consent: implicit at finalize (no checkbox) — consented_at timestamp set server-side
  };

  // Errors
  fieldErrors: Record<string, string | undefined>;

  // Loading
  pending: {
    createLead: boolean;
    patchAddress: boolean;
    finalize: boolean;
  };

  // Actions
  setValue: <K extends keyof WizardState['values']>(key: K, value: WizardState['values'][K]) => void;
  setLeadId: (id: string) => void;
  setVariant: (key: string, configId: string) => void;
  setCurrentStep: (step: WizardStep) => void;
  markStepCompleted: (step: WizardStep) => void;
  setFieldError: (field: string, message: string | undefined) => void;
  setPending: (key: keyof WizardState['pending'], value: boolean) => void;
  reset: () => void;
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      leadId: null,
      variantKey: null,
      formConfigId: null,
      formMode: null,
      currentStep: 'lead',
      completedSteps: [],
      values: {},
      fieldErrors: {},
      pending: { createLead: false, patchAddress: false, finalize: false },

      setValue: (key, value) => set(s => ({ values: { ...s.values, [key]: value } })),
      setLeadId: (id) => set({ leadId: id }),
      setVariant: (key, configId) => set({ variantKey: key, formConfigId: configId }),
      setCurrentStep: (step) => set({ currentStep: step }),
      markStepCompleted: (step) => set(s => ({
        completedSteps: s.completedSteps.includes(step) ? s.completedSteps : [...s.completedSteps, step]
      })),
      setFieldError: (field, message) => set(s => ({
        fieldErrors: { ...s.fieldErrors, [field]: message }
      })),
      setPending: (key, value) => set(s => ({ pending: { ...s.pending, [key]: value } })),
      reset: () => set({
        leadId: null, variantKey: null, formConfigId: null, formMode: null,
        currentStep: 'lead', completedSteps: [], values: {}, fieldErrors: {},
        pending: { createLead: false, patchAddress: false, finalize: false },
      }),
    }),
    {
      name: 'femiglow-wizard-v1',
      partialize: (s) => ({
        // Ne persiste pas tout : pas de pending, pas de fieldErrors
        leadId: s.leadId,
        variantKey: s.variantKey,
        formConfigId: s.formConfigId,
        formMode: s.formMode,
        currentStep: s.currentStep,
        completedSteps: s.completedSteps,
        values: s.values,
      }),
      version: 1,
      migrate: (persistedState, version) => {
        // Future: migrate v1 → v2 si breaking
        return persistedState;
      },
    }
  )
);
```

### 4.2 FSM transitions

```ts
// apps/web/src/components/commerce/wizard/state/wizard-machine.ts

export type WizardEvent =
  | { type: 'STEP1_SUBMITTED'; leadId: string }
  | { type: 'STEP2_SUBMITTED' }
  | { type: 'STEP3_SUBMITTED'; orderId: string }
  | { type: 'GO_BACK' }
  | { type: 'JUMP_TO'; step: WizardStep }
  | { type: 'RESET' };

export const transitions: Record<WizardStep, Partial<Record<WizardEvent['type'], WizardStep>>> = {
  lead: {
    STEP1_SUBMITTED: 'address',
  },
  address: {
    STEP2_SUBMITTED: 'payment',
    GO_BACK: 'lead',
  },
  payment: {
    STEP3_SUBMITTED: 'thank_you',
    GO_BACK: 'address',
  },
  thank_you: {
    RESET: 'lead',
  },
};

export function nextStep(current: WizardStep, event: WizardEvent['type']): WizardStep | null {
  return transitions[current]?.[event] ?? null;
}
```

### 4.3 Cart store (existant)

`apps/web/src/lib/stores/cart-store.ts` reste tel quel (`name: 'femiglow-cart'`).

Le wizard lit le cart via :
```ts
const items = useCartStore(s => s.items);
const subtotal = useCartStore(s => s.subtotal);
```

### 4.4 Synchronisation cart ↔ wizard

- Mode A (embed) : à l'ouverture du drawer, on injecte `[1× kit]` dans `cartStore`
- Mode B (cart) : on lit `cartStore` tel quel
- Finalize : `cartItems` envoyés via cartStore → serveur valide → success → `cartStore.clear()`

---

## 5. Routing & navigation

### 5.1 Routes publiques

| URL | Mode | Comportement |
|---|---|---|
| `/[locale]/kit` | A (si flag) | PDP + wizard embed (drawer mobile, sidebar desktop) |
| `/[locale]/commander` | B | Wizard standalone |
| `/[locale]/merci/[orderId]` | n/a | Thank-you SSR + Lottie client |
| `/[locale]/panier` | n/a | Cart contents (peut router vers `/commander`) |

### 5.2 Navigation interne wizard

- Pas de changement d'URL entre les steps (single page, state-driven)
- Pas de hash routing (perte de scroll position au reload)
- `pushState` éventuel pour back button : `history.pushState(null, '', '#step-2')` mais évite si possible

### 5.3 Back button OS

```ts
// useWizardFlow.ts
useEffect(() => {
  const handlePopState = () => {
    if (currentStep !== 'lead') {
      goBack();
    } else {
      // confirm leave
    }
  };
  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}, [currentStep]);
```

### 5.4 Routes admin

| URL | Auth | Comportement |
|---|---|---|
| `/admin/checkout/forms` | requireAdmin | List configs |
| `/admin/checkout/forms/[id]` | requireAdmin | Editeur 5 tabs |
| `/admin/preview/checkout?config=&variant=&locale=` | requireAdmin | Iframe preview |

---

## 6. i18n FR/AR & RTL

### 6.1 Next-intl setup

Déjà configuré dans `apps/web/src/i18n/`. Le wizard ajoute :

```ts
// apps/web/messages/fr/checkout.json (cf. 06 §16 pour copy complet)
```

### 6.2 Usage dans composants

```tsx
'use client';
import { useTranslations } from 'next-intl';

export function Step1Lead() {
  const t = useTranslations('checkout.wizard.step1');

  return (
    <div>
      <h2>{t('title')}</h2>
      <p>{t('subtitle')}</p>
      <WizardField label={t('fields.firstName.label')} />
      {/* ... */}
    </div>
  );
}
```

### 6.3 RTL côté layout

```tsx
// apps/web/src/app/[locale]/layout.tsx
export default function LocaleLayout({ children, params }: { children, params: { locale: 'fr' | 'ar' } }) {
  const dir = params.locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <html lang={params.locale} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
```

### 6.4 RTL côté composants

- Utiliser logical properties Tailwind (`ms-`, `me-`, `ps-`, `pe-`, etc.)
- Pour les icônes directionnelles (→, ←) :
  ```tsx
  <ArrowRight className="rtl:rotate-180" />
  ```
- Phone prefix `+212` : isoler avec `<bdi>`
  ```tsx
  <bdi className="font-mono">+212</bdi>
  ```

### 6.5 City search ASCII-tolerant

```ts
// apps/web/src/lib/geo/city-search.ts

import Fuse from 'fuse.js';

export const cityFuse = new Fuse(MOROCCO_CITIES, {
  keys: ['name', 'name_ar', 'name_normalized', 'name_ar_normalized', 'aliases'],
  threshold: 0.3,
  includeScore: true,
  shouldSort: true,
  ignoreLocation: true,
  ignoreFieldNorm: true,
});

export function searchCity(query: string, locale: 'fr' | 'ar'): MoroccoCity[] {
  const normalized = normalizeForSearch(query, locale);
  return cityFuse.search(normalized).slice(0, 7).map(r => r.item);
}

function normalizeForSearch(text: string, locale: 'fr' | 'ar'): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[ëèé]/g, 'e')
    .replace(/[àâä]/g, 'a')
    .replace(/[ôö]/g, 'o')
    .replace(/[ûü]/g, 'u')
    .trim();
}
```

---

## 7. Error boundaries & fallbacks

### 7.1 Boundary hierarchy

```
<RootErrorBoundary>                   page-wide fallback (Sentry capture)
  <CheckoutFlow>
    <WizardErrorBoundary>             wizard-specific fallback
      <Wizard>
        <Step1Lead />
        ...
      </Wizard>
    </WizardErrorBoundary>
  </CheckoutFlow>
</RootErrorBoundary>
```

### 7.2 Wizard error fallback

```tsx
// apps/web/src/components/commerce/wizard/WizardErrorFallback.tsx

export function WizardErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { component: 'Wizard' } });
  }, [error]);

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <h3 className="text-lg font-semibold">Une erreur est survenue</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Nous sommes désolés. Vos données saisies sont sauvegardées.
      </p>
      <div className="mt-4 flex gap-2">
        <button onClick={reset} className="btn-primary">Réessayer</button>
        <a href="/contact" className="btn-secondary">Nous contacter</a>
      </div>
    </div>
  );
}
```

### 7.3 Network error UX

- Premier fail : retry silent (×3 exponentiel)
- Après 3 fails : toast `Erreur réseau, vérifiez votre connexion` + button "Réessayer manuellement"
- Si lead pas encore créé : ne pas bloquer, queue dans localStorage et retry au reload

### 7.4 Validation error UX

- Server side 422 → mappé vers `fieldErrors` du store via réponse `{ errors: [{ field, message }] }`
- Focus auto sur premier field invalide

---

## 8. Bundle splitting & lazy loading

### 8.1 Code splitting strategy

```tsx
// Wizard est lazy-loaded sur /commander
const Wizard = dynamic(() => import('@/components/commerce/wizard/Wizard'), {
  loading: () => <WizardSkeleton />,
  ssr: false,  // Wizard a besoin de localStorage
});

// Lottie lazy
const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then(m => m.DotLottieReact),
  { ssr: false, loading: () => <CheckmarkFallback /> }
);

// Dataset villes (80 KB) lazy au focus du combobox
const useCityDataset = () => {
  return useQuery(['morocco-cities'], () =>
    import('@/lib/geo/morocco-cities').then(m => m.MOROCCO_CITIES)
  );
};
```

### 8.2 Bundle budgets

| Route | Initial JS | Wizard chunk | Lottie chunk |
|---|---|---|---|
| `/commander` | ≤ 180 KB | ≤ 50 KB | n/a |
| `/kit` (mode A) | ≤ 200 KB | ≤ 50 KB lazy | n/a |
| `/merci/[id]` | ≤ 120 KB | n/a | ≤ 30 KB |

Mesuré via `bun run analyze` (next bundle analyzer).

### 8.3 Critical CSS

- Tailwind purge configuré pour le wizard
- Inline critical CSS pour le LCP (Step 1 visible above-the-fold)

---

## 9. Form handling pattern

### 9.1 Pattern unique : React Hook Form + Zod

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export function Step1Lead({ formConfig, onSubmit }) {
  const t = useTranslations('checkout.wizard.step1');
  const { leadId, values, setValue } = useWizardStore();

  const step1Schema = z.object({
    firstName: z.string().trim().min(2, t('errors.firstName.min')).max(50),
    phone: phoneMaroc9DigitsSchema,
    email: z.string().email(t('errors.email.invalid')).optional().or(z.literal('')),
  });

  const form = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: values,
    mode: 'onBlur',
  });

  const { autosaveLead } = useLeadAutosave({ debounce: 600 });

  const submit = form.handleSubmit(async (data) => {
    // POST lead if leadId === null, otherwise PATCH
    const lead = leadId
      ? await patchLead({ leadId, ...data })
      : await createLead(data);
    onSubmit(lead);
  });

  return (
    <form onSubmit={submit}>
      <WizardField id="firstName" label={t('fields.firstName.label')} errorMessage={form.formState.errors.firstName?.message}>
        <input {...form.register('firstName')} autoComplete="given-name" />
      </WizardField>

      <WizardField id="phone" label={t('fields.phone.label')} helperText={t('fields.phone.helper')} errorMessage={form.formState.errors.phone?.message}>
        <PhoneInput {...form.register('phone')} />
      </WizardField>

      {/* email optionnel toggle */}

      <WizardButton type="submit" loading={form.formState.isSubmitting}>
        {t('cta')}
      </WizardButton>
    </form>
  );
}
```

### 9.2 `<StockIndicator>` — Premium urgency component

**Type** : RSC (React Server Component) avec sub-component `<LowStockPulse>` client.

```tsx
// apps/web/src/components/commerce/wizard/StockIndicator.tsx
import { CheckCircle2, AlertTriangle, Clock, XCircle } from 'lucide-react';

type StockState = 'in_stock' | 'low_stock' | 'restocking' | 'out_of_stock';

export async function StockIndicator({ productId }: { productId: string }) {
  // RSC fetch with cache tag (revalidate on admin adjust)
  const stock = await fetch(`/api/checkout/stock/${productId}`, {
    next: { tags: [`product-stock-${productId}`], revalidate: 60 },
  }).then(r => r.json());

  const { state, stockUnits, restockEtaDays } = stock;

  const config = STOCK_STATE_CONFIG[state];  // icon + colors + copy keys

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 mb-6',
        config.bg,
        config.border,
      )}
    >
      <config.Icon className={cn('w-4.5 h-4.5 mt-0.5 shrink-0', config.iconColor)} strokeWidth={1.5} />
      <div className="flex-1">
        <p className={cn('text-sm font-medium', config.titleColor)}>
          {t(config.titleKey, { count: stockUnits, days: restockEtaDays })}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t(config.subtitleKey)}
        </p>
      </div>
      {state === 'low_stock' && <LowStockPulse />}
    </div>
  );
}
```

**`<LowStockPulse>`** : client component, animation Tailwind `animate-pulse-slow` (2s ease-in-out infinite). Respecte `prefers-reduced-motion: reduce` (CSS `@media`).

**Test surface** : 4 snapshots Storybook (un par état), unit Vitest pour logique de mapping état → config.

### 9.3 `<ThankYouEmailOptIn>` — Step 4 email capture

**Type** : Client component (utilise `useState` pour gérer le cycle `idle → loading → success | error`).

```tsx
// apps/web/src/components/commerce/wizard/ThankYouEmailOptIn.tsx
'use client';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

type Props = { orderId: string };

export function ThankYouEmailOptIn({ orderId }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
    mode: 'onBlur',
  });

  async function onSubmit({ email }: { email: string }) {
    setStatus('loading');
    track('email_optin_submitted', { orderId });
    try {
      const res = await fetch(`/api/checkout/order/${orderId}/email`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setConfirmedEmail(data.email);
      setStatus('success');
      track('email_optin_confirmed', { orderId });
    } catch (err) {
      setStatus('error');
      track('email_optin_failed', { orderId, reason: String(err) });
    }
  }

  if (status === 'success') {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-3 text-sm">
        <CheckCircle2 className="w-5 h-5 text-success" strokeWidth={1.5} />
        <span>{t('thankyou.email.confirmed', { email: confirmedEmail })}</span>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-lg bg-muted/30 p-4 space-y-3">
      <Label htmlFor="email-optin">{t('thankyou.email.label')}</Label>
      <WizardField id="email-optin" optional errorMessage={form.formState.errors.email?.message}>
        <Input
          id="email-optin"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="sara@example.com"
          {...form.register('email')}
        />
      </WizardField>
      <Button type="submit" variant="outline" disabled={status === 'loading'} className="w-full">
        <Mail className="w-4.5 h-4.5" strokeWidth={1.5} />
        <span>{status === 'loading' ? t('thankyou.email.sending') : t('thankyou.email.cta')}</span>
      </Button>
      {status === 'error' && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
          {t('thankyou.email.error')}
        </p>
      )}
    </form>
  );
}
```

**Garde-fous client** :
- `Idempotency-Key` stable pour la durée du composant (re-tries safe).
- CTA bouton désactivé pendant `loading` pour éviter double soumission.
- En succès : remplacement complet du form par un message statique (impossible de re-soumettre).
- Aucun stockage `localStorage` (l'orderId expire avec la session, RGPD-friendly).

**Test surface** : 6 scénarios RTL+MSW (idle, validation, success, rate-limit 429, server 502, idempotent re-send).

### 9.4 PhoneInput spécialisé

```tsx
// apps/web/src/components/commerce/wizard/fields/PhoneInput.tsx

import { forwardRef } from 'react';

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput({ onChange, value, ...rest }, ref) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\s/g, '');
      const clean = raw.replace(/[^0-9]/g, '').slice(0, 9);
      // Mask : 6 12 34 56 78
      const formatted = formatPhone(clean);
      onChange?.({ ...e, target: { ...e.target, value: clean } });
      e.target.value = formatted;
    };

    return (
      <div className="flex items-stretch overflow-hidden rounded-md border border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <span className="flex items-center bg-muted px-3 font-mono text-sm">
          <bdi>+212</bdi>
        </span>
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="6 12 34 56 78"
          className="flex-1 bg-background px-3 py-3 text-base outline-none"
          onChange={handleChange}
          defaultValue={value ? formatPhone(value) : ''}
          {...rest}
        />
      </div>
    );
  }
);

function formatPhone(digits: string): string {
  // 612345678 → "6 12 34 56 78"
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 1));
  if (digits.length > 1) parts.push(digits.slice(1, 3));
  if (digits.length > 3) parts.push(digits.slice(3, 5));
  if (digits.length > 5) parts.push(digits.slice(5, 7));
  if (digits.length > 7) parts.push(digits.slice(7, 9));
  return parts.join(' ');
}
```

---

## 10. Hooks réutilisables

### 10.1 `useLeadAutosave`

```ts
// apps/web/src/components/commerce/wizard/hooks/useLeadAutosave.ts

export function useLeadAutosave(options: { debounce: number }) {
  const { leadId, values, setPending } = useWizardStore();
  const debouncedPatch = useDebouncedCallback(async (partial) => {
    if (!leadId) return;
    setPending('patchAddress', true);
    try {
      await fetch(`/api/checkout/lead/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': uuidv4() },
        body: JSON.stringify(partial),
      });
    } finally {
      setPending('patchAddress', false);
    }
  }, options.debounce);

  return { autosaveLead: debouncedPatch };
}
```

### 10.2 `useDebouncedCallback`

Standard lodash-style implementation, `useCallback` + `setTimeout` + ref.

### 10.3 `useWizardAnalytics`

```ts
export function useWizardAnalytics() {
  const { leadId, variantKey, formMode } = useWizardStore();

  return {
    trackStepView: (step: WizardStep) => {
      pushDataLayer(buildStepViewEvent({ step, leadId, variantKey, formMode }));
    },
    trackLeadCapture: () => {
      pushDataLayer(buildLeadCaptureEvent({ leadId, variantKey, formMode }));
    },
    trackAddressCompleted: (cityName: string) => {
      pushDataLayer(buildAddressCompletedEvent({ leadId, variantKey, formMode, cityName }));
    },
    trackPaymentInfo: (paymentType: string) => {
      pushDataLayer(buildAddPaymentInfoEvent({ leadId, variantKey, formMode, paymentType }));
    },
    trackPurchase: (orderId: string, value: number, currency: string) => {
      pushDataLayer(buildPurchaseEvent({ transactionId: orderId, value, currency, leadId, variantKey, formMode }));
    },
    trackError: (errorType: string, errorField?: string, step?: WizardStep) => {
      pushDataLayer(buildWizardErrorEvent({ leadId, variantKey, formMode, errorType, errorField, step }));
    },
    trackAbandoned: (lastStep: WizardStep, timeSpentSeconds: number) => {
      pushDataLayer(buildWizardAbandonedEvent({ leadId, variantKey, formMode, lastStep, timeSpentSeconds }));
    },
  };
}
```

### 10.4 `useWizardFlow`

```ts
export function useWizardFlow() {
  const { currentStep, setCurrentStep, markStepCompleted } = useWizardStore();
  const analytics = useWizardAnalytics();

  useEffect(() => {
    analytics.trackStepView(currentStep);
  }, [currentStep]);

  return {
    currentStep,
    goNext: () => {
      const next = nextStep(currentStep, getEventForStep(currentStep));
      if (next) {
        markStepCompleted(currentStep);
        setCurrentStep(next);
      }
    },
    goBack: () => {
      const prev = previousStep(currentStep);
      if (prev) setCurrentStep(prev);
    },
  };
}
```

---

## 11. Side-effects & analytics

### 11.1 dataLayer push wrapper

```ts
// apps/web/src/lib/tracking/gtm/push.ts

const queue: DataLayerEvent[] = [];
let consentGranted = false;

export function pushDataLayer(event: DataLayerEvent) {
  if (!consentGranted) {
    queue.push(event);
    if (queue.length > 50) queue.shift();  // bound memory
    return;
  }
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

export function flushDataLayer() {
  consentGranted = true;
  while (queue.length) {
    const event = queue.shift();
    if (event) window.dataLayer?.push(event);
  }
}
```

### 11.2 Abandonment detection

```tsx
// apps/web/src/components/commerce/wizard/Wizard.tsx

useEffect(() => {
  const startTime = Date.now();

  const handleBeforeUnload = () => {
    const lastStep = useWizardStore.getState().currentStep;
    if (lastStep !== 'thank_you' && useWizardStore.getState().leadId) {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      // sendBeacon for reliability
      navigator.sendBeacon('/api/analytics/abandoned', JSON.stringify({
        leadId: useWizardStore.getState().leadId,
        lastStep,
        timeSpent,
      }));
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, []);
```

### 11.3 SMS retargeting (post-conversion abandonment)

- Job nightly query : `SELECT * FROM chat_lead WHERE status='in_progress' AND created_at BETWEEN NOW() - INTERVAL '24h' AND NOW() - INTERVAL '2h' AND consent_marketing = true`
- Pour chaque : envoie SMS "On vous a vu hier 👋 Votre kit FemiGlow vous attend → [link recovery /commander?lead=xxx]"
- Le lien `/commander?lead=xxx` (signed) hydrate le wizard avec les données déjà saisies

---

## 12. Performance budgets

### 12.1 Cibles Lighthouse mobile

| Métrique | Cible | Budget |
|---|---|---|
| LCP | < 2.5s | ≤ 2.0s |
| INP | < 200ms | ≤ 150ms |
| CLS | < 0.1 | ≤ 0.05 |
| TTI | < 3.5s | ≤ 3.0s |
| Total JS | < 250 KB | ≤ 200 KB (gzipped) |
| Initial CSS | < 30 KB | ≤ 25 KB |

### 12.2 Optimisations clés

1. **Wizard lazy** : pas chargé sur `/kit` PDP scroll initial. Chargé au tap CTA mobile / hover desktop.
2. **Lottie deferred** : chargé uniquement à la transition Step 3 → Step 4.
3. **Dataset cities split** : 80 KB lazy au mount Step 2 (pas Step 1).
4. **Image LCP** : `<Image priority>` sur hero `/kit`.
5. **Fonts** : `next/font` avec `display: swap` + preload des weights utilisés uniquement.
6. **Service Worker** : pas en V1 (overkill). À considérer V2 pour offline lead capture.

### 12.3 Mesures CI

- `bun run lighthouse-ci` après chaque PR sur preview deploy
- Seuil échec si LCP > 2.5s ou INP > 200ms
- Bundle analyzer obligatoire avant merge si delta > 10 KB

### 12.4 Performance dev workflow

```bash
# Local dev
cd apps/web
bun dev                    # http://localhost:3000

# Analyse bundle
ANALYZE=true bun run build # ouvre report HTML

# Lighthouse local
bun run lighthouse:local /commander
bun run lighthouse:local /kit

# Playwright perf trace
bun playwright test --trace=on apps/web/e2e/perf-budget.spec.ts
```

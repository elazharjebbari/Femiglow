# Wizard checkout — Stratégie i18n et préservation CHA-231

> Le tunnel checkout FemiGlow repose sur `WizardDictionary` (CHA-231) — un contrat type-safe stable. La migration i18n **NE DOIT PAS** le régresser. Ce document trace l'intégration next-intl ↔ WizardDictionary, le mapping des clés, les scénarios de test, l'audit RTL et la validation finale.

## 1. État de l'art (rappel)

### 1.1 Décision CHA-231 actée

- `WizardDictionary` est un objet TypeScript fortement typé contenant tous les libellés du wizard
- Il existe en versions FR et AR (à activer côté UI)
- Il est consommé par les composants wizard via `useWizardDictionary()`
- Le contrat est validé en CI : pas de clé manquante, pas de drift TypeScript
- Pas de chaîne hardcoded dans les composants wizard

### 1.2 Pourquoi ne pas migrer vers next-intl directement

| Argument | Détail |
|---|---|
| **Stabilité** | Le wizard fonctionne en prod, drive 100 % du chiffre d'affaires |
| **Type safety** | `WizardDictionary` impose une type cohérence stricte (interface TS) |
| **Effort vs reward** | Re-coder = risque pour 0 valeur ajoutée |
| **Tests existants** | Suite e2e + unit wizard validée historiquement |
| **Maintenance** | 1 fichier `.ts` à éditer pour modifier le wizard |

### 1.3 Décision retenue (rappel ADR-007)

**Co-existence** :
- **Wizard** continue d'utiliser `WizardDictionary` (TS object, statique au build)
- **Reste du site** utilise `next-intl` (messages JSON, RSC-first)
- **Bridge** : un fichier de conversion synchronise les terminologies (glossaire commun)

## 2. Architecture cible

### 2.1 Schéma

```
+-------------------------+        +-----------------------------+
|  messages/fr.json       |        |  src/lib/i18n/wizard/       |
|  messages/ar.json       |  --->  |  WizardDictionary.fr.ts     |
|  messages/en.json       |        |  WizardDictionary.ar.ts     |
|  (source of truth        |        |  WizardDictionary.en.ts     |
|   reste du site)        |        |  (source of truth wizard)   |
+-------------------------+        +-----------------------------+
        ^                                    ^
        |                                    |
        |       glossaire commun             |
        |       (content-style-guide.csv)    |
        |                                    |
+--------------+                  +---------------+
|  next-intl   |                  |  Wizard       |
|  RSC + CSR   |                  |  Components   |
+--------------+                  +---------------+
```

### 2.2 Boundaries

| Surface | i18n system |
|---|---|
| `/[locale]/` (marketing) | next-intl |
| `/[locale]/journal` | next-intl |
| `/[locale]/legal` | next-intl |
| `/[locale]/contact` | next-intl |
| `/[locale]/checkout/*` | **WizardDictionary** + next-intl pour layout autour |
| `/admin/*` | FR seul (pas i18n V1) |
| `/api/*` | Agnostique (messages d'erreur en FR + traduits côté client) |

### 2.3 Routing wizard

Le wizard est servi sous `/[locale]/checkout/...`. Le `locale` du path détermine quel `WizardDictionary` charger.

```tsx
// app/[locale]/checkout/layout.tsx
import { getWizardDictionary } from '@/lib/i18n/wizard';

export default async function CheckoutLayout({ children, params: { locale } }) {
  const dict = await getWizardDictionary(locale);
  return (
    <WizardDictionaryProvider dictionary={dict}>
      {children}
    </WizardDictionaryProvider>
  );
}
```

## 3. WizardDictionary — structure

### 3.1 Type interface (rappel, ne pas modifier)

```ts
// src/lib/wizard/types.ts
export interface WizardDictionary {
  meta: {
    locale: 'fr' | 'ar' | 'en';
    direction: 'ltr' | 'rtl';
  };
  common: {
    continue: string;
    back: string;
    cancel: string;
    confirm: string;
    save: string;
    loading: string;
    error_generic: string;
  };
  steps: {
    product: WizardStepDictionary;
    shipping: WizardStepDictionary;
    payment: WizardStepDictionary;
    confirmation: WizardStepDictionary;
  };
  stepper: {
    step_label: (n: number) => string;
    of_total: (current: number, total: number) => string;
  };
  shipping: {
    title: string;
    subtitle: string;
    fields: {
      first_name: WizardFieldDictionary;
      last_name: WizardFieldDictionary;
      email: WizardFieldDictionary;
      phone: WizardFieldDictionary;
      address: WizardFieldDictionary;
      city: WizardFieldDictionary;
      postal_code: WizardFieldDictionary;
    };
    delivery_methods: {
      standard: string;
      express: string;
    };
  };
  payment: {
    title: string;
    methods: {
      cmi: WizardPaymentMethodDictionary;
      cod: WizardPaymentMethodDictionary;
    };
    pay_now: string;
    pay_on_delivery: string;
    secured_by: string;
  };
  cart_recap: {
    title: string;
    items_count: (n: number) => string;
    subtotal: string;
    shipping: string;
    total: string;
    promo_applied: string;
    free_shipping_at: (threshold: number) => string;
  };
  confirmation: {
    title: string;
    order_number: (n: string) => string;
    estimated_delivery: (date: string) => string;
    cta_continue_shopping: string;
    receipt_sent: string;
  };
  errors: {
    network: string;
    payment_failed: string;
    validation_required: string;
    validation_email: string;
    validation_phone: string;
  };
}

interface WizardFieldDictionary {
  label: string;
  placeholder?: string;
  help?: string;
  error_required?: string;
  error_invalid?: string;
}

interface WizardStepDictionary {
  title: string;
  subtitle?: string;
}

interface WizardPaymentMethodDictionary {
  label: string;
  description: string;
  fee?: string;
}
```

### 3.2 Fichier exemple FR

```ts
// src/lib/i18n/wizard/WizardDictionary.fr.ts
import type { WizardDictionary } from '@/lib/wizard/types';

export const wizardDictionaryFr: WizardDictionary = {
  meta: { locale: 'fr', direction: 'ltr' },
  common: {
    continue: 'Continuer',
    back: 'Retour',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    save: 'Enregistrer',
    loading: 'Chargement...',
    error_generic: 'Une erreur est survenue. Réessayez.',
  },
  steps: {
    product: { title: 'Votre kit', subtitle: 'Composition' },
    shipping: { title: 'Livraison', subtitle: 'Adresse de réception' },
    payment: { title: 'Paiement', subtitle: 'Méthode de paiement' },
    confirmation: { title: 'Confirmation', subtitle: 'Récapitulatif' },
  },
  stepper: {
    step_label: (n) => `Étape ${n}`,
    of_total: (current, total) => `${current} sur ${total}`,
  },
  shipping: {
    title: 'Où vous livrer ?',
    subtitle: 'Indiquez votre adresse de réception.',
    fields: {
      first_name: {
        label: 'Prénom',
        placeholder: 'Sarah',
        error_required: 'Le prénom est requis',
      },
      last_name: {
        label: 'Nom',
        placeholder: 'Benali',
        error_required: 'Le nom est requis',
      },
      email: {
        label: 'Adresse e-mail',
        placeholder: 'sarah@exemple.com',
        error_required: 'L\'e-mail est requis',
        error_invalid: 'Format d\'e-mail invalide',
      },
      phone: {
        label: 'Téléphone',
        placeholder: '+212 6 ...',
        help: 'Pour la livraison',
        error_required: 'Le téléphone est requis',
        error_invalid: 'Numéro invalide',
      },
      address: {
        label: 'Adresse',
        placeholder: '12 rue de la Maison',
        error_required: 'L\'adresse est requise',
      },
      city: {
        label: 'Ville',
        placeholder: 'Casablanca',
        error_required: 'La ville est requise',
      },
      postal_code: {
        label: 'Code postal',
        placeholder: '20000',
      },
    },
    delivery_methods: {
      standard: 'Livraison standard (3-5 jours)',
      express: 'Express (1-2 jours)',
    },
  },
  payment: {
    title: 'Mode de paiement',
    methods: {
      cmi: {
        label: 'Carte bancaire',
        description: 'Paiement sécurisé par CMI',
      },
      cod: {
        label: 'À la livraison',
        description: 'Paiement en espèces au livreur',
        fee: 'Frais : 20 MAD',
      },
    },
    pay_now: 'Payer maintenant',
    pay_on_delivery: 'Payer à la livraison',
    secured_by: 'Paiement sécurisé par CMI',
  },
  cart_recap: {
    title: 'Récapitulatif',
    items_count: (n) => (n <= 1 ? `${n} article` : `${n} articles`),
    subtotal: 'Sous-total',
    shipping: 'Livraison',
    total: 'Total',
    promo_applied: 'Code promo appliqué',
    free_shipping_at: (t) => `Livraison offerte dès ${t} MAD`,
  },
  confirmation: {
    title: 'Merci pour votre commande',
    order_number: (n) => `Commande n° ${n}`,
    estimated_delivery: (d) => `Livraison estimée le ${d}`,
    cta_continue_shopping: 'Continuer mes achats',
    receipt_sent: 'Un reçu a été envoyé à votre e-mail.',
  },
  errors: {
    network: 'Vérifiez votre connexion et réessayez.',
    payment_failed: 'Le paiement a échoué. Réessayez ou choisissez un autre mode.',
    validation_required: 'Ce champ est requis',
    validation_email: 'Format d\'e-mail invalide',
    validation_phone: 'Numéro de téléphone invalide',
  },
};
```

### 3.3 Fichier AR (à compléter)

```ts
// src/lib/i18n/wizard/WizardDictionary.ar.ts
import type { WizardDictionary } from '@/lib/wizard/types';

export const wizardDictionaryAr: WizardDictionary = {
  meta: { locale: 'ar', direction: 'rtl' },
  common: {
    continue: 'متابعة',
    back: 'رجوع',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    save: 'حفظ',
    loading: 'جار التحميل...',
    error_generic: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
  },
  steps: {
    product: { title: 'الكيت الخاص بك', subtitle: 'المحتوى' },
    shipping: { title: 'التوصيل', subtitle: 'عنوان الاستلام' },
    payment: { title: 'الدفع', subtitle: 'طريقة الدفع' },
    confirmation: { title: 'تأكيد الطلب', subtitle: 'الملخص' },
  },
  // ... (à compléter par traducteur)
} as const;
```

### 3.4 Fichier EN (à créer)

```ts
// src/lib/i18n/wizard/WizardDictionary.en.ts
import type { WizardDictionary } from '@/lib/wizard/types';

export const wizardDictionaryEn: WizardDictionary = {
  meta: { locale: 'en', direction: 'ltr' },
  common: {
    continue: 'Continue',
    back: 'Back',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    loading: 'Loading...',
    error_generic: 'Something went wrong. Please try again.',
  },
  // ... (à compléter par traducteur)
} as const;
```

## 4. Mapping next-intl ↔ WizardDictionary

### 4.1 Stratégie : pas de partage, source duplication

Décision : **ne PAS partager les keys**. Le wizard a sa terminologie propre, validée par le contrat TS. Le reste du site a sa terminologie via JSON.

→ Risque de drift mitigé par : glossaire CSV partagé + revue mensuelle.

### 4.2 Concepts partagés (à synchroniser manuellement)

Termes qui apparaissent dans le wizard ET hors wizard. Doivent matcher :

| Concept | next-intl key | WizardDictionary path | Glossaire CSV |
|---|---|---|---|
| Kit complet | `marketing.kit.title` | `steps.product.title` | "Kit" |
| Continuer | `common.continue` | `common.continue` | "Continuer" |
| Retour | `common.back` | `common.back` | "Retour" |
| Livraison | `common.shipping` | `shipping.title` | "Livraison" |
| Paiement | `common.payment` | `payment.title` | "Paiement" |
| Total | `common.total` | `cart_recap.total` | "Total" |

→ Voir `content-style-guide.csv` pour la liste exhaustive.

### 4.3 Helper de synchronisation (optionnel V2)

Pour vérifier en CI que les concepts partagés sont identiques :

```ts
// scripts/check-wizard-sync.ts
import { wizardDictionaryFr } from '@/lib/i18n/wizard';
import messages from '@/messages/fr.json';

const sharedConcepts = [
  { wizard: 'common.continue', intl: 'common.continue' },
  { wizard: 'common.back', intl: 'common.back' },
  // ...
];

for (const { wizard, intl } of sharedConcepts) {
  const wizardValue = getPath(wizardDictionaryFr, wizard);
  const intlValue = getPath(messages, intl);
  if (wizardValue !== intlValue) {
    console.error(`Mismatch: ${wizard}="${wizardValue}" vs ${intl}="${intlValue}"`);
    process.exit(1);
  }
}
```

## 5. Chargement et provider

### 5.1 getWizardDictionary helper

```ts
// src/lib/i18n/wizard/index.ts
import type { WizardDictionary } from '@/lib/wizard/types';
import { wizardDictionaryFr } from './WizardDictionary.fr';
import { wizardDictionaryAr } from './WizardDictionary.ar';
import { wizardDictionaryEn } from './WizardDictionary.en';

const DICTIONARIES: Record<string, WizardDictionary> = {
  fr: wizardDictionaryFr,
  ar: wizardDictionaryAr,
  en: wizardDictionaryEn,
};

export function getWizardDictionary(locale: string): WizardDictionary {
  return DICTIONARIES[locale] ?? wizardDictionaryFr;
}
```

### 5.2 Provider React

```tsx
// src/components/wizard/WizardDictionaryProvider.tsx
'use client';

import { createContext, useContext } from 'react';
import type { WizardDictionary } from '@/lib/wizard/types';

const Context = createContext<WizardDictionary | null>(null);

export function WizardDictionaryProvider({
  dictionary,
  children,
}: {
  dictionary: WizardDictionary;
  children: React.ReactNode;
}) {
  return <Context.Provider value={dictionary}>{children}</Context.Provider>;
}

export function useWizardDictionary(): WizardDictionary {
  const dict = useContext(Context);
  if (!dict) {
    throw new Error('useWizardDictionary must be used within WizardDictionaryProvider');
  }
  return dict;
}
```

### 5.3 Usage dans composant wizard

```tsx
// src/components/wizard/ShippingStep.tsx
'use client';

import { useWizardDictionary } from './WizardDictionaryProvider';

export function ShippingStep() {
  const dict = useWizardDictionary();
  return (
    <div>
      <h2>{dict.shipping.title}</h2>
      <p>{dict.shipping.subtitle}</p>
      <input
        type="text"
        placeholder={dict.shipping.fields.first_name.placeholder}
        aria-label={dict.shipping.fields.first_name.label}
      />
      <button>{dict.common.continue}</button>
    </div>
  );
}
```

## 6. Scénarios de test E2E par locale

### 6.1 Setup test

```ts
// e2e/wizard/checkout-flow.spec.ts
import { test, expect } from '@playwright/test';

const LOCALES = ['fr', 'ar', 'en'] as const;

for (const locale of LOCALES) {
  test.describe(`Wizard checkout — ${locale}`, () => {
    test(`step 1 → step 2 → step 3 → confirmation`, async ({ page }) => {
      await page.goto(`/${locale}/checkout`);

      // Step 1 : produit affiché
      await expect(page.locator('h2')).toContainText(getDictValue(locale, 'steps.product.title'));
      await page.locator('[data-testid="continue-btn"]').click();

      // Step 2 : shipping
      await expect(page.locator('h2')).toContainText(getDictValue(locale, 'shipping.title'));
      await page.fill('[name="first_name"]', 'Sarah');
      await page.fill('[name="last_name"]', 'Benali');
      await page.fill('[name="email"]', 'sarah@example.com');
      await page.fill('[name="phone"]', '+212612345678');
      await page.fill('[name="address"]', '12 rue Test');
      await page.fill('[name="city"]', 'Casablanca');
      await page.locator('[data-testid="continue-btn"]').click();

      // Step 3 : payment
      await expect(page.locator('h2')).toContainText(getDictValue(locale, 'payment.title'));
      await page.locator('[data-testid="payment-cod"]').click();
      await page.locator('[data-testid="continue-btn"]').click();

      // Confirmation
      await expect(page.locator('h2')).toContainText(getDictValue(locale, 'confirmation.title'));
    });
  });
}
```

### 6.2 Test direction RTL pour AR

```ts
test('wizard in AR shows RTL direction', async ({ page }) => {
  await page.goto('/ar/checkout');
  const dir = await page.locator('html').getAttribute('dir');
  expect(dir).toBe('rtl');

  // Stepper visual order
  const steps = page.locator('[data-testid="step-indicator"]');
  const firstStep = await steps.first().boundingBox();
  const lastStep = await steps.last().boundingBox();
  // In RTL, first step should be on the right
  expect(firstStep!.x).toBeGreaterThan(lastStep!.x);
});
```

### 6.3 Test validations formulaire i18n

```ts
test('shipping validation messages are in correct locale', async ({ page }) => {
  await page.goto('/fr/checkout');
  // Skip to shipping
  await page.locator('[data-testid="continue-btn"]').click();
  // Try submit without filling
  await page.locator('[data-testid="continue-btn"]').click();
  await expect(page.locator('[data-testid="error-first_name"]')).toContainText('Le prénom est requis');

  await page.goto('/ar/checkout');
  await page.locator('[data-testid="continue-btn"]').click();
  await page.locator('[data-testid="continue-btn"]').click();
  await expect(page.locator('[data-testid="error-first_name"]')).toContainText('الاسم الشخصي مطلوب');

  await page.goto('/en/checkout');
  await page.locator('[data-testid="continue-btn"]').click();
  await page.locator('[data-testid="continue-btn"]').click();
  await expect(page.locator('[data-testid="error-first_name"]')).toContainText('First name is required');
});
```

### 6.4 Test bascule de langue mid-wizard

Question : si l'utilisateur change de langue au step 2, le wizard doit-il rester sur le step 2 traduit ?

**Décision V1** : le switcher est **caché** pendant le wizard (sécurité + simplicité). L'utilisateur choisit la langue au /[locale]/ initial et continue dans cette langue.

```ts
test('locale switcher is hidden during checkout', async ({ page }) => {
  await page.goto('/fr/checkout');
  const switcher = page.locator('[data-testid="locale-switcher"]');
  await expect(switcher).toBeHidden();
});
```

### 6.5 Test persistance de la commande après switch

Si toutefois on autorise le switch (V2) :

```ts
test('cart data persists when switching locale mid-checkout', async ({ page }) => {
  await page.goto('/fr/checkout');
  await page.fill('[name="first_name"]', 'Sarah');
  await page.fill('[name="email"]', 'test@x.com');
  // Switch to AR
  // (Si V2 active le switcher)
  // ...
  await expect(page.locator('[name="first_name"]')).toHaveValue('Sarah');
  await expect(page.locator('[name="email"]')).toHaveValue('test@x.com');
});
```

→ V1 : pas applicable car switcher caché.

## 7. Audit RTL du wizard

### 7.1 Composants à auditer

| Composant | Audit RTL | Status attendu |
|---|---|---|
| `<WizardLayout />` | Structure flex | `flex-row` (suit dir) |
| `<Stepper />` | Numéros et connecteurs | Order naturel, `border-s` pour connecteur |
| `<ShippingStep />` | Form fields | `text-start` labels, `dir="auto"` inputs |
| `<PaymentMethodCard />` | Card horizontal | `ms-0` icône, layout flex |
| `<CartRecap />` | Sticky sidebar | `end-0` au lieu de `right-0` |
| `<ContinueButton />` | Bouton + icône flèche | Icône flèche miroir |
| `<BackButton />` | Bouton + icône flèche | Icône flèche miroir |
| `<FieldError />` | Position relative input | `ms-2` icon erreur |
| `<DeliveryOptionList />` | Radio cards | Layout symétrique OK |
| `<PromoCodeInput />` | Input + bouton inline | Flex naturel |
| `<ConfirmationCheckmark />` | Icône check | NON miroir |

### 7.2 Audit des champs avec données LTR forcées

Certains champs contiennent toujours des caractères LTR (téléphone, e-mail) :

```tsx
<input
  type="tel"
  dir="ltr"          // FORCE LTR même en RTL
  className="text-start"
  value={phone}
  onChange={...}
/>
```

Champs concernés :
- Téléphone (`+212 6 12 34 56 78`)
- Email
- Code postal (numérique)
- Numéro de carte bancaire
- URL

### 7.3 Stepper visuel en RTL

Mockup ASCII LTR :

```
[1] -------- [2] -------- [3] -------- [4]
Produit     Livraison    Paiement     Confirm
```

Mockup ASCII RTL :

```
[4] -------- [3] -------- [2] -------- [1]
Confirm     Paiement     Livraison    Produit
```

→ Le `flex-row` naturel inverse l'ordre. Les numéros `1, 2, 3, 4` restent en chiffres occidentaux.

### 7.4 Sticky sidebar (récap panier)

LTR : sticky à droite

```tsx
<aside className="sticky top-4 end-0 w-80">
  <CartRecap />
</aside>
```

`end-0` garantit qu'en RTL la sidebar est à gauche, et en LTR à droite.

### 7.5 Boutons "Continuer" / "Retour"

LTR :

```
[ Retour ]              [ Continuer → ]
```

RTL (visuellement, après inversion natural flex) :

```
[ ← متابعة ]              [ رجوع ]
```

Code :

```tsx
<div className="flex justify-between">
  <button className="text-stone-500">{dict.common.back}</button>
  <button className="bg-stone-900 text-white">
    {dict.common.continue}
    <ArrowRightIcon mirror /> {/* miroir activé */}
  </button>
</div>
```

## 8. Champ téléphone — cas spécifique

### 8.1 Pourquoi spécifique

Le numéro `+212` doit toujours s'afficher LTR même en page RTL. Sinon, le `+` apparait à la fin du numéro et l'utilisateur le saisit dans le mauvais sens.

### 8.2 Implémentation

```tsx
<div className="space-y-1">
  <label htmlFor="phone" className="text-start">
    {dict.shipping.fields.phone.label}
  </label>
  <div className="flex" dir="ltr"> {/* Force LTR sur le wrapper */}
    <span className="ps-3 py-2 text-stone-500 select-none">+212</span>
    <input
      type="tel"
      id="phone"
      className="text-start ps-1"
      placeholder="6 12 34 56 78"
    />
  </div>
</div>
```

### 8.3 Test

```ts
test('phone input forces LTR in arabic page', async ({ page }) => {
  await page.goto('/ar/checkout');
  await page.locator('[data-testid="continue-btn"]').click();
  const phoneWrapper = page.locator('[data-testid="phone-wrapper"]');
  const dir = await phoneWrapper.getAttribute('dir');
  expect(dir).toBe('ltr');
});
```

## 9. Validation messages i18n

### 9.1 Centralisation côté wizard

Les messages d'erreur de validation sont dans `WizardDictionary.errors` et `WizardDictionary.shipping.fields.<field>.error_*`.

### 9.2 Format

```ts
errors: {
  network: 'Vérifiez votre connexion et réessayez.',
  payment_failed: 'Le paiement a échoué. Réessayez ou choisissez un autre mode.',
  validation_required: 'Ce champ est requis',
  validation_email: 'Format d\'e-mail invalide',
  validation_phone: 'Numéro de téléphone invalide',
},
shipping: {
  fields: {
    email: {
      error_required: 'L\'e-mail est requis',
      error_invalid: 'Format d\'e-mail invalide',
    },
  },
},
```

### 9.3 Usage dans Zod schema

```ts
import { z } from 'zod';

export function createShippingSchema(dict: WizardDictionary) {
  return z.object({
    first_name: z.string().min(1, dict.shipping.fields.first_name.error_required),
    last_name: z.string().min(1, dict.shipping.fields.last_name.error_required),
    email: z.string()
      .min(1, dict.shipping.fields.email.error_required)
      .email(dict.shipping.fields.email.error_invalid),
    phone: z.string()
      .min(1, dict.shipping.fields.phone.error_required)
      .regex(/^\+212\s?[6-7]\d{8}$/, dict.shipping.fields.phone.error_invalid),
    // ...
  });
}
```

### 9.4 Schema invalidation au changement de langue

Le schema dépend du dictionary. Si la langue change, recréer le schema. Avec React Hook Form :

```tsx
const dict = useWizardDictionary();
const schema = useMemo(() => createShippingSchema(dict), [dict.meta.locale]);
const form = useForm({ resolver: zodResolver(schema) });
```

## 10. Messages serveur (validation back-end)

### 10.1 Cas

Les routes `/api/checkout/*` peuvent retourner des erreurs. Elles doivent être traduites.

### 10.2 Stratégie

Le serveur retourne une **clé d'erreur** standardisée, pas un message :

```json
{
  "error": {
    "code": "validation.phone.invalid",
    "details": { "received": "06" }
  }
}
```

Le client traduit la clé via le dictionary :

```ts
const errorMessage = dict.errors.validation_phone;
```

### 10.3 Codes d'erreur recensés

| Code | Source | WizardDictionary key |
|---|---|---|
| `validation.email.invalid` | Validation API | `errors.validation_email` |
| `validation.phone.invalid` | Validation API | `errors.validation_phone` |
| `payment.failed` | API CMI | `errors.payment_failed` |
| `payment.declined` | API CMI | (nouvelle clé à ajouter) |
| `stock.insufficient` | Inventory check | (nouvelle clé) |
| `network.timeout` | Front fetch | `errors.network` |

→ Ajouter clés manquantes dans `WizardDictionary` au fur et à mesure.

## 11. Plan de migration progressive

### 11.1 État initial

- `WizardDictionary.fr.ts` existe et est en prod
- `WizardDictionary.ar.ts` peut exister partiellement (CHA-231)
- `WizardDictionary.en.ts` n'existe pas

### 11.2 Étapes

| # | Action | Sortie |
|---|---|---|
| 1 | Compléter `WizardDictionary.ar.ts` (traducteur) | Coverage 100 % AR |
| 2 | Créer `WizardDictionary.en.ts` (traducteur) | Coverage 100 % EN |
| 3 | Wrapper layout `/[locale]/checkout/` avec provider | Wizard rendu avec dict correct |
| 4 | Migrer composants wizard vers logical Tailwind | Audit RTL OK |
| 5 | Forcer LTR sur champs phone / email / numérique | Tests OK |
| 6 | Cacher locale switcher pendant le checkout | Tests Playwright OK |
| 7 | Tester E2E par locale | Tous greens |
| 8 | Validation fondatrice sur AR | Approuvé |
| 9 | Ship | Feature flag `I18N_WIZARD=true` |

### 11.3 Rollback plan

Si problème en prod :
- Feature flag `WIZARD_LOCALES=['fr']` → force FR pour tous
- Pas de redirect, juste fallback dictionary FR
- Logs Sentry surveillés

### 11.4 Critères de release

- [ ] 100 % coverage des 3 dictionaries
- [ ] 100 % tests E2E par locale verts
- [ ] Audit RTL composant par composant validé
- [ ] Lighthouse a11y >= 95 sur le wizard en AR
- [ ] Validation utilisateurs réels (au moins 2 commandes test AR + 1 EN)
- [ ] Pas de régression sur taux conversion FR (mesure 7 jours après ship)

## 12. Glossaire wizard FemiGlow

Termes clés à figer dans les 3 dictionaries (cf. `content-style-guide.csv`) :

| FR | AR | EN | Notes |
|---|---|---|---|
| Continuer | متابعة | Continue | Action principale |
| Retour | رجوع | Back | Navigation arrière |
| Annuler | إلغاء | Cancel | Annulation |
| Livraison | التوصيل | Shipping | Section |
| Adresse | العنوان | Address | Champ |
| Téléphone | الهاتف | Phone | Champ |
| Paiement | الدفع | Payment | Section |
| Carte bancaire | البطاقة البنكية | Credit card | Méthode |
| À la livraison | عند الاستلام | Cash on delivery | Méthode |
| Total | المجموع | Total | Récap |
| Sous-total | المجموع الفرعي | Subtotal | Récap |
| Commande | الطلب | Order | Récap |
| Merci | شكرا | Thank you | Confirmation |

## 13. Anti-patterns

- ❌ Migrer le wizard vers `useTranslations()` next-intl → casse CHA-231
- ❌ Avoir des strings hardcoded en plein milieu du wizard
- ❌ Schemas Zod avec messages hardcoded (`.min(1, 'Required')`)
- ❌ Oublier `dir="ltr"` sur les champs téléphone / email / numérique en RTL
- ❌ Activer le locale switcher pendant le checkout V1 (risque perte de données)
- ❌ Stepper avec `text-left` (utiliser `text-start`)
- ❌ Sticky sidebar `right-0` (utiliser `end-0`)
- ❌ Hardcoder le séparateur de step `→` sans miroir
- ❌ Mélanger `useTranslations()` et `useWizardDictionary()` dans le même composant wizard
- ❌ Oublier de re-créer le schema Zod quand la langue change
- ❌ Régresser sur les tests E2E historiques CHA-231

## 14. Checklist livraison wizard i18n

- [ ] `WizardDictionary.fr.ts` complet et inchangé (sécurité)
- [ ] `WizardDictionary.ar.ts` complet (validé par traducteur AR)
- [ ] `WizardDictionary.en.ts` complet (validé par traducteur EN)
- [ ] Provider injecté dans `/[locale]/checkout/layout.tsx`
- [ ] Tous les composants wizard utilisent `useWizardDictionary()`
- [ ] Aucune string hardcoded dans `src/components/wizard/`
- [ ] Schemas Zod construits via `createSchema(dict)` (pas hardcoded)
- [ ] Champs téléphone / email forcés `dir="ltr"` quand RTL
- [ ] Stepper rendu correctement en RTL (visual test)
- [ ] Locale switcher caché pendant `/checkout/*`
- [ ] Tests E2E checkout × 3 locales tous verts
- [ ] Tests RTL : stepper, sidebar, boutons miroirés
- [ ] Tests validation : messages d'erreur en bonne langue
- [ ] Audit a11y Lighthouse wizard AR >= 95
- [ ] CHA-231 contract tests inchangés et verts
- [ ] Sentry tags `wizard_locale` ajoutés pour observabilité
- [ ] Doc équipe pour ajouter une nouvelle locale au wizard

## 15. Liens

- `02-design-conception/data-model.md` — schema commande / utilisateur
- `02-design-conception/translation-keys-schema.json` — naming hors wizard
- `rtl-support.md` — audit composants RTL
- `typography.md` — Cairo pour wizard
- `content-style-guide.csv` — glossaire partagé
- `tone-style-guide.md` — voix de marque par langue
- CHA-231 — issue historique WizardDictionary

# 04 — Backend design

## 1. Architecture générale

```
                Server (RSC)                          Client
   ┌────────────────────────────┐         ┌────────────────────────────┐
   │  /kit page.tsx             │         │  KitCommanderSection        │
   │  ↓                         │  prop   │  ↓ render                  │
   │  resolveCart()             │ ──────► │  WizardShell                │
   │  resolveKitWizardCopy() ?  │ ──────► │  ↓ Zustand store           │
   └────────────────────────────┘         │  Steps + Hooks tracking    │
                  ▲                         │  ↓ API mutations            │
                  │ revalidateTag           │  fetch /api/checkout/*      │
                  │ kit-wizard              └────────────────────────────┘
                  │                                      │
                  │                                      ▼
   ┌────────────────────────────┐         ┌────────────────────────────┐
   │  /admin/kit/wizard         │ ──────► │  /api/track (events)        │
   │  (optionnel W5)            │         │  + /api/checkout/lead/*     │
   └────────────────────────────┘         └────────────────────────────┘
```

## 2. Pas de modification API checkout

Les routes `/api/checkout/lead`, `/api/checkout/lead/[id]/address`,
`/api/checkout/order`, `/api/delivery-cities/search` **restent inchangées**.

L'optimisation est exclusivement **côté UI + tracking**.

## 3. Tracking — extensions

### 3.1 Schemas Zod (cf. doc 03 §2)

Les 5 nouveaux events sont validés serveur via `validator.ts` qui lit
`eventSchemas`. Pas de breaking change : les events sans schema sont
loggés `unknown_event` et acceptés (pattern actuel).

### 3.2 Catégorisation

Tous les nouveaux events sont en catégorie `'engagement'` (ne polluent
pas le funnel ecommerce déjà tracké).

### 3.3 Volume et coût

- `wizard_field_filled` : ~5 events par session = ~5 × visites
- `wizard_field_corrected` : ~0-2 events par session = ~1 × visites
- `wizard_step_abandoned` : ~0,3 event par session = ~0.3 × visites
- `wizard_resume_shown` : ~0.1 (uniquement retours)
- `wizard_resume_dismissed` : ~0.05

**Volume total** : ~6,5 events / session × visites `/kit` → impact
négligeable sur le coût ingestion (Postgres tracking_events table).

### 3.4 Throttling

Aucun throttling spécifique nécessaire — les events sont émis :
- `wizard_field_filled` : 1 fois max par champ par session (guard via
  `filledFieldsThisSession` Set côté store)
- `wizard_field_corrected` : à chaque correction détectée, max ~3-5/champ
- `wizard_step_abandoned` : 1 fois max par step (guard via flag local)
- `wizard_resume_shown` / `_dismissed` : 1 fois max par session

## 4. Resolver wizard copy (W5 optionnel)

```ts
// apps/web/src/lib/kit/wizard/resolver.ts
import { DEFAULT_WIZARD_COPY, type WizardCopy } from '@/lib/checkout/copy/wizard-copy';
import { getKitWizardOverride } from './store';

export const KIT_WIZARD_TAG = 'kit-wizard' as const;

export interface ResolvedKitWizard {
  copy: WizardCopy;
  features: ResolvedWizardFeatures;
  meta: { source: 'mock' | 'override-draft' | 'override-published'; ... };
}

export function resolveKitWizard(): ResolvedKitWizard {
  const override = getKitWizardOverride();
  if (!override || override.publishedAt === null) {
    return { copy: DEFAULT_WIZARD_COPY, features: DEFAULT_FEATURES, meta: { source: 'mock', ... } };
  }
  // Merge partial : seul les champs non-null du patch override sont appliqués
  return {
    copy: { ...DEFAULT_WIZARD_COPY, ...pickNonNull(override.copy) },
    features: { ...DEFAULT_FEATURES, ...pickNonNull(override.features) },
    meta: { source: 'override-published', ... },
  };
}
```

## 5. Store / Routes API (W5 optionnelles)

Pattern identique à `kit-pack` :
- `lib/kit/wizard/store.ts` — memoryStore via `ext('kit-wizard')`
- `lib/kit/wizard/resolver.ts` — `resolveKitWizard()` + `resolveKitWizardDraft()`
- `lib/kit/wizard/schemas.ts` — `kitWizardOverrideUpsertSchema` Zod
- `/api/admin/kit/wizard/route.ts` — GET / PATCH
- `/api/admin/kit/wizard/publish/route.ts` — POST
- `/api/admin/kit/wizard/reset/route.ts` — POST (magic word `RESET-WIZARD`)

Audit actions : `kit_wizard.update`, `kit_wizard.publish`, `kit_wizard.reset`.

## 6. Isolation et garanties

| Garantie | Mécanisme |
|---|---|
| Le checkout serveur reste inchangé | Aucune modif `/api/checkout/*` |
| Les events tracking sont rétro-compatibles | Nouveaux schemas additifs, pas de breaking change |
| Le store Zustand reste rétro-compatible | Tous nouveaux fields optionnels, persistence selective |
| Le bundle initial `/kit` reste maîtrisé | Lazy-loaded composants (déjà le cas pour `AddressStep`) |
| Le rendu SSR de `KitCommanderSection` reste cohérent | Les nouveaux composants Client ne bloquent pas l'hydration |
| L'override admin n'affecte pas le serveur de commande | Le checkout API ne lit jamais `KitWizardOverride` |

## 7. Diagramme événements

```
USER ENTERS /kit
  │
  ▼
SCROLL TO #commander-femiglow
  │
  ▼ WizardShell mount
  ├── IF leadDraft.firstName persisted → wizard_resume_shown
  │     │
  │     ▼ user clicks dismiss or fills field
  │     └─→ wizard_resume_dismissed (si dismiss)
  │
  ▼ User clicks firstName field
  ├── form_start (1ère focus, dédupliqué)
  │
  ▼ User types "Y"
  ├── checkout_intent (1ère frappe, idempotent)
  │
  ▼ User completes "Yasmine" (valid)
  ├── wizard_field_filled { field_name: 'firstName', time_since_focus_ms: 3200 }
  │
  ▼ User tabs to phone
  ▼ User types "0612345678" (valid after 9 digits)
  ├── wizard_field_filled { field_name: 'phone', ... }
  │
  ▼ User checks consent
  ├── wizard_field_filled { field_name: 'consent', ... }
  │
  ▼ User clicks "Continuer · paiement à la livraison"
  ├── POST /api/checkout/lead
  ├── lead_capture (serveur émet)
  ├── Step navigate to 'address'
  │
  ▼ Step 2 - AddressStep mount
  │ ...
  ▼ User submits address
  ├── POST /api/checkout/lead/{id}/address
  ├── address_completed
  ├── add_payment_info (serveur auto-aligne COD)
  ├── POST /api/checkout/order
  ├── purchase
  ├── Step navigate to 'thank_you'
  │
  ▼ If user scrolls away > 10s mid-wizard
  └── wizard_step_abandoned { step_name, fields_completed, time_in_step_ms }
```

## 8. Performance

- **Bundle wizard chunk** : actuellement ~28 kB gzipped (LeadCaptureStep + WizardShell + Zustand)
- **Nouveaux composants** : ~3-4 kB gzipped (cumulé, tous lazy-loadables sauf CartRecap qui doit s'afficher au mount)
- **Cible delta** : ≤ +5 kB gzipped sur le bundle initial `/kit`

Mitigation :
- `WizardCartRecap` est Server-renderable (props venant du serveur)
- `NoCommitmentBadge`, `TimeEstimateBadge` sont des Server Components purs
- Seuls `PhoneMaskInput` (controllable input) et `ResumeBanner` (animation
  fade) sont Client — minimaux en bundle

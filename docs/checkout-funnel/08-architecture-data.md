# Architecture Data — DB, API, contrats

> Spec exhaustive : schémas Drizzle, migrations SQL, repos, endpoints REST,
> contrats Zod, events GTM, caching. Tout ce qui touche à la donnée pour le
> nouveau funnel.

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Schémas Drizzle](#2-schémas-drizzle)
3. [Migrations SQL](#3-migrations-sql)
4. [Endpoints API](#4-endpoints-api)
5. [Contrats Zod](#5-contrats-zod)
6. [Couche repository](#6-couche-repository)
7. [Évenements GTM / dataLayer](#7-événements-gtm--datalayer)
8. [Cache & invalidation](#8-cache--invalidation)
9. [Sécurité & rate limiting](#9-sécurité--rate-limiting)
10. [Performance budgets](#10-performance-budgets)

---

## 1. Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser / Client                      │
│  Wizard.tsx → useWizardStore (Zustand) → fetch API routes  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js App Router — apps/web/src/app          │
│                                                             │
│  /api/checkout/lead             POST + PATCH               │
│  /api/checkout/lead/[id]/finalize  POST                    │
│  /api/checkout/form-config/active  GET (cached)            │
│  /api/admin/form-config/*       Admin CRUD                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Repos — apps/web/src/lib/**/repos              │
│                                                             │
│   leadRepo      orderRepo      formConfigRepo               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Drizzle ORM — schemas + migrations             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Postgres 17 — apps/web/.env DATABASE_URL       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Schémas Drizzle

### 2.1 `chat_lead` (étendu)

> **Existing** dans `apps/web/src/lib/chat/db/schema.ts` (cf. CLAUDE memory).
> Le funnel REUSE cette table : 1 chat_lead row = 1 visiteur identifié,
> qu'il vienne du chat ou du wizard checkout.

```ts
// apps/web/src/lib/chat/db/schema.ts (additions)

export const chatLead = pgTable('chat_lead', {
  // ... colonnes existantes (id, firstName, phone, email, status, etc.)

  // ADDED par migration 0023 (cf. §3)
  source: text('source', {
    enum: ['chat', 'wizard_lead_step', 'wizard_embed', 'wizard_cart', 'admin_manual']
  }).notNull().default('chat'),

  cartSnapshot: jsonb('cart_snapshot').$type<CartSnapshot>(),

  gclid: text('gclid'),       // Google ads click id
  fbclid: text('fbclid'),     // Facebook ads click id
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),

  consentedAt: timestamp('consented_at', { withTimezone: true }),

  // ADDED par migration 0024
  address: jsonb('address').$type<LeadAddress>(),
  paymentMethod: text('payment_method', { enum: ['cod', 'bank'] }),
  promoCode: text('promo_code'),
}, (t) => ({
  // index nouveaux
  sourceIdx: index('chat_lead_source_idx').on(t.source),
  consentedAtIdx: index('chat_lead_consented_at_idx').on(t.consentedAt),
}));

export type CartSnapshot = {
  items: Array<{
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  shipping: number;
  total: number;
  currency: 'MAD' | 'EUR';
  capturedAt: string;  // ISO
};

export type LeadAddress = {
  line1: string;
  line2?: string;
  cityId: string;        // FK logique vers dataset cities
  cityName: string;
  cityNameAr?: string;
  postalCode?: string;
  landmark?: string;
  countryCode: 'MA';
};
```

### 2.2 `orders` (existant, légères additions)

```ts
// apps/web/src/lib/db/schema.ts

export const orders = pgTable('orders', {
  // ... colonnes existantes

  // ADDED par migration 0024
  leadId: text('lead_id').references(() => chatLead.id),  // 1 commande peut venir d'un lead
  formConfigId: text('form_config_id').references(() => formConfig.id),  // version de config utilisée
  formVariantKey: text('form_variant_key'),  // 'control' | 'A' | 'B' (pour analyse A/B)
  formMode: text('form_mode', { enum: ['legacy', 'wizard_embed', 'wizard_cart'] }),

  // ADDED par migration 0029 — Email opt-in confirmation (Step 4 Thank-You)
  email: text('email'),                                            // optionnel, capturé post-finalize
  emailConfirmationSentAt: timestamp('email_confirmation_sent_at', { withTimezone: true }),
  emailOptinAttempts: integer('email_optin_attempts').notNull().default(0),
}, (t) => ({
  leadIdIdx: index('orders_lead_id_idx').on(t.leadId),
  formConfigIdx: index('orders_form_config_idx').on(t.formConfigId),
  emailIdx: index('orders_email_idx').on(t.email),
}));
```

### 2.3 `form_config` (nouveau)

cf. [`07-admin-form-management.md`](./07-admin-form-management.md) §2.1 pour le schéma complet.

### 2.4 `form_config_history` (nouveau)

cf. [`07-admin-form-management.md`](./07-admin-form-management.md) §2.1.

### 2.5 `form_variant_assignment` (nouveau)

```ts
export const formVariantAssignment = pgTable('form_variant_assignment', {
  id: text('id').primaryKey().$defaultFn(() => createId('fva')),
  leadId: text('lead_id').notNull().references(() => chatLead.id, { onDelete: 'cascade' }),
  formConfigId: text('form_config_id').notNull().references(() => formConfig.id),
  variantKey: text('variant_key').notNull(),
  assignmentSeed: text('assignment_seed').notNull(),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  leadIdx: index('form_variant_assignment_lead_idx').on(t.leadId),
  configVariantIdx: index('form_variant_assignment_config_variant_idx').on(t.formConfigId, t.variantKey),
  uniquePerLead: uniqueIndex('form_variant_assignment_unique_lead').on(t.leadId, t.formConfigId),
}));
```

### 2.6 `checkout_idempotency` (nouveau)

```ts
// Anti-double submit pour POST mutations
export const checkoutIdempotency = pgTable('checkout_idempotency', {
  key: text('key').primaryKey(),           // X-Idempotency-Key header (client uuid)
  endpoint: text('endpoint').notNull(),    // '/api/checkout/lead' etc.
  responseStatus: integer('response_status').notNull(),
  responseBody: jsonb('response_body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => ({
  expiresAtIdx: index('checkout_idempotency_expires_at_idx').on(t.expiresAt),
}));
```

TTL : 24h via job nightly `DELETE FROM checkout_idempotency WHERE expires_at < NOW()`.

### 2.7 `product_stock` (nouveau)

Source de vérité pour l'indicateur stock côté Step 2 du wizard + gestion admin
des seuils. Une ligne par `productId` (FK logique vers le catalogue produit
`apps/web/src/data/products/*` ou table `products` si elle existe).

```ts
// apps/web/src/lib/db/schema.ts

export const productStock = pgTable('product_stock', {
  id: text('id').primaryKey().$defaultFn(() => createId('pst')),
  productId: text('product_id').notNull().unique(),    // ex: 'femiglow-kit'
  sku: text('sku').notNull(),                          // ex: 'KIT-FG-001'

  stockUnits: integer('stock_units').notNull().default(0),         // unités disponibles
  reservedUnits: integer('reserved_units').notNull().default(0),   // unités tenues par leads in_progress (TTL 30min)
  lowStockThreshold: integer('low_stock_threshold').notNull().default(10),  // seuil "stock limité" — admin-adjustable
  restockEtaDays: integer('restock_eta_days'),         // null si non communiqué (rupture totale)
  restockEtaDate: timestamp('restock_eta_date', { withTimezone: true }),  // optionnel : date précise

  // Audit
  lastAdjustmentReason: text('last_adjustment_reason'),  // 'sale', 'restock', 'admin_manual', 'inventory_count'
  lastAdjustmentBy: text('last_adjustment_by'),          // userId admin ou 'system'
  lastAdjustmentAt: timestamp('last_adjustment_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  productIdIdx: uniqueIndex('product_stock_product_id_idx').on(t.productId),
}));
```

**Effective stock available** = `stock_units - reserved_units`.

**État affiché côté UI** (cf. `06-wizard-ui-specification.md §6.4`) :
- `available > lowStockThreshold` → "En stock"
- `0 < available ≤ lowStockThreshold` → "Stock limité — Plus que {available} kits"
- `available = 0` ET `restockEtaDays != null` → "Réapprovisionnement sous {restockEtaDays} jours"
- `available = 0` ET `restockEtaDays = null` → "Indisponible temporairement"

**Adjustment audit table** (réutilise pattern `form_config_history`) :

```ts
export const productStockAdjustment = pgTable('product_stock_adjustment', {
  id: text('id').primaryKey().$defaultFn(() => createId('psa')),
  productStockId: text('product_stock_id').notNull().references(() => productStock.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(),                                  // +50 (restock), -1 (sale), etc.
  reason: text('reason', { enum: ['sale', 'restock', 'admin_manual', 'inventory_count', 'reservation', 'release'] }).notNull(),
  orderId: text('order_id'),                                          // si reason='sale'
  leadId: text('lead_id'),                                            // si reason='reservation'/'release'
  performedBy: text('performed_by').notNull(),                        // userId admin ou 'system'
  performedAt: timestamp('performed_at', { withTimezone: true }).notNull().defaultNow(),
  note: text('note'),
}, (t) => ({
  productIdx: index('product_stock_adjustment_product_idx').on(t.productStockId),
  performedAtIdx: index('product_stock_adjustment_performed_at_idx').on(t.performedAt),
}));
```

---

## 3. Migrations SQL

### 3.1 `0023_chat_lead_funnel_extensions.sql`

```sql
-- Extension de chat_lead pour le funnel wizard

ALTER TABLE chat_lead
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'chat'
    CHECK (source IN ('chat', 'wizard_lead_step', 'wizard_embed', 'wizard_cart', 'admin_manual')),
  ADD COLUMN IF NOT EXISTS cart_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS gclid TEXT,
  ADD COLUMN IF NOT EXISTS fbclid TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS chat_lead_source_idx ON chat_lead(source);
CREATE INDEX IF NOT EXISTS chat_lead_consented_at_idx ON chat_lead(consented_at);

-- Comment pour clarté
COMMENT ON COLUMN chat_lead.source IS 'Origin of the lead: chat, wizard step 1, wizard embed on /kit, cart wizard on /commander, admin manual entry';
COMMENT ON COLUMN chat_lead.cart_snapshot IS 'Snapshot of cart at lead creation time, for retargeting context';
COMMENT ON COLUMN chat_lead.consented_at IS 'Timestamp when user accepted CGV/privacy policy (loi 09-08 audit trail)';
```

### 3.2 `0024_orders_lead_link.sql`

```sql
ALTER TABLE chat_lead
  ADD COLUMN IF NOT EXISTS address JSONB,
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('cod', 'bank')),
  ADD COLUMN IF NOT EXISTS promo_code TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS lead_id TEXT REFERENCES chat_lead(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS form_config_id TEXT,
  ADD COLUMN IF NOT EXISTS form_variant_key TEXT,
  ADD COLUMN IF NOT EXISTS form_mode TEXT
    CHECK (form_mode IN ('legacy', 'wizard_embed', 'wizard_cart'));

CREATE INDEX IF NOT EXISTS orders_lead_id_idx ON orders(lead_id);
CREATE INDEX IF NOT EXISTS orders_form_config_idx ON orders(form_config_id);

COMMENT ON COLUMN orders.lead_id IS 'Reference to chat_lead that generated this order (NULL for legacy flow)';
COMMENT ON COLUMN orders.form_mode IS 'Which funnel produced this order (for analytics)';
```

### 3.3 `0025_form_config.sql`

```sql
CREATE TABLE IF NOT EXISTS form_config (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  variant_assignment JSONB,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

-- Une seule version published par slug
CREATE UNIQUE INDEX IF NOT EXISTS form_config_slug_published_unique
  ON form_config(slug)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS form_config_slug_version_idx
  ON form_config(slug, version DESC);

CREATE INDEX IF NOT EXISTS form_config_status_idx
  ON form_config(status);

CREATE TABLE IF NOT EXISTS form_config_history (
  id TEXT PRIMARY KEY,
  form_config_id TEXT NOT NULL REFERENCES form_config(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  config_snapshot JSONB NOT NULL,
  diff JSONB NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'publish', 'archive', 'rollback', 'migrate')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS form_config_history_form_config_idx
  ON form_config_history(form_config_id, version DESC);

-- Seed: insert default config
INSERT INTO form_config (
  id, slug, version, status, name, description, config, created_by, updated_by, published_at
) VALUES (
  'cfg_default_checkout_wizard_v1',
  'checkout_wizard',
  1,
  'published',
  'Checkout Wizard MA — Default v1',
  'Configuration initiale du wizard checkout',
  '{
    "$schema": "https://femiglow.com/schemas/form-config/v1",
    "meta": {
      "name": "Checkout Wizard MA — Default v1",
      "locale_default": "fr",
      "locales_enabled": ["fr", "ar"]
    },
    "steps": [
      {
        "id": "lead",
        "enabled": true,
        "order": 0,
        "title_i18n": {"fr": "Recevez votre kit FemiGlow en 24-48h", "ar": "استلمي طقم FemiGlow في 24-48 ساعة"},
        "subtitle_i18n": {"fr": "Pas de carte. Pas de compte. 30 secondes.", "ar": "بدون بطاقة. بدون حساب. 30 ثانية."},
        "fields": [
          {"key": "firstName", "enabled": true, "required": true, "order": 0, "label_i18n": {"fr": "Prénom", "ar": "الاسم"}},
          {"key": "phone", "enabled": true, "required": true, "order": 1, "label_i18n": {"fr": "Téléphone", "ar": "الهاتف"}, "helper_i18n": {"fr": "On vous enverra un SMS de confirmation", "ar": "سنرسل لك رسالة SMS للتأكيد"}},
          {"key": "email", "enabled": true, "required": false, "order": 2, "label_i18n": {"fr": "Email (optionnel)", "ar": "البريد الإلكتروني (اختياري)"}}
        ]
      },
      {
        "id": "address",
        "enabled": true,
        "order": 1,
        "title_i18n": {"fr": "Où devons-nous livrer ?", "ar": "إلى أين نوصل لك؟"},
        "subtitle_i18n": {"fr": "Livraison 24-48h dans tout le Maroc", "ar": "توصيل في 24-48 ساعة في كل المغرب"},
        "fields": [
          {"key": "city", "enabled": true, "required": true, "order": 0, "label_i18n": {"fr": "Ville", "ar": "المدينة"}, "placeholder_i18n": {"fr": "Tapez votre ville", "ar": "اكتبي اسم مدينتك"}},
          {"key": "address", "enabled": true, "required": true, "order": 1, "label_i18n": {"fr": "Adresse complète", "ar": "العنوان الكامل"}, "placeholder_i18n": {"fr": "Rue, immeuble, appartement", "ar": "الشارع، العمارة، الشقة"}},
          {"key": "postalCode", "enabled": true, "required": false, "order": 2, "label_i18n": {"fr": "Code postal (optionnel)", "ar": "الرمز البريدي (اختياري)"}},
          {"key": "landmark", "enabled": true, "required": false, "order": 3, "label_i18n": {"fr": "Repère (optionnel)", "ar": "معلم قريب (اختياري)"}, "helper_i18n": {"fr": "Aide le livreur à vous trouver plus vite", "ar": "يساعد عامل التوصيل على إيجادك بسرعة"}}
        ]
      },
      {
        "id": "payment",
        "enabled": true,
        "order": 2,
        "title_i18n": {"fr": "Comment souhaitez-vous payer ?", "ar": "كيف تفضلين الدفع؟"},
        "subtitle_i18n": {"fr": "Tous les modes sont sécurisés", "ar": "كل طرق الدفع مؤمنة"},
        "fields": [
          {"key": "paymentMethod", "enabled": true, "required": true, "order": 0, "label_i18n": {"fr": "Mode de paiement", "ar": "طريقة الدفع"}},
          {"key": "promoCode", "enabled": true, "required": false, "order": 1, "label_i18n": {"fr": "Code promo", "ar": "كود ترويجي"}}
        ]
      }
    ],
    "layout": {"show_progress": true, "show_trust_seals": true, "sticky_cta_mobile": true}
  }'::jsonb,
  'system',
  'system',
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

### 3.4 `0026_product_stock.sql`

```sql
CREATE TABLE IF NOT EXISTS product_stock (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL,
  stock_units INTEGER NOT NULL DEFAULT 0 CHECK (stock_units >= 0),
  reserved_units INTEGER NOT NULL DEFAULT 0 CHECK (reserved_units >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
  restock_eta_days INTEGER CHECK (restock_eta_days IS NULL OR restock_eta_days >= 0),
  restock_eta_date TIMESTAMPTZ,
  last_adjustment_reason TEXT,
  last_adjustment_by TEXT,
  last_adjustment_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_stock_adjustment (
  id TEXT PRIMARY KEY,
  product_stock_id TEXT NOT NULL REFERENCES product_stock(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('sale', 'restock', 'admin_manual', 'inventory_count', 'reservation', 'release')),
  order_id TEXT,
  lead_id TEXT,
  performed_by TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS product_stock_adjustment_product_idx ON product_stock_adjustment(product_stock_id);
CREATE INDEX IF NOT EXISTS product_stock_adjustment_performed_at_idx ON product_stock_adjustment(performed_at);

-- Seed FemiGlow kit
INSERT INTO product_stock (id, product_id, sku, stock_units, reserved_units, low_stock_threshold, restock_eta_days)
VALUES ('pst_femiglow_kit_v1', 'femiglow-kit', 'KIT-FG-001', 120, 0, 15, 5)
ON CONFLICT (product_id) DO NOTHING;

COMMENT ON COLUMN product_stock.stock_units IS 'Total available units (raw count, before reservations)';
COMMENT ON COLUMN product_stock.reserved_units IS 'Units soft-reserved by in-progress leads (TTL 30min, released on lead abandon)';
COMMENT ON COLUMN product_stock.low_stock_threshold IS 'Below this, UI shows "stock limité" + pulse animation (admin-adjustable)';
COMMENT ON COLUMN product_stock.restock_eta_days IS 'Communicated restock window in days; NULL = unknown (UI shows "indisponible temporairement")';
```

### 3.5 `0027_form_variant_assignment.sql`

```sql
CREATE TABLE IF NOT EXISTS form_variant_assignment (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES chat_lead(id) ON DELETE CASCADE,
  form_config_id TEXT NOT NULL REFERENCES form_config(id),
  variant_key TEXT NOT NULL,
  assignment_seed TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS form_variant_assignment_lead_idx
  ON form_variant_assignment(lead_id);

CREATE INDEX IF NOT EXISTS form_variant_assignment_config_variant_idx
  ON form_variant_assignment(form_config_id, variant_key);

CREATE UNIQUE INDEX IF NOT EXISTS form_variant_assignment_unique_lead
  ON form_variant_assignment(lead_id, form_config_id);
```

### 3.6 `0028_checkout_idempotency.sql`

```sql
CREATE TABLE IF NOT EXISTS checkout_idempotency (
  key TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS checkout_idempotency_expires_at_idx
  ON checkout_idempotency(expires_at);
```

### 3.7 `0029_orders_email_optin.sql`

```sql
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS email_confirmation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_optin_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS orders_email_idx ON orders(email);

COMMENT ON COLUMN orders.email IS 'Optional email captured on Thank-You screen for transactional confirmation';
COMMENT ON COLUMN orders.email_confirmation_sent_at IS 'Timestamp of transactional email dispatch (null = not sent)';
COMMENT ON COLUMN orders.email_optin_attempts IS 'Counter for rate limiting (max 3 / 10min)';
```

---

## 4. Endpoints API

### 4.1 `POST /api/checkout/lead` — Création du lead minimal

**Auth** : aucune (public, rate limited)
**Headers requis** :
- `Content-Type: application/json`
- `X-Idempotency-Key: <uuid>` (client génère)

**Body** :
```ts
{
  firstName: string;       // min 2 max 50
  phone: string;           // 9 chiffres MA
  email?: string;
  source: 'wizard_embed' | 'wizard_cart' | 'wizard_lead_step';
  cartSnapshot?: CartSnapshot;
  tracking?: {
    gclid?: string;
    fbclid?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
  formConfigId?: string;   // version utilisée
}
```

**Response 201** :
```ts
{
  leadId: string;           // 'lead_xxx'
  variantKey: string;       // 'control' | 'A' | 'B'
  formConfig: FormConfigJSON;  // config résolue (déjà merge avec variant overrides)
}
```

**Side effects** :
- Insert `chat_lead` row
- Insert `form_variant_assignment` row (assignation déterministe)
- Set HttpOnly cookie `fg_lead` = leadId (signed, 30 jours)
- `dataLayer.push({ event: 'lead_capture', lead_id, form_mode })` côté client après reception

**Erreurs** :
- 422 : validation Zod
- 429 : rate limit (10 req/min/IP)
- 500 : DB error

### 4.2 `PATCH /api/checkout/lead/[leadId]` — Patch progressif

**Auth** : cookie `fg_lead` doit matcher `leadId` (anti-tampering)
**Headers** : `X-Idempotency-Key`

**Body partial** :
```ts
{
  address?: LeadAddress;
  paymentMethod?: 'cod' | 'bank';
  promoCode?: string;
  consentedAt?: string;   // ISO timestamp (auto-set at finalize, implicit consent)
}
```

**Response 200** :
```ts
{
  leadId: string;
  status: 'in_progress';
  updatedFields: string[];   // ['address', 'paymentMethod']
}
```

### 4.3 `POST /api/checkout/lead/[leadId]/finalize` — Conversion → order

**Auth** : cookie `fg_lead` matche
**Headers** : `X-Idempotency-Key`

**Body** :
```ts
{
  cartItems: Array<{ productId: string; quantity: number }>;  // re-validé côté serveur
  expectedTotal: number;     // check anti-tampering prix
}
```

**Comportement serveur** :
1. Lock row `chat_lead` (FOR UPDATE)
2. Vérifier tous les fields requis présents (firstName, phone, address, paymentMethod)
3. **Audit consentement** : set `chat_lead.consented_at = now()` + `consent_version` +
   capture `ip` + `user_agent` (loi 09-08 — preuve d'acceptation implicite à la soumission)
4. Re-calculer le prix (lookup produits DB, pas trust client)
5. Vérifier le stock (`product_stock.stock_units >= cartItem.quantity`) → 409 `stock_unavailable` si rupture
6. Si mismatch `expectedTotal` → 409
7. Insert `orders` row avec `lead_id` FK
8. Décrémenter `product_stock.stock_units` (atomic, dans la même transaction)
9. Update `chat_lead.status = 'converted'`
10. Si mode COD → status `pending_dispatch`, sinon → en attente virement bancaire
11. Emit event `lead_converted_to_order` (interne)

**Response 201** :
```ts
{
  orderId: string;          // 'ord_xxx' ou format existant
  orderNumber: string;      // 'FG-A4B7C2' (human-friendly)
  redirectTo: string;       // '/merci/[orderId]'
  total: number;
  currency: 'MAD' | 'EUR';
}
```

### 4.4 `GET /api/checkout/form-config/active`

**Auth** : aucune (public, cached)
**Query** : `slug=checkout_wizard` (default si omis)

**Response 200** (cached 60s) :
```ts
{
  id: string;
  version: number;
  config: FormConfigJSON;
  variants?: VariantAssignment;
  publishedAt: string;
}
```

**Cache tag** : `form-config-active-checkout_wizard`

### 4.5 `GET /api/checkout/stock/[productId]` — Stock indicator

**Auth** : aucune (public, cached 60s)
**Query** : `productId` ex: `femiglow-kit`

**Response 200** :
```ts
{
  productId: string;
  sku: string;
  stockUnits: number;                 // disponible effectif (stock_units - reserved_units)
  lowStockThreshold: number;          // seuil admin-configured
  state: 'in_stock' | 'low_stock' | 'restocking' | 'out_of_stock';
  restockEtaDays: number | null;      // si state='restocking'
  restockEtaDate: string | null;      // ISO si défini
  lastUpdatedAt: string;              // ISO — pour cache invalidation côté client
}
```

**Errors** :
- 404 : produit inconnu
- 500 : DB error

**Cache tag** : `product-stock-{productId}` (invalidé sur sale + restock admin).

### 4.6 `POST /api/checkout/stock-notify` — Email notify (rupture totale)

**Auth** : aucune (public, rate-limited 5/min/IP)
**Body** :
```ts
{
  productId: string;
  email: z.string().email();
  locale: 'fr' | 'ar';
}
```

**Response 201** : `{ subscribed: true }`
**Comportement** : insert dans `stock_notify_optin` (table dédiée, déduplication par couple `productId + email`), envoi email transactionnel quand `stockUnits > 0`.

### 4.7 `PATCH /api/checkout/order/[orderId]/email` — Email opt-in (Step 4 Thank-You)

**Auth** : public (le `orderId` agit comme bearer secret — préfixe `ord_` + UUID v7, non énumérable)

**Headers** :
- `Idempotency-Key: <client-uuid>` (replay-safe)

**Body** :
```json
{ "email": "sara@example.com" }
```

**Validation Zod** :
```ts
z.object({
  email: z.string().trim().toLowerCase().email(),
}).strict()
```

**Action serveur** :
1. SELECT `orders` WHERE `id = orderId` (404 si introuvable)
2. Si `email_optin_attempts >= 3` ET `updatedAt > now() - interval '10 min'` → 429 `RATE_LIMITED`
3. Si `email_confirmation_sent_at IS NOT NULL` AND `email = body.email` → 200 (idempotent re-send absorbé)
4. UPDATE `orders SET email = body.email, email_optin_attempts = email_optin_attempts + 1`
5. Dispatch email transactionnel (provider externe — Resend / SES / Postmark) avec template `order-confirmation-fr` ou `-ar`
6. UPDATE `orders SET email_confirmation_sent_at = NOW()`
7. Tracking : `email_optin_confirmed` (success) ou `email_optin_failed` (provider error)

**Response 200** :
```json
{ "ok": true, "email": "sara@example.com", "sentAt": "2026-05-11T14:32:18.421Z" }
```

**Erreurs** :
- 400 `INVALID_EMAIL`
- 404 `ORDER_NOT_FOUND`
- 429 `RATE_LIMITED` (Retry-After: 600)
- 502 `EMAIL_PROVIDER_UNAVAILABLE` (retry idempotent côté client)

### 4.8 Endpoints admin

**`PATCH /api/admin/products/stock/[productStockId]`** :
- Auth : `requireAdmin`
- Body : `{ stockUnits?, lowStockThreshold?, restockEtaDays?, restockEtaDate?, reason: string, note?: string }`
- Action :
  1. Lock row `product_stock` (FOR UPDATE)
  2. Compute `delta = newStockUnits - oldStockUnits`
  3. Update row + set `last_adjustment_*` audit fields
  4. Insert `product_stock_adjustment` row (RFC 6902-style audit trail)
  5. Trigger `revalidateTag('product-stock-{productId}')`
- Response 200 `{ id, productId, stockUnits, version }`

**`GET /api/admin/products/stock`** : liste paginée + filtres (low_stock, out_of_stock).
**`GET /api/admin/products/stock/[id]/history`** : audit trail (cf. `product_stock_adjustment`).

cf. [`07-admin-form-management.md §6`](./07-admin-form-management.md) pour le détail des pages admin.

### 4.9 Endpoints admin form-config

cf. [`07-admin-form-management.md`](./07-admin-form-management.md) §10 pour la liste.

Détails clés :

**`PUT /api/admin/form-config/[id]`** :
- Auth : `requireAdmin`
- Body : `{ config: FormConfigJSON, reason?: string }`
- Action :
  1. Validate Zod `formConfigJsonSchema`
  2. Compute JSON Patch diff vs current
  3. Update row (status reste `draft`, version unchanged)
  4. Insert `form_config_history` row
- Response 200 `{ id, version, updatedAt }`

**`POST /api/admin/form-config/[id]/publish`** :
- Auth : `requireAdmin`
- Action en transaction :
  ```sql
  BEGIN;
  UPDATE form_config SET status='archived', archived_at=NOW() WHERE slug='checkout_wizard' AND status='published';
  UPDATE form_config SET status='published', published_at=NOW(), version=(SELECT COALESCE(MAX(version),0)+1 FROM form_config WHERE slug='checkout_wizard') WHERE id=$1;
  COMMIT;
  ```
- Insert history row (action=publish)
- Trigger `revalidateTag('form-config-active-checkout_wizard')`
- Response 200

---

## 5. Contrats Zod

### 5.1 Existant (à réutiliser)

```ts
// apps/web/src/lib/schemas/order.ts (existant)

export const phoneMaroc9DigitsSchema = z.string()
  .trim()
  .regex(/^[67]\d{8}$/, 'Numéro marocain invalide (doit commencer par 06 ou 07)');

export const checkoutFormSchema = z.object({
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50).optional(),
  email: z.string().email().optional(),
  phone: phoneMaroc9DigitsSchema,
  // ...
});
```

### 5.2 Nouveaux (pour le wizard)

```ts
// apps/web/src/lib/checkout/schemas/lead.ts (nouveau)

export const createLeadInputSchema = z.object({
  firstName: z.string().trim().min(2).max(50),
  phone: phoneMaroc9DigitsSchema,
  email: z.string().email().optional(),
  source: z.enum(['wizard_lead_step', 'wizard_embed', 'wizard_cart']),
  cartSnapshot: cartSnapshotSchema.optional(),
  tracking: z.object({
    gclid: z.string().optional(),
    fbclid: z.string().optional(),
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
  }).optional(),
  formConfigId: z.string().optional(),
});

export const patchLeadInputSchema = z.object({
  address: z.object({
    line1: z.string().trim().min(5).max(150),
    line2: z.string().trim().max(150).optional(),
    cityId: z.string(),
    cityName: z.string().min(1).max(80),
    cityNameAr: z.string().max(80).optional(),
    postalCode: z.string().regex(/^\d{5}$/).optional(),
    landmark: z.string().max(100).optional(),
    countryCode: z.literal('MA'),
  }).optional(),
  paymentMethod: z.enum(['cod', 'bank']).optional(),
  promoCode: z.string().trim().max(20).optional(),
  consentedAt: z.string().datetime().optional(),
});

export const finalizeLeadInputSchema = z.object({
  cartItems: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().min(1).max(99),
  })).min(1),
  expectedTotal: z.number().positive(),
});

export const orderEmailOptinInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
}).strict();

export const cartSnapshotSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    sku: z.string(),
    name: z.string(),
    quantity: z.number().int().min(1),
    unitPrice: z.number().positive(),
    totalPrice: z.number().positive(),
  })),
  subtotal: z.number().positive(),
  shipping: z.number().min(0),
  total: z.number().positive(),
  currency: z.enum(['MAD', 'EUR']),
  capturedAt: z.string().datetime(),
});
```

---

## 6. Couche repository

### 6.1 `leadRepo` (extension de l'existant)

```ts
// apps/web/src/lib/checkout/repos/lead.ts (nouveau wrapper, complète chat/repos/lead.ts)

export type LeadRepo = {
  createMinimal(input: CreateLeadInput, tx?: DrizzleTx): Promise<{ leadId: string }>;
  findById(leadId: string): Promise<ChatLead | null>;
  patchContact(leadId: string, fields: Partial<{ firstName: string; email: string }>): Promise<void>;
  patchAddress(leadId: string, address: LeadAddress): Promise<void>;
  patchPayment(leadId: string, paymentMethod: PaymentMethod, promoCode?: string): Promise<void>;
  patchConsent(leadId: string, consentedAt: Date): Promise<void>;
  markConverted(leadId: string, orderId: string, tx?: DrizzleTx): Promise<void>;
  findByPhoneRecent(phone: string, withinHours: number): Promise<ChatLead | null>;  // anti-dup
};

export function createLeadRepo(db: Database): LeadRepo {
  return {
    async createMinimal(input, tx) {
      const handle = tx ?? db;
      const leadId = createId('lead');
      await handle.insert(chatLead).values({
        id: leadId,
        firstName: input.firstName,
        phone: input.phone,
        email: input.email ?? null,
        source: input.source,
        cartSnapshot: input.cartSnapshot ?? null,
        gclid: input.tracking?.gclid ?? null,
        fbclid: input.tracking?.fbclid ?? null,
        utmSource: input.tracking?.utm_source ?? null,
        utmMedium: input.tracking?.utm_medium ?? null,
        utmCampaign: input.tracking?.utm_campaign ?? null,
        status: 'new',
      });
      return { leadId };
    },

    async patchAddress(leadId, address) {
      await db.update(chatLead)
        .set({ address, updatedAt: new Date() })
        .where(eq(chatLead.id, leadId));
    },

    async patchPayment(leadId, paymentMethod, promoCode) {
      await db.update(chatLead)
        .set({ paymentMethod, promoCode: promoCode ?? null, updatedAt: new Date() })
        .where(eq(chatLead.id, leadId));
    },

    async patchConsent(leadId, consentedAt) {
      await db.update(chatLead)
        .set({ consentedAt, updatedAt: new Date() })
        .where(eq(chatLead.id, leadId));
    },

    async markConverted(leadId, orderId, tx) {
      const handle = tx ?? db;
      await handle.update(chatLead)
        .set({ status: 'converted', updatedAt: new Date() })
        .where(eq(chatLead.id, leadId));
    },

    async findByPhoneRecent(phone, withinHours) {
      const since = new Date(Date.now() - withinHours * 3_600_000);
      const [row] = await db.select().from(chatLead)
        .where(and(eq(chatLead.phone, phone), gt(chatLead.createdAt, since)))
        .orderBy(desc(chatLead.createdAt))
        .limit(1);
      return row ?? null;
    },

    // findById, patchContact: standard
  };
}
```

### 6.2 `formConfigRepo` (nouveau)

```ts
// apps/web/src/lib/checkout/repos/form-config.ts

export type FormConfigRepo = {
  getActive(slug: string): Promise<FormConfigRow | null>;
  getById(id: string): Promise<FormConfigRow | null>;
  list(slug: string, opts?: { status?: FormConfigStatus; limit?: number }): Promise<FormConfigRow[]>;
  create(input: CreateFormConfigInput, adminId: string): Promise<{ id: string }>;
  update(id: string, config: FormConfigJSON, adminId: string, reason?: string): Promise<void>;
  publish(id: string, adminId: string): Promise<void>;
  archive(id: string, adminId: string): Promise<void>;
  rollback(originalId: string, toVersion: number, adminId: string, reason: string): Promise<{ newDraftId: string }>;
  listHistory(formConfigId: string, opts?: { limit: number; offset: number }): Promise<FormConfigHistoryRow[]>;
  getHistorySnapshot(formConfigId: string, version: number): Promise<FormConfigJSON | null>;
};
```

### 6.3 `variantAssignmentRepo` (nouveau)

```ts
// apps/web/src/lib/checkout/repos/variant-assignment.ts

export type VariantAssignmentRepo = {
  assign(input: {
    leadId: string;
    formConfigId: string;
    variants: VariantAssignment['variants'];
    seed: string;
  }): Promise<{ variantKey: string; mergedConfig: FormConfigJSON }>;

  getByLead(leadId: string, formConfigId: string): Promise<{ variantKey: string } | null>;
};
```

### 6.4 `idempotencyRepo` (nouveau)

```ts
export type IdempotencyRepo = {
  get(key: string, endpoint: string): Promise<{ status: number; body: unknown } | null>;
  set(key: string, endpoint: string, status: number, body: unknown, ttlSeconds: number): Promise<void>;
};
```

Usage côté handler :
```ts
const key = req.headers.get('x-idempotency-key');
if (key) {
  const cached = await idempotencyRepo.get(key, '/api/checkout/lead');
  if (cached) return NextResponse.json(cached.body, { status: cached.status });
}
// ... process ...
const response = NextResponse.json(result, { status: 201 });
if (key) await idempotencyRepo.set(key, '/api/checkout/lead', 201, result, 86_400);
return response;
```

---

## 7. Évenements GTM / dataLayer

### 7.1 Taxonomie complète

| Event name | Trigger | Properties |
|---|---|---|
| `view_kit` | Mount `/kit` page | `currency`, `value`, `items[]` |
| `lead_capture` | Lead créé côté DB (response 201) | `lead_id`, `form_mode`, `variant_key`, `step_name: 'lead'` |
| `address_completed` | PATCH lead avec adresse OK | `lead_id`, `form_mode`, `variant_key`, `step_name: 'address'`, `city_name` |
| `add_to_cart` | Mode A : ouverture drawer / Mode B : "Ajouter au panier" sur `/kit` | `currency`, `value`, `items[]`, `form_mode` |
| `begin_checkout` | Wizard mount sur Step 1 | `currency`, `value`, `items[]`, `form_mode`, `variant_key` |
| `add_payment_info` | Sélection paymentMethod (Step 3) | `lead_id`, `payment_type`, `form_mode`, `variant_key` |
| `purchase` | Order créé (finalize success) | `transaction_id`, `value`, `currency`, `items[]`, `lead_id`, `form_mode`, `variant_key`, `payment_type` |
| `wizard_abandoned` | User ferme drawer / quitte page après lead créé | `lead_id`, `last_step`, `form_mode`, `time_spent_seconds` |
| `wizard_error` | Erreur validation ou réseau | `lead_id?`, `error_type`, `error_field?`, `step_name`, `form_mode` |
| `view_thank_you` | Mount page `/merci/[id]` | `transaction_id`, `value`, `currency` |

### 7.2 Builder code

```ts
// apps/web/src/lib/tracking/gtm/builders.ts (extension)

export function buildLeadCaptureEvent(input: {
  leadId: string;
  formMode: 'wizard_embed' | 'wizard_cart' | 'wizard_lead_step';
  variantKey?: string;
}): DataLayerEvent {
  return {
    event: 'lead_capture',
    lead_id: input.leadId,
    form_mode: input.formMode,
    variant_key: input.variantKey,
    step_name: 'lead',
  };
}

export function buildAddressCompletedEvent(input: {
  leadId: string;
  formMode: FormMode;
  variantKey?: string;
  cityName: string;
}): DataLayerEvent {
  return {
    event: 'address_completed',
    lead_id: input.leadId,
    form_mode: input.formMode,
    variant_key: input.variantKey,
    step_name: 'address',
    city_name: input.cityName,
  };
}

// ... etc
```

### 7.3 Consent gating

- Le banner cookie (`apps/web/src/components/CookieBanner.tsx`) gère le consentement GTM
- `dataLayer.push` est wrappé : si pas de consent, queue dans memory (max 50), flush au consent
- Le wizard fonctionne même sans consent (les events sont juste pas envoyés)

---

## 8. Cache & invalidation

### 8.1 Cache layers

| Layer | TTL | Key | Invalidation |
|---|---|---|---|
| `GET /api/checkout/form-config/active` Edge cache | 60s | URL + locale | tag `form-config-active-<slug>` |
| In-memory React Query (client) | 5 min | `['form-config']` | `queryClient.invalidateQueries` |
| `localStorage` `femiglow-wizard-v1` (Zustand persist) | until cart cleared | n/a | manual clear on purchase success |

### 8.2 Server actions revalidate

```ts
// apps/web/src/lib/checkout/actions/publish-form-config.ts
'use server';

export async function publishFormConfig(id: string) {
  // ...
  revalidateTag('form-config-active-checkout_wizard');
  revalidatePath('/[locale]/commander', 'page');
  revalidatePath('/[locale]/kit', 'page');
}
```

### 8.3 Cart store invalidation

À la conversion success → `useCartStore.getState().clear()` + `localStorage.removeItem('femiglow-cart')` + `localStorage.removeItem('femiglow-wizard-v1')`.

---

## 9. Sécurité & rate limiting

### 9.1 Rate limits (via Upstash Redis ou in-memory dev)

| Endpoint | Limit | Scope |
|---|---|---|
| `POST /api/checkout/lead` | 10/min | IP |
| `PATCH /api/checkout/lead/[id]` | 60/min | leadId |
| `POST /api/checkout/lead/[id]/finalize` | 5/min | leadId |
| `GET /api/checkout/form-config/active` | 300/min | IP |
| `PUT /api/admin/form-config/[id]` | 30/min | admin id |
| `POST /api/admin/form-config/[id]/publish` | 5/min | admin id |

### 9.2 Cookies sensibles

- `fg_lead` : HttpOnly, Secure, SameSite=Lax, signed via `iron-session` style signature, expire 30j
- `fg_variant_seed` : HttpOnly=false (lu côté client pour anti-flicker), Secure, SameSite=Lax, expire 1 an
- `femiglow_admin_session` : HttpOnly, Secure, SameSite=Strict, TTL 8h sliding

### 9.3 Input sanitization

- Zod parse côté serveur AVANT toute écriture
- Pas de HTML accepté dans aucun champ user
- jsonb fields : zod parse aussi pour valider la structure

### 9.4 Tampering anti-prix

`POST /finalize` :
- Re-fetch produits par `productId` depuis DB
- Recalcule total côté serveur
- Compare avec `expectedTotal` du client
- Si mismatch > 0.01 → 409 Conflict + log

### 9.5 SSRF guards

- Les URLs dans config (futur si on accepte logos custom) sont validées contre allowlist domains
- Pas de fetch côté serveur basé sur input user

---

## 10. Performance budgets

| Cible | Mesure |
|---|---|
| `POST /api/checkout/lead` p95 | < 200 ms (sans réseau) |
| `PATCH /api/checkout/lead/[id]` p95 | < 150 ms |
| `POST /finalize` p95 | < 500 ms (incluant insert orders + revalidate) |
| `GET /form-config/active` cache hit | < 30 ms |
| `GET /form-config/active` cache miss | < 100 ms |
| DB query `chat_lead INSERT` | < 50 ms |
| DB query `orders INSERT` | < 80 ms |
| JSON config size | < 8 KB gzipped (admin warn si > 5 KB) |

### Monitoring

- Vercel Speed Insights pour endpoints (déjà en place)
- Custom timing logs sur `/api/checkout/*` via middleware Next
- Sentry breadcrumbs sur erreurs API
- DataDog/Posthog éventuel pour funnel events

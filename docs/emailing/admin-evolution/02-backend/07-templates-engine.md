# Templates engine — backend spec

> Module M5.7. Gestion CRUD + résolution de variables + rendering +
> sanitization des templates HTML personnalisés.

## Architecture

```
apps/web/src/lib/mail/templates/
├── catalog.ts                   (existant — étendu)
├── render.ts                    (existant — étendu pour HTML custom)
├── custom/                      ⭐ NEW
│   ├── crud.ts                  CRUD email_template_custom
│   ├── versioning.ts            History + rollback
│   ├── context-resolver.ts      Construit le context d'un email à partir d'un lead
│   ├── variables-catalog.ts     Catalogue + types Zod
│   ├── sanitize.ts              DOMPurify wrapper (server-side)
│   ├── preview.ts               Render avec mock ou real lead
│   └── test-send.ts             Send wrapper avec source=admin.test
└── default-femiglow.html        ⭐ NEW template par défaut
```

## Tables data

### `email_template_custom`

```sql
CREATE TABLE email_template_custom (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,
  description       text,
  subject_tmpl      text NOT NULL,    -- Handlebars OK ({{firstName}})
  preheader_tmpl    text,
  html_source       text NOT NULL,    -- Handlebars HTML
  custom_vars       jsonb NOT NULL DEFAULT '{}',  -- { promoCode: 'X' }
  active_version_id uuid,             -- FK email_template_custom_version
  created_by        text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
```

### `email_template_custom_version`

```sql
CREATE TABLE email_template_custom_version (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid NOT NULL REFERENCES email_template_custom(id) ON DELETE CASCADE,
  version_number  integer NOT NULL,
  subject_tmpl    text NOT NULL,
  preheader_tmpl  text,
  html_source     text NOT NULL,
  custom_vars     jsonb NOT NULL DEFAULT '{}',
  commit_message  text,
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_number)
);

CREATE INDEX idx_template_version_template ON email_template_custom_version(template_id, version_number DESC);
```

## Resolver de contexte

`buildEmailContext(leadEmail, opts) → ResolvedContext`

```typescript
type ResolvedContext = {
  // identité
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  country: string;
  language: string;
  // commerce
  lastOrderId: string;
  lastOrderDate: string;
  lastOrderTotal: string;
  orderCount: number;
  totalSpent: string;
  // date/temps
  today: string;
  tomorrow: string;
  dayOfWeek: string;
  // URLs
  unsubscribeUrl: string;
  shopUrl: string;
  accountUrl: string;
  // trigger (si automation)
  trigger?: {
    eventName: string;
    ts: string;
    properties: Record<string, unknown>;
  };
  // custom vars du template
  [customKey: string]: unknown;
};

export async function buildEmailContext(
  email: string,
  opts?: {
    triggerEvent?: UserEvent;
    customVars?: Record<string, unknown>;
    productContext?: ProductContext;
  }
): Promise<ResolvedContext>;
```

### Sources

1. Query `leads WHERE email = ?` → identité
2. Subquery agrégée `orders` → commerce
3. Query récente `user_event` si trigger ref → trigger
4. URLs construites depuis `env.NEXT_PUBLIC_SITE_URL` + `lib/mail/unsub-token`
5. Dates depuis `date-fns` avec locale `fr`

### Fallbacks

Chaque champ a une stratégie de fallback :
```typescript
const FALLBACKS = {
  firstName: (lead) => 
    lead.firstName || extractFirstNameFromName(lead.name) || 'cliente',
  city: (lead) => lead.city || 'Maroc',
  // ...
};
```

Variables manquantes → `undefined` → Handlebars rend en string vide
(sauf si `{{var | "fallback"}}` syntaxe).

## Renderer

`renderTemplate(template, context) → { subject, html, preheader }`

```typescript
import Handlebars from 'handlebars';
import { sanitizeHtml } from './sanitize';

export function renderTemplate(
  template: EmailTemplate,
  context: ResolvedContext,
): RenderedEmail {
  // 1. Compile Handlebars (cached)
  const subjectFn = compileCached(template.subjectTmpl);
  const preheaderFn = compileCached(template.preheaderTmpl ?? '');
  const htmlFn = compileCached(template.htmlSource);
  
  // 2. Render
  const subject = subjectFn(context);
  const preheader = preheaderFn(context);
  const htmlRaw = htmlFn(context);
  
  // 3. Sanitize HTML (XSS protection)
  const html = sanitizeHtml(htmlRaw);
  
  // 4. Inline CSS si pas déjà inline
  const inlinedHtml = inlineCss(html);  // juice ou équivalent
  
  return { subject, preheader, html: inlinedHtml };
}
```

### Cache de compilation
Map<sha256(source), Handlebars.TemplateDelegate>. Invalidate sur save.

## Sanitization

Handlebars **escape par défaut** (`{{var}}` → HTML-escaped).
Pour injecter du HTML : `{{{var}}}` (triple braces).

L'admin peut écrire `{{{customVar}}}` mais on **sanitize** quand même le résultat final pour protéger contre des `{{{firstName}}}` si firstName contient du HTML hostile.

```typescript
// sanitize.ts
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'html','head','body','meta','title','style','link',
  'table','tr','td','tbody','thead','tfoot',
  'p','a','img','br','hr','span','div',
  'h1','h2','h3','h4','strong','em','i','b','u',
  'ul','ol','li',
  // pas de script, iframe, object, embed, form
];

const ALLOWED_ATTRS = [
  'style','class','href','src','alt','title','width','height',
  'cellpadding','cellspacing','border','align','valign','bgcolor',
  'role','lang','content','name','charset','target','rel',
];

export function sanitizeHtml(raw: string): string {
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
    USE_PROFILES: { html: true },
  });
}
```

## Preview endpoint

POST `/api/admin/emails/templates/[slug]/preview`

Body :
```typescript
{
  htmlSource?: string;    // si fourni, override le template stocké (édition live)
  contextSource: 'mock' | 'real';
  contextEmail?: string;   // si real
  mockId?: 'fatima' | 'hicham' | 'custom';
  customMockVars?: Record<string, unknown>;
}
```

Returns :
```typescript
{
  subject: string;
  html: string;
  preheader: string;
  variablesResolved: { name: string; resolved: boolean; value?: string }[];
  warnings: string[];  // e.g. "variable {{xxx}} unknown"
}
```

Le HTML retourné est utilisable directement dans un iframe sandboxed.

## Test send endpoint

POST `/api/admin/emails/templates/[slug]/test-send`

Body :
```typescript
{
  recipient: string;       // email admin (validation: doit être un admin)
  contextSource: 'mock' | 'real';
  mockId?: string;
  contextEmail?: string;
}
```

Effet :
1. Render template avec contexte choisi
2. `sendTransactional({ template: '__custom_test__', payload, source: 'admin.template-test', idempotencyKey: unique })`
3. Audit log `emailing.template.test_sent`
4. Return `{ outboxId }`

Le `source=admin.template-test` exclut ces sends des stats marketing.

## Variables catalog endpoint

GET `/api/admin/emails/templates/variables-catalog`

Returns la liste complète des variables disponibles avec :
- name
- category (Identité, Commerce, Date, etc.)
- description
- exampleValue
- fallback
- source (DB column ou computed)

Statique (pas de query DB). Cache HTTP 5min.

## Versionning logic

```typescript
async function saveVersion(
  templateId: string,
  data: { subjectTmpl, preheaderTmpl, htmlSource, customVars, commitMessage? },
  adminEmail: string,
): Promise<TemplateVersion> {
  return db.transaction(async (tx) => {
    // 1. Get next version number
    const lastVersion = await tx.query.emailTemplateCustomVersion.findFirst({
      where: eq(emailTemplateCustomVersion.template_id, templateId),
      orderBy: desc(emailTemplateCustomVersion.version_number),
    });
    const nextVersion = (lastVersion?.version_number ?? 0) + 1;
    
    // 2. Insert version
    const [newVersion] = await tx.insert(emailTemplateCustomVersion).values({
      template_id: templateId,
      version_number: nextVersion,
      ...data,
      created_by: adminEmail,
    }).returning();
    
    // 3. Update template to point to new version + mirror latest source
    await tx.update(emailTemplateCustom).set({
      active_version_id: newVersion.id,
      html_source: data.htmlSource,
      subject_tmpl: data.subjectTmpl,
      preheader_tmpl: data.preheaderTmpl,
      custom_vars: data.customVars,
      updated_at: sql`now()`,
    }).where(eq(emailTemplateCustom.id, templateId));
    
    return newVersion;
  });
}
```

### Rollback

```typescript
async function rollbackToVersion(
  templateId: string,
  versionId: string,
  adminEmail: string,
): Promise<void> {
  const version = await getVersion(versionId);
  // Create NEW version copying old (audit trail preserved)
  await saveVersion(templateId, {
    ...version,
    commitMessage: `Rollback to v${version.version_number}`,
  }, adminEmail);
}
```

## Catalogue de templates "starters"

Au moment de créer un nouveau template, l'admin choisit un point de
départ parmi :

```typescript
type TemplateStarter = {
  id: 'blank' | 'default-femiglow' | 'order-confirm' | 'cart-aband' | 'welcome' | 'newsletter';
  name: string;
  description: string;
  htmlSource: string;  // chargé depuis fichier
};
```

Fichiers physiques :
- `apps/web/src/lib/mail/templates/starters/blank.html`
- `apps/web/src/lib/mail/templates/starters/default-femiglow.html` (le grand)
- `apps/web/src/lib/mail/templates/starters/order-confirm.html`
- `apps/web/src/lib/mail/templates/starters/cart-aband.html`
- `apps/web/src/lib/mail/templates/starters/welcome.html`
- `apps/web/src/lib/mail/templates/starters/newsletter.html`

Chacun est un HTML Handlebars valide, conforme charte.

## Validation save

Avant d'enregistrer une version, on valide :
- Subject non vide
- HTML parse OK (jsdom)
- Pas de `<script>` (rejet)
- Pas de `<iframe>` (rejet)
- Variables non-définies → warning (pas blocking)
- Taille < 100 KB (limite spam filter)
- Lighthouse-style check : alt text sur images, lang attribute

Erreurs → 422 avec list d'issues. Warnings → 200 mais avec `warnings[]` dans la response.

## Performance

- Compilation Handlebars : cache LRU 50 templates
- Render p95 : < 50ms
- Preview endpoint p95 : < 200ms (including DB query lead context)
- Test send : < 1s (queue dans outbox, async send)

## Tests

Voir [11-tests/01-jest-unit/templates-engine.test.spec.md](../11-tests/01-jest-unit/templates-engine.test.spec.md).

Couverture clé :
- Resolver avec lead complet / partiel / inexistant
- Fallbacks pour chaque variable
- Sanitization tags interdits
- Versioning increment
- Rollback préserve historique
- Preview avec mock + real

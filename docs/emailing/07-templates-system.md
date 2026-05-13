# 07 — Templates System

> react-email pour les templates versionnés en Git + MJML fallback pour les templates créés directement dans Listmonk WYSIWYG. Variables typées, preview, test send, sync vers Listmonk.

## §1 — Architecture

```
lib/mail/templates/                ← code React de chaque template
├── _shared/                       ← layout, header, footer, atomes
│   ├── BaseLayout.tsx
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Button.tsx
│   ├── Heading.tsx
│   └── Text.tsx
├── contact-acknowledgement.tsx
├── lead-notification.tsx
├── newsletter-confirm.tsx
├── order-confirmation.tsx
├── password-reset.tsx
├── promo-classic.tsx              ← broadcast
├── spring-welcome.tsx             ← broadcast
└── …

lib/mail/catalog.ts                ← inventaire typé (single source of truth)
lib/mail/render.ts                 ← react-email → { html, text, subject }
lib/mail/variables.ts              ← extraction + validation variables
lib/mail/listmonk-sync.ts          ← upsert templates vers Listmonk
```

## §2 — Catalogue typé

`apps/web/src/lib/mail/catalog.ts` :

```ts
import { z } from 'zod';
import ContactAcknowledgement from './templates/contact-acknowledgement';
import OrderConfirmation from './templates/order-confirmation';
// …

export type TemplateMeta<TPayload> = {
  slug: string;
  displayName: string;
  category: 'transactional' | 'broadcast' | 'automation';
  description: string;
  version: number;
  component: React.ComponentType<TPayload>;
  schema: z.ZodSchema<TPayload>;
  subjectFn: (p: TPayload, defaults?: SubjectDefaults) => string;
  sampleData: TPayload;
  variables: VariableSpec[];        // dérivable du schema, explicité pour UI
};

export type VariableSpec = {
  name: string;
  type: 'text' | 'url' | 'image-url' | 'number' | 'date' | 'dynamic';
  required: boolean;
  label: string;
  hint?: string;
  sample: string;
};

const ContactAckPayload = z.object({
  firstName: z.string().min(1),
  messageExcerpt: z.string().min(1),
});

export const TEMPLATE_REGISTRY = {
  'contact-acknowledgement': {
    slug: 'contact-acknowledgement',
    displayName: 'Accusé de contact',
    category: 'transactional',
    description: 'Envoyé après soumission du formulaire de contact.',
    version: 1,
    component: ContactAcknowledgement,
    schema: ContactAckPayload,
    subjectFn: (p) => `Bonjour ${p.firstName}, on a bien reçu ton message`,
    sampleData: { firstName: 'Souheila', messageExcerpt: 'Bonjour, je voudrais …' },
    variables: [
      { name: 'firstName', type: 'dynamic', required: true, label: 'Prénom', sample: 'Souheila' },
      { name: 'messageExcerpt', type: 'text', required: true, label: 'Extrait message', sample: '…' },
    ],
  },
  // … autres templates
} as const satisfies Record<string, TemplateMeta<any>>;

export type TemplateSlug = keyof typeof TEMPLATE_REGISTRY;
export type TemplateRegistry = { [K in TemplateSlug]: z.infer<typeof TEMPLATE_REGISTRY[K]['schema']> };
```

L'usage typé garantit que `sendTransactional({ template: 'contact-acknowledgement', payload: { firstName, messageExcerpt } })` est vérifié à la compile.

## §3 — Render pipeline

`apps/web/src/lib/mail/render.ts` :

```ts
import { render } from '@react-email/render';
import { htmlToText } from 'html-to-text';
import { TEMPLATE_REGISTRY, type TemplateSlug } from './catalog';

export async function renderTemplate<S extends TemplateSlug>(
  slug: S,
  payload: TemplateRegistry[S],
): Promise<{ html: string; text: string; subject: string }> {
  const meta = TEMPLATE_REGISTRY[slug];
  const parsed = meta.schema.parse(payload);  // throws if invalid
  const Component = meta.component;

  const html = await render(<Component {...parsed} />, { pretty: false });
  const text = htmlToText(html, {
    wordwrap: 78,
    selectors: [
      { selector: 'img', format: 'skip' },
      { selector: 'a', options: { ignoreHref: false } },
    ],
  });
  const subject = meta.subjectFn(parsed);

  return { html, text, subject };
}
```

## §4 — Layout partagé (`_shared/BaseLayout.tsx`)

```tsx
import { Html, Head, Body, Container, Section, Hr, Tailwind } from '@react-email/components';
import { Header } from './Header';
import { Footer } from './Footer';

type Props = { preheader?: string; children: React.ReactNode };

export function BaseLayout({ preheader, children }: Props) {
  return (
    <Html lang="fr">
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light only" />
      </Head>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                'brand-sauge': '#7C9A8A',
                'brand-champagne': '#E8D7B4',
                'brand-petale': '#F2C4C9',
                'brand-encre': '#0F2F2A',
                stone: {
                  50: '#FAFAF9', 100: '#F5F5F4', 200: '#E7E5E4',
                  600: '#57534E', 700: '#44403C', 900: '#1C1917',
                },
              },
              fontFamily: {
                sans: ['"Inter"', 'system-ui', 'sans-serif'],
                display: ['"Cormorant Garamond"', 'serif'],
              },
            },
          },
        }}
      >
        <Body className="bg-stone-100 font-sans text-stone-700">
          {preheader && <span className="hidden text-[0]">{preheader}</span>}
          <Container className="my-8 max-w-[600px] rounded-2xl bg-white p-8 shadow-sm">
            <Header />
            <Hr className="my-4 border-stone-200" />
            {children}
            <Hr className="my-6 border-stone-200" />
            <Footer />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
```

Tokens partagés avec le site (sauge, champagne, petale, encre) — assure cohérence visuelle.

## §5 — Exemple template — `contact-acknowledgement.tsx`

```tsx
import { Section, Heading, Text, Button, Link } from '@react-email/components';
import { BaseLayout } from './_shared/BaseLayout';

type Props = { firstName: string; messageExcerpt: string };

export default function ContactAcknowledgement({ firstName, messageExcerpt }: Props) {
  return (
    <BaseLayout preheader={`Bonjour ${firstName}, ton message est bien arrivé chez FemiGlow.`}>
      <Section>
        <Heading className="font-display text-2xl text-brand-encre">Merci, {firstName} ✨</Heading>
        <Text className="mt-4 text-stone-700">
          On a bien reçu ton message — on revient vers toi sous 24 heures (jours ouvrés).
        </Text>
        <Section className="mt-4 rounded-lg bg-stone-50 p-4 italic text-stone-600">
          « {messageExcerpt} »
        </Section>
        <Text className="mt-4 text-stone-700">
          En attendant, tu peux découvrir nos rituels les plus aimés :
        </Text>
        <Button
          href="https://femiglow-maroc.com/rituels"
          className="mt-2 inline-block rounded-md bg-brand-sauge px-5 py-2 text-sm font-medium text-white"
        >
          Découvrir les rituels
        </Button>
      </Section>
    </BaseLayout>
  );
}
```

## §6 — Variables dynamiques

### 6.1 — Distinction "fixe" vs "dynamic"

| Type | Comportement | Exemple |
|---|---|---|
| `fixed` | Valeur unique pour toute la campagne, saisie au step 4 | `discountCode = "PRINTEMPS20"` |
| `dynamic` | Substituée par destinataire au moment du send | `firstName` = champ Listmonk subscriber |

Pour les broadcasts via Listmonk, les variables dynamiques utilisent la syntaxe Listmonk `{{ .Subscriber.FirstName }}` (Go template). Lors du sync template → Listmonk, on **transforme** les placeholders react-email :

```
React (preview only):  Bonjour {{first_name}}
Listmonk runtime:      Bonjour {{ .Subscriber.FirstName }}
```

### 6.2 — Mapping placeholder → Listmonk

`apps/web/src/lib/mail/variables.ts` :

```ts
const DYNAMIC_PLACEHOLDER_MAP: Record<string, string> = {
  '{{first_name}}':    '{{ .Subscriber.FirstName }}',
  '{{email}}':         '{{ .Subscriber.Email }}',
  '{{unsubscribe_url}}': '{{ UnsubscribeURL }}',
};

export function toListmonkPlaceholders(html: string): string {
  return Object.entries(DYNAMIC_PLACEHOLDER_MAP).reduce(
    (acc, [from, to]) => acc.replaceAll(from, to),
    html,
  );
}
```

## §7 — Sync vers Listmonk

À chaque finalisation de campagne (ou save de template broadcast), on **upsert** le template dans Listmonk :

```ts
// lib/mail/listmonk-sync.ts
import { renderTemplate } from './render';
import { toListmonkPlaceholders } from './variables';
import { listmonk } from './listmonk/client';
import { db } from '@/db';
import { emailTemplateMeta } from '@/db/schema/emails';

export async function syncTemplateToListmonk(slug: string, payload: unknown) {
  const meta = TEMPLATE_REGISTRY[slug];
  const { html, subject } = await renderTemplate(slug as any, payload);
  const body = toListmonkPlaceholders(html);

  const dbRow = await db.select().from(emailTemplateMeta).where(eq(emailTemplateMeta.slug, slug)).limit(1);
  if (dbRow[0]?.listmonkTemplateId) {
    await listmonk.templates.update(dbRow[0].listmonkTemplateId, {
      name: meta.displayName,
      type: 'campaign',
      subject,
      body,
    });
  } else {
    const created = await listmonk.templates.create({
      name: meta.displayName,
      type: 'campaign',
      subject,
      body,
    });
    await db.update(emailTemplateMeta).set({
      listmonkTemplateId: created.data.id,
      syncedAt: new Date(),
    }).where(eq(emailTemplateMeta.slug, slug));
  }
}
```

Idempotent : ré-appel = update. Si Listmonk down → exception remontée, l'admin voit le toast d'erreur (cf. wizard §8.3).

## §8 — Studio templates `/admin/emails/templates`

### 8.1 — Vue liste

Voir mock dans `05-ui-ux-design.md` §9.3.

### 8.2 — Éditeur

Deux modes selon catégorie :

| Catégorie | Source | Éditeur |
|---|---|---|
| `transactional` | Code react-email en `lib/mail/templates/*.tsx` | **Read-only** dans l'UI admin (le code est en Git, modifié par dev). UI = preview + variables + history. |
| `broadcast` | Idem ou créé via Listmonk WYSIWYG (HTML libre) | **Hybride** : si défini en TSX, read-only. Si pure Listmonk, l'éditeur ouvre l'iframe Listmonk template editor. |
| `automation` | Idem `transactional` | Read-only. |

### 8.3 — Layout éditeur

```
┌──────────────────────────────────────────────────────────────────┐
│ Template : Contact Acknowledgement                                │
│ Catégorie : transactionnel  •  Version : 1  •  Statut : actif    │
│                                                                   │
│ [Aperçu] [Variables] [Historique] [Code source]                   │
├──────────────────────────────────────────────────────────────────┤
│ Aperçu                                                            │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ [Desktop] [Mobile]                                         │   │
│ │ ┌───────────────────────────────────────────────────────┐  │   │
│ │ │ [iframe preview]                                      │  │   │
│ │ └───────────────────────────────────────────────────────┘  │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│ Données de test                                                   │
│ firstName : [Souheila__________]                                  │
│ messageExcerpt : [Bonjour, je voudrais …___]                      │
│ [↻ Rafraîchir aperçu]                                             │
│                                                                   │
│ Envoyer un test                                                   │
│ Destinataire : [me@__________________]  [Envoyer]                 │
│                                                                   │
│ ⚠ Code source modifiable uniquement via le repo Git.              │
└──────────────────────────────────────────────────────────────────┘
```

### 8.4 — Historique

Affiche les changements de version (`version` bumped manuellement par le dev dans `catalog.ts`) avec date, auteur (depuis git log si exposable côté admin), et lien vers le diff.

Implémentation light : lit `email_template_meta` + git log filtré sur `apps/web/src/lib/mail/templates/{slug}.tsx`.

## §9 — Test send

Endpoint : `POST /api/admin/emails/templates/:slug/test-send`

```ts
// Idempotency key: test-send:template:slug:adminId:timestamp
await sendTransactional({
  template: slug,
  to: { email: recipient },
  payload: testData,
  idempotencyKey: `test:${slug}:${adminId}:${Date.now()}`,
  source: 'admin.template.test',
});
```

UI affiche un toast et un suivi (`X-FG-Outbox-Id` → lien vers détail outbox).

## §10 — MJML fallback (templates créés dans Listmonk)

Pour les templates créés directement dans Listmonk (WYSIWYG, sans code TSX) :
- Stockés uniquement côté Listmonk (DB Listmonk).
- Référencés dans `email_template_meta` avec `slug` = `listmonk:{listmonk_template_id}` et `category = 'broadcast'`.
- Pas de variables typées TS — le wizard fait confiance à Listmonk pour parser le HTML et extraire `{{ .X.Y }}`.
- Indiqué dans le studio : "Géré dans Listmonk — [Ouvrir l'éditeur Listmonk ↗]".

## §11 — Versioning & breaking changes

| Changement | Action |
|---|---|
| Modification cosmétique (texte, couleur) | Bump `version` dans `catalog.ts` (1 → 2). Pas de migration. |
| Ajout variable optionnelle | Bump `version`. Backward-compat (l'absence de variable → fallback). |
| Suppression / renommage variable required | **Breaking**. Bump major. Plan : nouveau slug `contact-acknowledgement-v2`, déprécier l'ancien (active=false), réorienter les appels. |
| Suppression template | `active=false`, garder en DB pour audit. Si plus utilisé > 90 j → archive sur S3. |

## §12 — Performance

- Render réactif côté serveur : ~30 ms par template (mesure react-email).
- `getTransporter()` singleton pour ne pas re-créer la connection pool.
- HTML output : minified post-render via `html-minifier-terser` (réduction ~30 %, mais attention aux email clients).
- Inline CSS : géré par Tailwind react-email (déjà inline).

## §13 — Tests templates

| Niveau | Test | Couvre |
|---|---|---|
| Unit Jest | `renderTemplate('contact-acknowledgement', sampleData)` → no throw, HTML valide, text non vide, subject non vide | Render pipeline |
| Unit Jest | Schema rejette payload invalide | Validation Zod |
| Unit Jest | `toListmonkPlaceholders` transforme correctement | Mapping placeholders |
| Snapshot Jest | HTML output strictement équivalent à snapshot précédent | Détecte régression visuelle texte |
| Integration | `syncTemplateToListmonk` via MSW → Listmonk API call observé | Sync |
| E2E Playwright | Studio templates : sélection + preview + test send | UX |
| Visual regression (Playwright) | Screenshot du preview iframe sur 3 templates | Détecte régression CSS |

Détaillé dans `08-tests-strategy.md` §5.

## §14 — Conventions de naming

- Slug : `kebab-case` minuscule, descriptif court (ex. `contact-acknowledgement`, pas `cae` ni `confirmation_contact`).
- Display name : phrase humaine en FR (ex. "Accusé de contact").
- Catégorie : 1 parmi `transactional | broadcast | automation`.
- Subject : verb-first, max 78 chars, inclut emoji uniquement si la marque l'autorise (footer de comm.).
- Variables : `camelCase` (TS) ↔ `{{snake_case}}` à l'affichage UI (transformation triviale).

## §15 — Références

- react-email docs : https://react.email/docs/introduction
- Catalogue : `lib/mail/catalog.ts` (à créer)
- Brand tokens : `tailwind.config.ts` + `docs/preparation/02-design-system.md`
- Wizard variables UI : `06-wizard-specification.md` §6
- Tests : `08-tests-strategy.md` §5

# F2 — Helpers RSC : `<ComponentField>` et `resolveComponentFields`

## Contrat

> Le rendu public d'un composant **n'importe pas** de littéraux
> éditoriaux. Il appelle `<ComponentField>` ou `resolveComponentField`
> qui exécutent la cascade A3 (binding publié ▸ `defaultValue` du
> registre) et renvoient la valeur typée.

Tout est `server-only` : ni le client ni MSW ne touchent à ce
résolveur (le client lit l'admin via REST, cf. B1).

## Surface API

| Symbole | Type | Usage |
|---|---|---|
| `<ComponentField componentKey fieldKey />` | RSC component | Insertion directe dans un JSX RSC. |
| `resolveComponentField(componentKey, fieldKey, locale?)` | async fn | Lecture programmée (rare). |
| `resolveComponentFields(componentKey, locale?)` | async fn | Lecture batchée (recommandé pour ≥ 2 champs d'un même composant). |
| `<ComponentFieldsProvider componentKey>` | RSC | Préfetch + cache contextuel pour éviter N queries. |
| `resolveComponentFieldsDraft(componentKey, locale?)` | async fn | **Preview admin uniquement** (cf. F4). |

Tous exportés depuis `@/lib/components/field-resolver` et
`@/lib/components/ComponentField`.

## `<ComponentField>` — usage

```tsx
// apps/web/src/components/sections/Hero.tsx
import { ComponentField } from '@/lib/components/ComponentField';
import { ComponentMedia } from '@/lib/components/ComponentMedia';

export function Hero(): JSX.Element {
  return (
    <section className="hero">
      <ComponentField componentKey="home-hero" fieldKey="kicker" />
      <h1>
        <ComponentField componentKey="home-hero" fieldKey="title" />
      </h1>
      <p>
        <ComponentField componentKey="home-hero" fieldKey="subtitle" />
      </p>
      <ComponentField componentKey="home-hero" fieldKey="cta" />
      <ComponentMedia componentKey="home-hero" slot="primary" />
    </section>
  );
}
```

Pour un champ structuré (`cta`, `quote`, …), `<ComponentField>` rend
le markup approprié — pas un objet brut. Le `FieldType` détermine le
renderer interne (cf. table « Renderers » plus bas).

## Implémentation

```tsx
// apps/web/src/lib/components/ComponentField.tsx
import 'server-only';
import { resolveComponentField } from './field-resolver';
import { FieldRenderer } from './FieldRenderer';

interface ComponentFieldProps {
  componentKey: string;
  fieldKey: string;
  locale?: string;
  /** Surcharge l'élément wrapper (par défaut : aucun, on rend inline). */
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  /** Si true, retourne null silencieusement quand value=null.
   *  Si false (défaut), affiche un placeholder dev. */
  silentEmpty?: boolean;
}

export async function ComponentField({
  componentKey,
  fieldKey,
  locale = 'fr',
  as,
  className,
  silentEmpty,
}: ComponentFieldProps): Promise<JSX.Element | null> {
  const resolved = await resolveComponentField(componentKey, fieldKey, locale);

  if (resolved.value === null) {
    if (silentEmpty || process.env.NODE_ENV === 'production') {
      return null;
    }
    return (
      <span className="field-dev-placeholder" data-key={`${componentKey}/${fieldKey}`}>
        [field {componentKey}/{fieldKey} — null]
      </span>
    );
  }

  return (
    <FieldRenderer
      type={resolved.fieldDef.type}
      value={resolved.value}
      as={as}
      className={className}
    />
  );
}
```

### Renderers internes

`FieldRenderer` est un `switch` pur sur `FieldType`. Aucune logique
business, juste du JSX :

| Type | Rendu |
|---|---|
| `text`, `kicker`, `multiline` | `<As>{value}</As>` (default `<>` fragment) |
| `rich-text` | `<div dangerouslySetInnerHTML>` après `marked()` + `sanitize-html` server-side (cf. B2) |
| `cta` | `<CTA href label variant icon />` (composant existant) |
| `link` | `<Link href external>{label}</Link>` |
| `icon` | `<Icon name={value} />` |
| `color-token` | non rendu directement ; consommé via `style={{ background: var(--color-${value}) }}` côté composant parent |
| `number`, `boolean`, `enum` | `{String(value)}` (rare en rendu direct ; usuellement consommé via `resolveComponentField`) |
| `list` | `<ul>{items.map(item => <FieldRenderer ...>)}</ul>` |
| `record` | jamais rendu directement (consommer via `resolveComponentField`) |
| `quote` | `<blockquote>{text}<cite>{author}</cite></blockquote>` |
| `breadcrumb-segment` | `<Link href>{label}</Link>` |

## `resolveComponentField` (lecture programmée)

```tsx
// apps/web/src/lib/components/field-resolver.ts
import 'server-only';
import { unstable_cache } from 'next/cache';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import { getPublishedBinding } from '@/lib/db/queries/component-fields';
import { decodeValue } from './field-encoding';
import type { ResolvedField } from './types';

export const resolveComponentField = unstable_cache(
  async (
    componentKey: string,
    fieldKey: string,
    locale = 'fr',
  ): Promise<ResolvedField> => {
    const component = await getSiteComponentByKey(componentKey);
    if (!component) return missing(componentKey, fieldKey);

    const fieldDef = component.fields.find((f) => f.key === fieldKey);
    if (!fieldDef) return unknown(componentKey, fieldKey);

    const binding = await getPublishedBinding(component.id, fieldKey, locale);
    if (binding) {
      return {
        fieldDef,
        value: decodeValue(binding.value, fieldDef.type),
        meta: {
          source: 'binding',
          bindingId: binding.id,
          version: binding.version,
          publishedAt: binding.publishedAt,
          locale: binding.locale,
        },
      };
    }
    if (fieldDef.defaultValue !== undefined) {
      return {
        fieldDef,
        value: fieldDef.defaultValue,
        meta: { source: 'default', version: 0 },
      };
    }
    return { fieldDef, value: null, meta: { source: 'none', version: 0 } };
  },
  ['component-field'],
  { tags: (k, f) => ['components', `components:fields:${k}`] },
);
```

Cf. B3 pour la stratégie de cache et l'invalidation.

## `resolveComponentFields` (batché)

Quand un composant lit ≥ 2 champs, **toujours** préférer la version
batchée : un seul SELECT, un seul cache hit.

```tsx
// apps/web/src/lib/components/field-resolver.ts
export const resolveComponentFields = unstable_cache(
  async (componentKey: string, locale = 'fr'): Promise<ResolvedFields> => {
    const component = await getSiteComponentByKey(componentKey);
    if (!component) return {};

    const bindings = await listPublishedBindings(component.id, locale);
    const byKey = new Map(bindings.map((b) => [b.fieldKey, b]));

    const out: ResolvedFields = {};
    for (const fieldDef of component.fields) {
      const b = byKey.get(fieldDef.key);
      out[fieldDef.key] = b
        ? {
            fieldDef,
            value: decodeValue(b.value, fieldDef.type),
            meta: { source: 'binding', bindingId: b.id, version: b.version, publishedAt: b.publishedAt, locale: b.locale },
          }
        : {
            fieldDef,
            value: fieldDef.defaultValue ?? null,
            meta: { source: fieldDef.defaultValue !== undefined ? 'default' : 'none', version: 0 },
          };
    }
    return out;
  },
  ['component-fields-batch'],
  { tags: (k) => ['components', `components:fields:${k}`] },
);
```

Usage type :

```tsx
import { resolveComponentFields } from '@/lib/components/field-resolver';

export async function Hero(): Promise<JSX.Element> {
  const fields = await resolveComponentFields('home-hero');
  const title = fields.title?.value as string;
  const subtitle = fields.subtitle?.value as string;
  const cta = fields.cta?.value as { label: string; href: string };
  return (
    <section style={{ background: `var(--color-${fields.bgToken?.value ?? 'creme'})` }}>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {cta ? <CTA {...cta} /> : null}
    </section>
  );
}
```

## `<ComponentFieldsProvider>` (déduplication)

Si **plusieurs** sous-composants RSC d'un même composant utilisent
`<ComponentField>` séparément, on évite N lookups DB en plaçant un
provider qui préfetch :

```tsx
// apps/web/src/lib/components/ComponentFieldsProvider.tsx
import 'server-only';
import { createContext } from 'react';
import { resolveComponentFields } from './field-resolver';
import type { ResolvedFields } from './types';

export const ComponentFieldsContext = createContext<ResolvedFields | null>(null);

interface Props {
  componentKey: string;
  locale?: string;
  children: React.ReactNode;
}

export async function ComponentFieldsProvider({
  componentKey,
  locale = 'fr',
  children,
}: Props): Promise<JSX.Element> {
  const fields = await resolveComponentFields(componentKey, locale);
  return (
    <ComponentFieldsContext.Provider value={fields}>
      {children}
    </ComponentFieldsContext.Provider>
  );
}
```

`<ComponentField>` consulte d'abord le contexte (s'il existe), sinon
appelle `resolveComponentField` :

```tsx
// dans ComponentField.tsx
import { useContext } from 'react';
import { ComponentFieldsContext } from './ComponentFieldsProvider';

const ctx = useContext(ComponentFieldsContext);
const resolved = ctx?.[fieldKey] ?? (await resolveComponentField(componentKey, fieldKey, locale));
```

Note : Next.js dedupe déjà les `unstable_cache` au niveau request.
Le provider apporte de la **lisibilité** plus que de la perf.

## Fallback rendering

| `value` | `fallbackToDefault` | `NODE_ENV=development` | `NODE_ENV=production` |
|---|---|---|---|
| Valeur définie | n/a | rendu normal | rendu normal |
| `null` | `true` (défaut) | placeholder dev visible | rien (silencieux) |
| `null` | `false` | placeholder dev visible | placeholder dev visible (debug) |
| Composant inconnu | n/a | placeholder rouge | rien |
| Champ inconnu | n/a | placeholder rouge | rien |

Le placeholder dev est minimaliste : `<span className="field-dev-placeholder">[home-hero/title — null]</span>`,
stylé en rose vif avec une bordure pointillée pour qu'on ne le rate
pas en preview. Jamais visible en prod (gated `NODE_ENV`).

## Cache et invalidation

Cf. B3 pour le détail. Récap :

- Tags : `components` (existant, nucléaire) + `components:fields:<key>` (par composant).
- Invalidation : `revalidateTag` sur les deux dans `POST /publish`.
- Le rendu RSC consomme `unstable_cache` ; aucun appel direct à la DB n'est fait sans cache.

## Cross-références

- A2 : encodage `value` jsonb.
- A3 : algorithme cascade complet, edge cases.
- F1 : éditeurs admin (équivalent côté write).
- F4 : `resolveComponentFieldsDraft` pour la preview iframe.
- B3 : stratégie de cache et tags.

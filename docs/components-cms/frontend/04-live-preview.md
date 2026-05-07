# F4 — Live preview iframe

## Contrat

> Pendant qu'un admin édite un composant dans `/admin/components/[key]`,
> il voit **à droite** une iframe qui rend le composant avec les
> valeurs **draft** (et non publiées). Chaque modification est
> répercutée dans la preview en < 250 ms via `postMessage`.

La preview est une **route RSC dédiée** (pas un Storybook, pas un
sandbox). Le rendu est strictement le même qu'en prod, à un détail
près : le résolveur lit les drafts au lieu des published.

## Surface

| Élément | Type | Rôle |
|---|---|---|
| `/admin/components/[key]/preview` | RSC page | Page rendue dans l'iframe ; lit les drafts. |
| `<PreviewFrame>` | Client component | iframe + listener postMessage côté admin parent. |
| `resolveComponentFieldsDraft(componentKey)` | server-only fn | Résolveur draft (variant de F2). |

## Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│  /admin/components/[key]   (page admin)                                │
│                                                                         │
│  ┌──────────────────────────────┐ ┌──────────────────────────────────┐ │
│  │ Form panel (F1 + F3)         │ │ <PreviewFrame>                   │ │
│  │                              │ │   ↓                              │ │
│  │  useFieldForm()              │ │  <iframe src="/admin/.../preview"│ │
│  │   ├── onChange ─┐            │ │           ?w=desktop">           │ │
│  │   └── publish() │            │ │   ↑                              │ │
│  │                 ▼            │ │  postMessage('FIELDS_CHANGED',…) │ │
│  │  postMessage('FIELDS_CHANGED'│ │  postMessage('SCROLL_TO_FIELD',…)│ │
│  │              , …)            │ │                                  │ │
│  └──────────────────────────────┘ └──────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
                                                       │
                                                       │ Inside iframe :
                                                       ▼
       ┌──────────────────────────────────────────────────────────────┐
       │  /admin/components/[key]/preview  (RSC)                       │
       │                                                                │
       │   server : resolveComponentFieldsDraft('home-hero')           │
       │     → injecte dans le composant                               │
       │                                                                │
       │   client : <PreviewListener>                                  │
       │     onmessage('FIELDS_CHANGED') → router.refresh() debounced  │
       │     onmessage('SCROLL_TO_FIELD') → scrollIntoView(`[data-key]`)│
       └──────────────────────────────────────────────────────────────┘
```

## Route preview RSC

```tsx
// apps/web/src/app/admin/components/[key]/preview/page.tsx
import { resolveComponentFieldsDraft } from '@/lib/components/field-resolver';
import { renderComponentByKey } from '@/lib/components/render-by-key';
import { PreviewListener } from '@/components/admin/components/PreviewListener';

interface PageProps {
  params: { key: string };
  searchParams: { w?: 'mobile' | 'tablet' | 'desktop' };
}

// Volontairement pas de cache : la preview lit toujours frais.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PreviewPage({ params, searchParams }: PageProps): Promise<JSX.Element> {
  const fields = await resolveComponentFieldsDraft(params.key);
  const width = searchParams.w ?? 'desktop';

  return (
    <html lang="fr" data-preview>
      <body data-width={width}>
        <main className={`preview preview--${width}`}>
          {await renderComponentByKey(params.key, { fields })}
        </main>
        <PreviewListener componentKey={params.key} />
      </body>
    </html>
  );
}
```

`renderComponentByKey` est un dispatcher qui mappe `componentKey →
RSC component`. Identique au rendu prod pour la page hôte.

## `resolveComponentFieldsDraft`

Variant non-caché du résolveur F2 :

```ts
// apps/web/src/lib/components/field-resolver.ts
import 'server-only';

/**
 * Résolveur DRAFT — utilisé exclusivement par /admin/.../preview.
 * Aucun cache : on veut toujours frais.
 * Cascade : draft (s'il existe) ▸ published ▸ defaultValue.
 */
export async function resolveComponentFieldsDraft(
  componentKey: string,
  locale = 'fr',
): Promise<ResolvedFields> {
  const component = await getSiteComponentByKey(componentKey);
  if (!component) return {};

  const drafts = await listDraftBindings(component.id, locale);
  const published = await listPublishedBindings(component.id, locale);

  const draftByKey = new Map(drafts.map((b) => [b.fieldKey, b]));
  const publishedByKey = new Map(published.map((b) => [b.fieldKey, b]));

  const out: ResolvedFields = {};
  for (const fieldDef of component.fields) {
    const d = draftByKey.get(fieldDef.key);
    const p = publishedByKey.get(fieldDef.key);
    const chosen = d ?? p;
    out[fieldDef.key] = chosen
      ? {
          fieldDef,
          value: decodeValue(chosen.value, fieldDef.type),
          meta: {
            source: d ? 'draft' : 'binding',
            bindingId: chosen.id,
            version: chosen.version,
            locale: chosen.locale,
            publishedAt: chosen.publishedAt,
          },
        }
      : {
          fieldDef,
          value: fieldDef.defaultValue ?? null,
          meta: { source: fieldDef.defaultValue !== undefined ? 'default' : 'none', version: 0 },
        };
  }
  return out;
}
```

> **Important** : ce résolveur est **server-only** et appelé
> **uniquement** dans `/admin/.../preview`. Le rendu public utilise
> `resolveComponentFields` (F2). Toute fuite du résolveur draft hors
> de cette route serait un bug : elle exposerait des contenus non
> publiés au public.

## Protocole postMessage

```ts
// apps/web/src/components/admin/components/preview-protocol.ts
export const PREVIEW_ORIGIN = window.location.origin; // toujours same-origin

export type PreviewMessage =
  /** Le iframe annonce qu'il a hydraté et est prêt à recevoir des messages. */
  | { type: 'PREVIEW_READY'; componentKey: string }
  /** Parent → iframe : un ou plusieurs champs ont changé. Debounced 200 ms. */
  | { type: 'FIELDS_CHANGED'; componentKey: string }
  /** Parent → iframe : focus sur un champ → scroll dans la preview vers la zone DOM correspondante. */
  | { type: 'SCROLL_TO_FIELD'; componentKey: string; fieldKey: string }
  /** Iframe → parent : l'admin a cliqué sur un élément, propose d'éditer ce champ. */
  | { type: 'FIELD_CLICKED'; componentKey: string; fieldKey: string };
```

### Sécurité

- Toujours vérifier `event.origin === PREVIEW_ORIGIN`.
- Toujours vérifier `event.data?.componentKey === currentComponentKey`.
- Schéma Zod côté handler (paranoïa, l'iframe est trustable mais on
  ne paie rien à valider).

## Côté parent (admin page)

```tsx
// apps/web/src/components/admin/components/PreviewFrame.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { PreviewMessage } from './preview-protocol';

const FIELDS_CHANGED_DEBOUNCE_MS = 200;

interface Props {
  componentKey: string;
  /** Signal externe : incrémenté à chaque dirty change pour déclencher debounce. */
  changeTick: number;
}

type Width = 'mobile' | 'tablet' | 'desktop';

export function PreviewFrame({ componentKey, changeTick }: Props): JSX.Element {
  const ref = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState<Width>('desktop');

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data as PreviewMessage;
      if (data?.type === 'PREVIEW_READY' && data.componentKey === componentKey) {
        setReady(true);
      }
      if (data?.type === 'FIELD_CLICKED' && data.componentKey === componentKey) {
        // expose un callback ou un event pour focuser le bon FieldRow côté admin
        document.dispatchEvent(
          new CustomEvent('admin:focus-field', { detail: { fieldKey: data.fieldKey } }),
        );
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [componentKey]);

  // Debounce envoi du FIELDS_CHANGED
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      ref.current?.contentWindow?.postMessage(
        { type: 'FIELDS_CHANGED', componentKey } satisfies PreviewMessage,
        window.location.origin,
      );
    }, FIELDS_CHANGED_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [changeTick, componentKey, ready]);

  return (
    <div className="preview-frame">
      <WidthToggle value={width} onChange={setWidth} />
      <iframe
        ref={ref}
        src={`/admin/components/${componentKey}/preview?w=${width}`}
        title={`Preview ${componentKey}`}
        className={`preview-iframe preview-iframe--${width}`}
        sandbox="allow-same-origin allow-scripts"
      />
    </div>
  );
}
```

`changeTick` est issu du form engine (cf. F3) : un compteur
incrémenté à chaque dispatch `FIELD_CHANGED`. On évite ainsi de
dépendre de `state.fields` (lourd) dans la dépendance du `useEffect`.

## Côté iframe (PreviewListener)

```tsx
// apps/web/src/components/admin/components/PreviewListener.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PreviewMessage } from './preview-protocol';

interface Props {
  componentKey: string;
}

export function PreviewListener({ componentKey }: Props): JSX.Element | null {
  const router = useRouter();

  useEffect(() => {
    // Annonce ready au parent
    window.parent?.postMessage(
      { type: 'PREVIEW_READY', componentKey } satisfies PreviewMessage,
      window.location.origin,
    );

    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data as PreviewMessage;
      if (data?.type === 'FIELDS_CHANGED' && data.componentKey === componentKey) {
        // Re-render serveur : router.refresh ré-exécute le RSC,
        // qui ré-appelle resolveComponentFieldsDraft (non-caché).
        router.refresh();
      }
      if (data?.type === 'SCROLL_TO_FIELD' && data.componentKey === componentKey) {
        const el = document.querySelector(`[data-field-key="${data.fieldKey}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [componentKey, router]);

  return null;
}
```

Pour que `SCROLL_TO_FIELD` fonctionne, chaque `<ComponentField>` rendu
dans la preview annote son DOM : on ajoute (uniquement en preview)
un wrapper `<span data-field-key={fieldKey}>` autour du rendu (gated
par `data-preview` sur `<html>`).

## Cache

| Élément | Stratégie |
|---|---|
| `resolveComponentFieldsDraft` | **non caché** — toujours frais. |
| Page `/admin/.../preview` | `dynamic = 'force-dynamic'`, `revalidate = 0`. |
| Resources publiques (CSS, fonts) | cache normal du navigateur — c'est juste du HTML qui n'est pas caché. |

`router.refresh()` ré-exécute la page côté serveur. C'est exactement
ce qu'on veut : le draft change, on relit, on re-rend.

## Layout admin

| Breakpoint | Layout |
|---|---|
| ≥ 1280 px | side-by-side : 480px form / reste preview, séparés par une poignée draggable (réglable 320–640 px). |
| 960–1279 px | side-by-side avec ratio 50/50 fixe. |
| < 960 px | empilé : preview en haut (300 px max), form en dessous, scroll vertical. |

### Toggle largeur preview

Au-dessus de l'iframe, 3 boutons (`Mobile 375` / `Tablet 768` /
`Desktop 100%`) qui ne re-fetch pas — ils changent juste la query
`?w=` et la `width` du iframe. Le RSC peut adapter le rendu si
nécessaire (rare : la plupart du temps, le composant est responsive
et la largeur du iframe suffit).

```tsx
function WidthToggle({ value, onChange }: { value: Width; onChange: (w: Width) => void }) {
  return (
    <div role="radiogroup" aria-label="Largeur de la preview" className="width-toggle">
      {(['mobile', 'tablet', 'desktop'] as const).map((w) => (
        <button
          key={w}
          role="radio"
          aria-checked={value === w}
          onClick={() => onChange(w)}
        >
          {w === 'mobile' ? '375' : w === 'tablet' ? '768' : '100%'}
        </button>
      ))}
    </div>
  );
}
```

Largeurs réelles du iframe :

| Toggle | iframe `width` |
|---|---|
| `mobile` | 375 px |
| `tablet` | 768 px |
| `desktop` | 100 % du panneau preview |

## Edge cases

| Cas | Comportement |
|---|---|
| Iframe pas encore prêt quand `FIELDS_CHANGED` arrive | Le parent attend `PREVIEW_READY` avant d'envoyer. |
| Network drop durant `router.refresh()` | Le RSC de Next gère ; le DOM précédent reste affiché. |
| Plusieurs iframes (multi-tab) | Chaque iframe vérifie `componentKey` et ignore les messages d'un autre composant. |
| Composant supprimé du registre pendant édition | RSC retourne 404 → iframe affiche un message `<pre>Composant introuvable</pre>`, le parent l'apprend via `FIELD_CLICKED` jamais émis ; le form panel reçoit un 404 sur le PATCH suivant et clôt l'écran. |

## Tests dédiés

| Test | Sujet |
|---|---|
| `preview-listener.spec.ts` (RTL) | listener postMessage, refresh debounced |
| `preview-frame.spec.ts` (RTL) | rendu iframe, debounce 200 ms |
| `preview-resolver.spec.ts` (Vitest) | cascade draft ▸ published ▸ default |
| `preview.e2e.spec.ts` (Playwright) | parcours dirty → preview rafraîchit |

## Cross-références

- A3 : cascade publique (draft est exclu).
- A4 : statut `draft` source de cette résolution.
- F1, F2, F3 : autres briques côté admin et côté rendu.
- B3 : pourquoi pas de cache sur cette route.

/**
 * `<ComponentField>` — RSC wrapper qui résout un champ via la cascade A3
 * et le rend (placeholder pour P3 — un FieldRenderer riche viendra ensuite).
 *
 *   <ComponentField componentKey="home-hero" fieldKey="title" />
 *   <ComponentField componentKey="home-hero" fieldKey="cta">
 *     {(value, meta) => <CTA {...(value as CTAValue)} />}
 *   </ComponentField>
 *
 * Cf. docs/components-cms/frontend/02-rsc-helpers.md
 */
import 'server-only';
import type { ReactNode } from 'react';
import { resolveComponentField } from './field-resolver';
import type { ResolvedField } from '@/lib/db/types';

type RenderFn = (
  value: unknown,
  meta: ResolvedField['meta'],
) => ReactNode;

interface ComponentFieldProps {
  componentKey: string;
  fieldKey: string;
  locale?: string;
  /** Render prop : reçoit (value, meta). Si absent, rendu par défaut. */
  children?: RenderFn | ReactNode;
  /** Affiché si la valeur résolue est `null`. */
  fallback?: ReactNode;
}

const STRUCTURED_TYPES = new Set([
  'cta',
  'link',
  'list',
  'record',
  'quote',
  'breadcrumb-segment',
]);

function renderValue(value: unknown, type: string | null): ReactNode {
  if (value === null || value === undefined) return null;
  if (type && STRUCTURED_TYPES.has(type)) {
    return <span data-cms-structured>{JSON.stringify(value)}</span>;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return <span data-cms-structured>{JSON.stringify(value)}</span>;
}

export async function ComponentField({
  componentKey,
  fieldKey,
  locale = 'fr',
  children,
  fallback,
}: ComponentFieldProps): Promise<ReactNode> {
  const resolved = await resolveComponentField(componentKey, fieldKey, locale);

  // Render prop : on délègue au consommateur.
  if (typeof children === 'function') {
    return (children as RenderFn)(resolved.value, resolved.meta);
  }

  // Dev-time placeholder : champ requis non résolu.
  if (
    process.env.NODE_ENV === 'development' &&
    resolved.meta.source === 'none' &&
    resolved.value === null
  ) {
    return (
      <span data-cms-missing data-component={componentKey} data-field={fieldKey}>
        [missing: {componentKey}/{fieldKey}]
      </span>
    );
  }

  if (resolved.value === null) {
    if (fallback !== undefined) return fallback;
    return null;
  }

  // Pas de fieldDef à dispo via resolveComponentField (la cascade ne l'expose
  // pas). On rend en mode "best-effort" — les structured types sont dumpés.
  return renderValue(resolved.value, null);
}

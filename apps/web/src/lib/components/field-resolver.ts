/**
 * Components-CMS — résolveur de champs éditoriaux (Phase P3).
 *
 * Implémente la cascade A3 : binding `published` ▸ `defaultValue` du registre ▸ `null`.
 * Cf. docs/components-cms/architecture/03-cascade-and-resolution.md
 *
 * - `resolveComponentField` / `resolveComponentFields` : lecture publique RSC,
 *   cachée via `unstable_cache` avec tags granulaires (per componentKey/locale).
 * - `resolveComponentFieldsDraft` : utilisé UNIQUEMENT par la preview iframe
 *   admin (cf. F4) — JAMAIS cachée, lit le draft quand il existe.
 * - `diagnoseComponentFields` : diagnostic dev/runbook (R5).
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  getPublishedBinding,
  listBindingsByComponent,
  listPublishedBindings,
} from '@/lib/db/queries/component-fields';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import { decodeValue } from './fields/encoding';
import type {
  ComponentFieldBinding,
  ComponentFieldDefinition,
  ResolvedField,
  ResolvedFields,
} from '@/lib/db/types';

/* ────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────── */

function tagsFor(componentKey: string, locale: string): string[] {
  return [
    'components',
    `components:fields:${componentKey}`,
    `components:fields:${componentKey}:${locale}`,
  ];
}

function bindingResolved(
  fieldDef: ComponentFieldDefinition,
  binding: ComponentFieldBinding,
): ResolvedField {
  return {
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

function defaultResolved(
  fieldDef: ComponentFieldDefinition,
  locale: string,
): ResolvedField {
  return {
    value: fieldDef.defaultValue ?? null,
    meta: { source: 'default', version: 0, locale },
  };
}

function noneResolved(
  fieldDef: ComponentFieldDefinition,
  locale: string,
): ResolvedField {
  if (fieldDef.required && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      `[components-cms] field '${fieldDef.key}' is required but has no binding and no defaultValue (locale=${locale})`,
    );
  }
  return {
    value: null,
    meta: { source: 'none', version: 0, locale },
  };
}

function pickResolved(
  fieldDef: ComponentFieldDefinition,
  binding: ComponentFieldBinding | null | undefined,
  locale: string,
): ResolvedField {
  if (binding) return bindingResolved(fieldDef, binding);
  if (fieldDef.defaultValue !== undefined) return defaultResolved(fieldDef, locale);
  return noneResolved(fieldDef, locale);
}

/* ────────────────────────────────────────────────────────────────────────
 * Single-field resolver (cachée)
 *
 * Memoize the cached wrapper per (componentKey, locale) so the tags are
 * narrow enough to revalidate granularly via `revalidateTag`.
 * ──────────────────────────────────────────────────────────────────────── */

const fieldCacheByKey = new Map<
  string,
  (componentKey: string, fieldKey: string, locale: string) => Promise<ResolvedField>
>();

async function resolveSingle(
  componentKey: string,
  fieldKey: string,
  locale: string,
): Promise<ResolvedField> {
  const component = await getSiteComponentByKey(componentKey);
  if (!component) {
    return { value: null, meta: { source: 'none', version: 0, locale } };
  }
  const fieldDef = component.fields.find((f) => f.key === fieldKey);
  if (!fieldDef) {
    return { value: null, meta: { source: 'none', version: 0, locale } };
  }
  const binding = await getPublishedBinding(component.id, fieldKey, locale);
  return pickResolved(fieldDef, binding, locale);
}

export async function resolveComponentField(
  componentKey: string,
  fieldKey: string,
  locale = 'fr',
): Promise<ResolvedField> {
  const cacheKey = `${componentKey}::${locale}`;
  let cached = fieldCacheByKey.get(cacheKey);
  if (!cached) {
    cached = unstable_cache(resolveSingle, ['component-field', componentKey, locale], {
      tags: tagsFor(componentKey, locale),
    });
    fieldCacheByKey.set(cacheKey, cached);
  }
  return cached(componentKey, fieldKey, locale);
}

/* ────────────────────────────────────────────────────────────────────────
 * Batched resolver (cachée) — recommandé pour ≥ 2 champs
 * ──────────────────────────────────────────────────────────────────────── */

const fieldsCacheByKey = new Map<
  string,
  (componentKey: string, locale: string) => Promise<ResolvedFields>
>();

async function resolveBatch(
  componentKey: string,
  locale: string,
): Promise<ResolvedFields> {
  const component = await getSiteComponentByKey(componentKey);
  if (!component) return {};

  const bindings = await listPublishedBindings(component.id, locale);
  const byKey = new Map<string, ComponentFieldBinding>();
  for (const b of bindings) byKey.set(b.fieldKey, b);

  const out: ResolvedFields = {};
  for (const fieldDef of component.fields) {
    out[fieldDef.key] = pickResolved(fieldDef, byKey.get(fieldDef.key), locale);
  }
  return out;
}

export async function resolveComponentFields(
  componentKey: string,
  locale = 'fr',
): Promise<ResolvedFields> {
  const cacheKey = `${componentKey}::${locale}`;
  let cached = fieldsCacheByKey.get(cacheKey);
  if (!cached) {
    cached = unstable_cache(
      resolveBatch,
      ['component-fields-batch', componentKey, locale],
      { tags: tagsFor(componentKey, locale) },
    );
    fieldsCacheByKey.set(cacheKey, cached);
  }
  return cached(componentKey, locale);
}

export async function resolveComponentFieldsFresh(
  componentKey: string,
  locale = 'fr',
): Promise<ResolvedFields> {
  return resolveBatch(componentKey, locale);
}

/* ────────────────────────────────────────────────────────────────────────
 * Draft resolver (NON cachée) — preview iframe admin uniquement (F4)
 * ──────────────────────────────────────────────────────────────────────── */

export async function resolveComponentFieldsDraft(
  componentKey: string,
  locale = 'fr',
): Promise<ResolvedFields> {
  const component = await getSiteComponentByKey(componentKey);
  if (!component) return {};

  // Une seule lecture, on filtre en mémoire pour avoir draft + published.
  const all = await listBindingsByComponent(component.id, locale);
  const drafts = new Map<string, ComponentFieldBinding>();
  const published = new Map<string, ComponentFieldBinding>();
  for (const b of all) {
    if (b.status === 'draft') drafts.set(b.fieldKey, b);
    else if (b.status === 'published') published.set(b.fieldKey, b);
  }

  const out: ResolvedFields = {};
  for (const fieldDef of component.fields) {
    const draft = drafts.get(fieldDef.key);
    if (draft) {
      out[fieldDef.key] = bindingResolved(fieldDef, draft);
      continue;
    }
    const pub = published.get(fieldDef.key);
    out[fieldDef.key] = pickResolved(fieldDef, pub, locale);
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────
 * Diagnostic (A3 — variant)
 * ──────────────────────────────────────────────────────────────────────── */

export interface FieldDiagnostic {
  key: string;
  source: ResolvedField['meta']['source'];
  bindingId?: string;
  version: number;
}

export interface ComponentFieldsDiagnostic {
  componentKey: string;
  locale: string;
  fields: FieldDiagnostic[];
  bindingsCount: {
    published: number;
    draft: number;
    scheduled: number;
    archived: number;
  };
}

export async function diagnoseComponentFields(
  componentKey: string,
  locale = 'fr',
): Promise<ComponentFieldsDiagnostic> {
  const component = await getSiteComponentByKey(componentKey);
  const bindingsCount = { published: 0, draft: 0, scheduled: 0, archived: 0 };
  if (!component) {
    return { componentKey, locale, fields: [], bindingsCount };
  }

  const all = await listBindingsByComponent(component.id, locale);
  for (const b of all) {
    if (b.status in bindingsCount) {
      bindingsCount[b.status as keyof typeof bindingsCount] += 1;
    }
  }

  const publishedByKey = new Map<string, ComponentFieldBinding>();
  for (const b of all) {
    if (b.status === 'published') publishedByKey.set(b.fieldKey, b);
  }

  const fields: FieldDiagnostic[] = component.fields.map((fieldDef) => {
    const binding = publishedByKey.get(fieldDef.key);
    if (binding) {
      return {
        key: fieldDef.key,
        source: 'binding',
        bindingId: binding.id,
        version: binding.version,
      };
    }
    if (fieldDef.defaultValue !== undefined) {
      return { key: fieldDef.key, source: 'default', version: 0 };
    }
    return { key: fieldDef.key, source: 'none', version: 0 };
  });

  return { componentKey, locale, fields, bindingsCount };
}

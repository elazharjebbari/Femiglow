/**
 * Encodage / décodage des valeurs de champ (Components-CMS).
 *
 * Pour les types scalaires, l'enveloppe est `{ v: <value> }` afin d'autoriser
 * l'évolution future (ex. ajouter `style?` à un text). Pour les composés,
 * la structure est typée directement. Cf.
 * `docs/components-cms/architecture/02-data-model.md` (Encodage `value`).
 */
import type { FieldType } from '@/lib/db/types';

const SCALAR_TYPES = new Set<FieldType>([
  'text',
  'multiline',
  'rich-text',
  'icon',
  'color-token',
  'number',
  'boolean',
  'enum',
  'kicker',
]);

export function encodeValue(value: unknown, type: FieldType): unknown {
  switch (type) {
    case 'text':
    case 'multiline':
    case 'rich-text':
    case 'icon':
    case 'color-token':
    case 'kicker':
      return { v: value ?? '' };
    case 'number':
      return { v: typeof value === 'number' ? value : 0 };
    case 'boolean':
      return { v: Boolean(value) };
    case 'enum':
      return { v: value ?? '' };
    case 'cta':
      return value ?? null;
    case 'link':
      return value ?? null;
    case 'list':
      return { items: Array.isArray(value) ? value : [] };
    case 'record':
      return { fields: typeof value === 'object' && value ? value : {} };
    case 'quote':
      return value ?? null;
    case 'breadcrumb-segment':
      return value ?? null;
    default:
      return value;
  }
}

export function decodeValue(value: unknown, type: FieldType): unknown {
  if (value === null || value === undefined) return null;

  if (SCALAR_TYPES.has(type)) {
    if (typeof value === 'object' && value && 'v' in value) {
      return (value as { v: unknown }).v;
    }
    // Tolérance : un binding ancien stocké à plat reste lisible.
    return value;
  }

  switch (type) {
    case 'list':
      if (typeof value === 'object' && value && 'items' in value) {
        const items = (value as { items: unknown[] }).items;
        return Array.isArray(items) ? items : [];
      }
      return Array.isArray(value) ? value : [];
    case 'record':
      if (typeof value === 'object' && value && 'fields' in value) {
        return (value as { fields: Record<string, unknown> }).fields;
      }
      return typeof value === 'object' ? value : {};
    case 'cta':
    case 'link':
    case 'quote':
    case 'breadcrumb-segment':
      return value;
    default:
      return value;
  }
}

/**
 * Reconnaît une valeur "neutre" / vide pour permettre à la cascade de
 * retomber sur le `defaultValue` du registre. Utilisé lors du seed
 * lorsqu'un champ a explicitement une valeur `null`.
 */
export function isEmptyValue(value: unknown, type: FieldType): boolean {
  if (value === null || value === undefined) return true;
  const decoded = decodeValue(value, type);
  if (decoded === null || decoded === undefined) return true;
  if (typeof decoded === 'string' && decoded.trim() === '') return true;
  if (Array.isArray(decoded) && decoded.length === 0) return true;
  return false;
}

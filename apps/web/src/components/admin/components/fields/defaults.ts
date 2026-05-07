/**
 * Helpers pour produire des valeurs par défaut typées d'un `FieldType`.
 *
 * Utilisé par `ListEditor` (`+ Ajouter` produit un nouvel item du bon type)
 * et par `RecordEditor` (initialisation des sous-champs sans valeur).
 *
 * Les valeurs ici sont volontairement minimales — elles seront re-validées
 * côté serveur (B2) lors du save. L'UX repose sur le contrat : un nouvel item
 * doit être éditable immédiatement, pas nécessairement valide.
 */
import type { FieldType, FieldTypeConfig } from '@/lib/db/types';

export function defaultForType(type: FieldType, config?: FieldTypeConfig): unknown {
  switch (type) {
    case 'text':
    case 'multiline':
    case 'rich-text':
    case 'kicker':
      return '';
    case 'number':
      return config?.min ?? 0;
    case 'boolean':
      return false;
    case 'enum':
      return config?.options?.[0]?.value ?? '';
    case 'icon':
    case 'color-token':
      return '';
    case 'cta':
      return { label: '', href: '', variant: 'primary' };
    case 'link':
      return { href: '', label: '', external: false };
    case 'quote':
      return { text: '', author: '' };
    case 'breadcrumb-segment':
      return { label: '', href: '' };
    case 'list':
      return [];
    case 'record':
      return {};
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

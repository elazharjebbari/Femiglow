/**
 * Helper RSC pour charger l'état initial des champs d'un composant côté
 * server-component (P8). Lit la DB directement (pas de fetch interne) et
 * décode les valeurs jsonb pour les passer au client.
 *
 * La cascade pour `current` est :
 *   1. draft existant (l'admin reprend là où il en était),
 *   2. sinon published existant,
 *   3. sinon `defaultValue` du registre,
 *   4. sinon `null`.
 *
 * `ifMatch` est l'`updatedAt` du draft s'il existe, sinon du published.
 *
 * Cf. docs/components-cms/frontend/03-form-engine.md
 */
import 'server-only';
import type {
  ComponentFieldDefinition,
  SiteComponent,
} from '@/lib/db/types';
import { decodeValue } from '@/lib/components/fields/encoding';
import { getDraftBinding, getPublishedBinding } from '@/lib/db/queries/component-fields';
import type { FieldDirtyState } from './types';

export async function loadInitialFields(
  component: SiteComponent,
  fieldDefs: ComponentFieldDefinition[],
  locale = 'fr',
): Promise<Record<string, FieldDirtyState>> {
  const out: Record<string, FieldDirtyState> = {};
  await Promise.all(
    fieldDefs.map(async (def) => {
      const [pub, draft] = await Promise.all([
        getPublishedBinding(component.id, def.key, locale),
        getDraftBinding(component.id, def.key, locale),
      ]);
      const source = draft ?? pub;
      const value = source ? decodeValue(source.value, def.type) : (def.defaultValue ?? null);
      const updatedAt = source?.updatedAt.toISOString() ?? null;
      out[def.key] = {
        initial: value,
        current: value,
        error: null,
        saving: false,
        lastSavedAt: updatedAt,
        ifMatch: updatedAt,
      };
    }),
  );
  return out;
}

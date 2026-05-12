/**
 * Seeder form-config — réamorce wizard_kit + wizard_commander vers leur
 * version de référence (config codée en TS). Idempotent + versionné :
 * chaque run crée une nouvelle version dans `form_config_history`.
 *
 * Si une row n'existe pas (DB vierge sans migration 0018), elle est créée.
 */
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import { formConfig, formConfigHistory } from '@/lib/db/schema';
import { createId } from '@/lib/ids';
import { formConfigJsonSchema } from '@/lib/checkout/form-config/schema';
import { formConfigRepo } from '@/lib/checkout/repos/form-config-repo';
import type { FormConfigJson } from '@/lib/checkout/form-config/schema';
import type { SeederContext, SeederResult } from '../types';

const WIZARD_KIT_DEFAULT: FormConfigJson = {
  steps: ['lead', 'address', 'payment', 'thank_you'],
  modes: ['wizard_embed'],
  defaults: {
    formMode: 'wizard_embed',
    currency: 'MAD',
    country: 'MA',
    paymentMethods: ['cod', 'bank_transfer'],
    defaultShippingMode: 'standard',
  },
  copy: {
    title: 'Commander le rituel FemiGlow',
    cta_lead: 'Continuer',
    cta_address: 'Choisir le paiement',
    cta_payment: 'Confirmer la commande',
    thank_you_title: 'Commande reçue, on vous rappelle.',
  },
  validation: {
    phone_min_length: 9,
    phone_max_length: 13,
    require_email_on_thank_you: false,
    require_postal_code: false,
  },
};

const WIZARD_COMMANDER_DEFAULT: FormConfigJson = {
  steps: ['cart_review', 'lead', 'address', 'payment', 'thank_you'],
  modes: ['wizard_cart'],
  defaults: {
    formMode: 'wizard_cart',
    currency: 'MAD',
    country: 'MA',
    paymentMethods: ['cod', 'bank_transfer'],
    defaultShippingMode: 'standard',
  },
  copy: {
    title: 'Finaliser ma commande',
    cta_cart: 'Continuer',
    cta_lead: 'Continuer',
    cta_address: 'Choisir le paiement',
    cta_payment: 'Confirmer la commande',
    thank_you_title: 'Commande reçue, on vous rappelle.',
  },
  validation: {
    phone_min_length: 9,
    phone_max_length: 13,
    require_email_on_thank_you: false,
    require_postal_code: false,
  },
};

const SEEDS: Array<{
  key: 'wizard_kit' | 'wizard_commander';
  config: FormConfigJson;
  description: string;
}> = [
  {
    key: 'wizard_kit',
    config: WIZARD_KIT_DEFAULT,
    description: 'Wizard embed sur la page produit /kit (mode A).',
  },
  {
    key: 'wizard_commander',
    config: WIZARD_COMMANDER_DEFAULT,
    description: 'Wizard cart sur la page /commander (mode B).',
  },
];

async function createIfMissing(
  key: string,
  config: FormConfigJson,
  description: string,
  actorId: string | null,
): Promise<{ created: boolean; version: number }> {
  const existing = await formConfigRepo.getByKey(key);
  if (existing) return { created: false, version: existing.version };
  const conn = db();
  if (!conn) throw new Error('Database non disponible pour create form_config');
  const now = new Date();
  const id = createId('fc');
  await conn.insert(formConfig).values({
    id,
    key,
    version: 1,
    active: true,
    config,
    description,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId ?? null,
    updatedBy: actorId ?? null,
  });
  await conn.insert(formConfigHistory).values({
    id: createId('fch'),
    formConfigId: id,
    key,
    version: 1,
    config,
    description: 'Seed initial via Seeders Runner',
    actorId: actorId ?? null,
    action: 'create',
  });
  return { created: true, version: 1 };
}

export async function formConfigSeeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  let createdCount = 0;
  let updatedCount = 0;

  for (let i = 0; i < SEEDS.length; i += 1) {
    const { key, config, description } = SEEDS[i]!;
    ctx.onProgress?.(`Validation ${key}`, i / SEEDS.length);
    const parsed = formConfigJsonSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error(`Defaults ${key} invalides : ${parsed.error.message}`);
    }

    const actorId = ctx.actorId ?? 'system';

    ctx.onProgress?.(`Vérification ${key}`, (i + 0.5) / SEEDS.length);
    const { created } = await createIfMissing(
      key,
      parsed.data,
      description,
      actorId,
    );

    if (created) {
      createdCount += 1;
    } else {
      ctx.onProgress?.(`Re-seed ${key}`, (i + 0.8) / SEEDS.length);
      await formConfigRepo.update({
        key,
        config: parsed.data,
        description,
        actorId,
      });
      updatedCount += 1;
    }
  }

  // Invalidation des feeds publics.
  revalidatePath('/api/checkout/form-config/wizard_kit');
  revalidatePath('/api/checkout/form-config/wizard_commander');

  return {
    stats: { created: createdCount, updated: updatedCount },
    summary: `${createdCount} créé · ${updatedCount} mis à jour`,
  };
}

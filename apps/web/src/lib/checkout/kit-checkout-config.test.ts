/**
 * Kit CRO v2 §2 — composant CMS `kit-checkout` : définitions de champs
 * (registre réel, `validateFieldValue`) et résolution serveur avec défauts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
  revalidateTag: vi.fn(),
}));

import { resetMemoryStore } from '@/lib/db/client';
import { findComponentSeed } from '@/lib/components/registry';
import { validateFieldValue } from '@/lib/components/fields/validators';
import { encodeValue } from '@/lib/components/fields/encoding';
import { seedComponentFields, syncComponentRegistry } from '@/lib/components/seed-pipeline';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import type { ComponentFieldDefinition, ResolvedFields } from '@/lib/db/types';

import {
  DEFAULT_KIT_CHECKOUT_CONFIG,
  KIT_CHECKOUT_COMPONENT_KEY,
  parseKitCheckoutConfig,
} from './kit-checkout-config';
import { getKitCheckoutConfig } from './kit-checkout-config.server';

function field(key: string): ComponentFieldDefinition {
  const def = findComponentSeed(KIT_CHECKOUT_COMPONENT_KEY)?.fields?.find((f) => f.key === key);
  if (!def) throw new Error(`champ ${key} absent du registre`);
  return def;
}

function resolved(values: Record<string, unknown>): ResolvedFields {
  return Object.fromEntries(
    Object.entries(values).map(([k, value]) => [
      k,
      { value, meta: { source: 'binding' as const, version: 1 } },
    ]),
  );
}

describe('registre — kit-checkout', () => {
  it('composant du groupe kit, sans slot média, visible en admin', () => {
    const seed = findComponentSeed(KIT_CHECKOUT_COMPONENT_KEY);
    expect(seed).toBeDefined();
    expect(seed!.pageGroup).toBe('kit');
    expect(seed!.slots).toEqual([]);
    expect(seed!.fields?.map((f) => f.key)).toEqual(['ctaMode', 'sheetSharePct']);
  });

  it('ctaMode : enum scroll | sheet | ab, défaut scroll', () => {
    const def = field('ctaMode');
    expect(def.type).toBe('enum');
    expect(def.defaultValue).toBe('scroll');
    expect(def.config?.options?.map((o) => o.value)).toEqual(['scroll', 'sheet', 'ab']);
    for (const v of ['scroll', 'sheet', 'ab']) {
      expect(validateFieldValue(def, encodeValue(v, 'enum')).ok).toBe(true);
    }
    expect(validateFieldValue(def, encodeValue('modal', 'enum')).ok).toBe(false);
    expect(validateFieldValue(def, encodeValue(def.defaultValue, 'enum')).ok).toBe(true);
  });

  it('sheetSharePct : nombre entier 0–100, défaut 50', () => {
    const def = field('sheetSharePct');
    expect(def.type).toBe('number');
    expect(def.defaultValue).toBe(50);
    for (const v of [0, 1, 50, 100]) {
      expect(validateFieldValue(def, encodeValue(v, 'number')).ok).toBe(true);
    }
    for (const v of [-1, 101, 12.5]) {
      expect(validateFieldValue(def, encodeValue(v, 'number')).ok).toBe(false);
    }
    // Valeur brute (non encodée `{ v }`) ou chaîne : refusée.
    expect(validateFieldValue(def, { v: '50' }).ok).toBe(false);
    expect(validateFieldValue(def, 50).ok).toBe(false);
  });
});

describe('parseKitCheckoutConfig', () => {
  it('valeurs valides', () => {
    expect(parseKitCheckoutConfig(resolved({ ctaMode: 'ab', sheetSharePct: 20 }))).toEqual({
      ctaMode: 'ab',
      sheetSharePct: 20,
    });
  });

  it('absence de champs → défauts (scroll, 50)', () => {
    expect(parseKitCheckoutConfig({})).toEqual(DEFAULT_KIT_CHECKOUT_CONFIG);
    expect(parseKitCheckoutConfig(null)).toEqual({ ctaMode: 'scroll', sheetSharePct: 50 });
  });

  it('valeurs invalides → repli sûr', () => {
    expect(parseKitCheckoutConfig(resolved({ ctaMode: 'modal', sheetSharePct: 'x' }))).toEqual({
      ctaMode: 'scroll',
      sheetSharePct: 50,
    });
    expect(parseKitCheckoutConfig(resolved({ ctaMode: 'sheet', sheetSharePct: 400 }))).toEqual({
      ctaMode: 'sheet',
      sheetSharePct: 100,
    });
  });
});

describe('getKitCheckoutConfig — résolution via le registre', () => {
  beforeEach(async () => {
    resetMemoryStore();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('composant non synchronisé → défauts', async () => {
    expect(await getKitCheckoutConfig()).toEqual(DEFAULT_KIT_CHECKOUT_CONFIG);
  });

  it('registre seedé → défauts du registre (scroll, 50)', async () => {
    await syncComponentRegistry();
    await seedComponentFields();
    expect(await getKitCheckoutConfig()).toEqual({ ctaMode: 'scroll', sheetSharePct: 50 });
  });

  it('un binding publié depuis l’admin prime sur le défaut', async () => {
    await syncComponentRegistry();
    await seedComponentFields();
    const cmp = await getSiteComponentByKey(KIT_CHECKOUT_COMPONENT_KEY);
    expect(cmp).toBeTruthy();
    const { upsertDraftBinding, publishBinding } =
      await import('@/lib/db/queries/component-fields');
    for (const [fieldKey, value] of [
      ['ctaMode', { v: 'ab' }],
      ['sheetSharePct', { v: 30 }],
    ] as const) {
      const draft = await upsertDraftBinding({
        componentId: cmp!.id,
        fieldKey,
        value,
        authorId: 'adm_test',
      });
      await publishBinding({
        bindingId: draft.id,
        expectedUpdatedAt: draft.updatedAt,
        actorId: 'adm_test',
      });
    }
    expect(await getKitCheckoutConfig()).toEqual({ ctaMode: 'ab', sheetSharePct: 30 });
  });
});

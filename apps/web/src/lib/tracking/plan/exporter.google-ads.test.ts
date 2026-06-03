/**
 * Tests d'export Google Ads (awct) — audit google-ads-2026-06-03.
 *
 * Vérifie, à partir du plan CANONIQUE (catalogue → providers réels) :
 *  1. Les 12 conversions configurées génèrent toutes un tag awct.
 *  2. La conversion `lead` est portée par `generate_lead` (pas `lead_capture`)
 *     → fix double-comptage wizard.
 *  3. Le trigger `lead` est method-gaté {chat, abandoned_cart} → contact /
 *     newsletter (qui émettent aussi generate_lead) ne polluent PAS `lead`.
 */
import { describe, expect, it } from 'vitest';

import { buildCanonicalSeed } from './canonical-seed';
import { exportPlan } from './exporter';
import type { TrackingPlan } from './types';

const ALL_LABEL_KEYS = [
  'purchase',
  'add_to_cart',
  'checkout_intent',
  'lead',
  'contact',
  'chat_contact',
  'sign_up',
  'newsletter',
  'video_complete',
  'download',
  'journal_read',
  'chat_engagement',
] as const;

function buildPlan(): TrackingPlan {
  const seed = buildCanonicalSeed();
  const prod = seed.envProfiles.find((e) => e.env === 'production')!;
  // Remplir AW-ID + container + les 12 labels (valeurs factices non vides).
  prod.config.googleAdsConversionId = 'AW-18136327114';
  prod.config.gtmContainerId = 'GTM-TEST0000';
  const labels: Record<string, string> = {};
  for (const k of ALL_LABEL_KEYS) labels[k] = `LBL_${k}`;
  prod.config.googleAdsConversionLabels = labels;
  return {
    id: 'tp_test',
    status: 'active',
    version: 1,
    createdBy: 'test',
    createdAt: new Date('2026-06-03T00:00:00Z'),
    updatedAt: new Date('2026-06-03T00:00:00Z'),
    ...seed,
  } as TrackingPlan;
}

interface GtmTag {
  type: string;
  name: string;
  parameter?: Array<{ key: string; value: string }>;
  firingTriggerId?: string[];
}
interface GtmTrigger {
  triggerId: string;
  filter?: Array<{ parameter?: Array<{ key: string; value: string }> }>;
}

function exportContainer() {
  const res = exportPlan(buildPlan(), 'production');
  const cv = (res.json as { containerVersion: { tag: GtmTag[]; trigger: GtmTrigger[] } })
    .containerVersion;
  return { tags: cv.tag, triggers: cv.trigger };
}

function labelKeyOf(tag: GtmTag): string | null {
  const v = tag.parameter?.find((p) => p.key === 'conversionLabel')?.value ?? '';
  const m = v.match(/CONST - Ads Label - (.+?)\}\}/);
  return m ? m[1] : null;
}

describe('export Google Ads — conversions awct', () => {
  it('génère un tag awct pour les 12 conversions configurées', () => {
    const { tags } = exportContainer();
    const awct = tags.filter((t) => t.type === 'awct');
    const keys = new Set(awct.map(labelKeyOf).filter(Boolean));
    for (const k of ALL_LABEL_KEYS) {
      expect(keys, `conversion ${k} doit avoir un tag awct`).toContain(k);
    }
  });

  it('la conversion `lead` vient de generate_lead, PAS de lead_capture (anti-double-comptage)', () => {
    const { tags } = exportContainer();
    const awct = tags.filter((t) => t.type === 'awct');
    const leadTags = awct.filter((t) => labelKeyOf(t) === 'lead');
    // Un seul event source pour le label `lead` : generate_lead.
    expect(leadTags).toHaveLength(1);
    expect(leadTags[0]!.name).toContain('generate_lead');
    expect(awct.some((t) => t.name.includes('lead_capture'))).toBe(false);
  });

  it('le trigger `lead` est method-gaté {chat, abandoned_cart}', () => {
    const { tags, triggers } = exportContainer();
    const leadTag = tags
      .filter((t) => t.type === 'awct')
      .find((t) => labelKeyOf(t) === 'lead')!;
    const trigId = leadTag.firingTriggerId![0];
    const trig = triggers.find((t) => t.triggerId === trigId)!;
    const methodFilter = (trig.filter ?? []).some((f) =>
      (f.parameter ?? []).some(
        (p) => p.key === 'arg1' && /\^\(chat\|abandoned_cart\)\$/.test(p.value),
      ),
    );
    expect(methodFilter, 'le trigger lead doit filtrer method ∈ {chat, abandoned_cart}').toBe(
      true,
    );
  });
});

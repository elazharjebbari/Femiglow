/**
 * Tests d'INTÉGRITÉ approfondis du container GTM généré + du pont runtime.
 *
 * Objectif : prouver que le système d'export GTM est « 100% fonctionnel » :
 *  1. Intégrité référentielle  — aucune référence `{{…}}` pendante, tout
 *     trigger/setupTag/variable cible existe, IDs base-10 uniques par namespace.
 *  2. Casse des enums GTM       — sinon l'import UI échoue.
 *  3. Pont runtime (ROAS)       — chaque DLV de conversion (value/currency/
 *     transaction_id/page.locale/event_id/user_data) RÉSOUT sur une entry
 *     réellement produite par `TrackingClient.emit`. C'est ce qui aurait
 *     attrapé le bug T-01 (DLV `ecommerce.*` au lieu de `params.*`).
 *  4. Couverture providers      — chaque provider actif produit ses tags pour
 *     chaque event de conversion, avec la valeur câblée.
 *
 * cf. docs/tracking-audit-2026-05-31
 */
import { describe, expect, it } from 'vitest';

import { exportPlan } from '../exporter';
import type { TrackingPlan } from '../types';
import { TrackingClient } from '@/lib/tracking/client';
import { getDataLayer } from '@/lib/tracking/datalayer';
import { DATALAYER_PATHS } from '@/lib/tracking/datalayer-paths';
import { EVENT_CATALOG } from '@/lib/tracking/event-catalog';

// ─── Plan « production complet » (tous providers, events conversion+audience) ──
function fullPlan(overrides: Partial<TrackingPlan> = {}): TrackingPlan {
  return {
    id: 'plan-full',
    name: 'Full',
    status: 'active',
    version: 1,
    providers: [
      { id: 'ga4', active: true },
      { id: 'googleAds', active: true },
      { id: 'meta', active: true },
      { id: 'tiktok', active: true },
      { id: 'snap', active: true },
    ],
    envProfiles: [
      {
        env: 'production',
        config: {
          ga4MeasurementId: 'G-TESTPROD1',
          googleAdsConversionId: 'AW-18136327114',
          googleAdsConversionLabels: {
            purchase: 'PURCH_LBL',
            lead: 'LEAD_LBL',
            checkout_intent: 'CHK_LBL',
            add_to_cart: 'ATC_LBL',
          },
          metaPixelId: '1234567890123456',
          tiktokPixelId: 'CABCDEF123',
          snapPixelId: 'snap-pixel-uuid',
          snapEventMode: 'hybrid',
          gtmContainerId: 'GTM-TESTAAA',
        },
      },
    ],
    events: [
      { key: 'page_view', providers: { ga4: true, meta: true, tiktok: true, snap: true } },
      { key: 'view_item', providers: { ga4: true, meta: true, tiktok: true, snap: true } },
      { key: 'add_to_cart', providers: { ga4: true, meta: true, googleAds: true, tiktok: true, snap: true } },
      { key: 'checkout_intent', providers: { ga4: true, meta: true, googleAds: true, tiktok: true, snap: true } },
      { key: 'purchase', providers: { ga4: true, meta: true, googleAds: true, tiktok: true, snap: true } },
      { key: 'generate_lead', providers: { ga4: true, meta: true, googleAds: true, tiktok: true, snap: true } },
      { key: 'lead_capture', providers: { ga4: true, meta: true, googleAds: true, snap: true } },
    ],
    settings: { consentMode: 'v2' },
    createdBy: 'test@femiglow.ma',
    createdAt: new Date('2026-05-31'),
    updatedAt: new Date('2026-05-31'),
    ...overrides,
  };
}

interface GtmParam {
  type: string;
  key?: string;
  value?: string;
  list?: GtmParam[];
  map?: GtmParam[];
}
interface GtmTag {
  tagId: string;
  name: string;
  type: string;
  parameter: GtmParam[];
  firingTriggerId?: string[];
  setupTag?: Array<{ tagName: string }>;
}
interface GtmTrigger {
  triggerId: string;
  name: string;
  type: string;
  customEventFilter?: Array<{ type: string; parameter: GtmParam[] }>;
  filter?: Array<{ type: string; parameter: GtmParam[] }>;
}
interface GtmVariable { variableId: string; name: string; type: string; parameter: GtmParam[] }

function container(plan = fullPlan()) {
  const json = exportPlan(plan, 'production').json as any;
  const cv = json.containerVersion;
  return {
    tags: cv.tag as GtmTag[],
    triggers: cv.trigger as GtmTrigger[],
    variables: cv.variable as GtmVariable[],
    builtIn: cv.builtInVariable as Array<{ name: string }>,
  };
}

// Récolte récursive de toutes les `value` string d'un arbre de paramètres.
function collectStrings(params: GtmParam[] | undefined, out: string[] = []): string[] {
  for (const p of params ?? []) {
    if (typeof p.value === 'string') out.push(p.value);
    collectStrings(p.list, out);
    collectStrings(p.map, out);
  }
  return out;
}
const refsIn = (s: string): string[] =>
  [...s.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]!.trim());

function dlvPath(v: GtmVariable): string | undefined {
  return v.parameter.find((p) => p.key === 'name')?.value;
}
function resolvePath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined),
      obj,
    );
}

describe('GTM container — intégrité référentielle', () => {
  it('aucune référence {{…}} pendante (tout var/const/built-in cible existe)', () => {
    const { tags, triggers, variables, builtIn } = container();
    const defined = new Set<string>([
      ...variables.map((v) => v.name),
      ...builtIn.map((b) => b.name),
      '_event', // token GTM implicite (customEventFilter arg0)
    ]);
    const dangling: string[] = [];
    const scan = (strings: string[], where: string) => {
      for (const s of strings)
        for (const ref of refsIn(s))
          if (!defined.has(ref)) dangling.push(`${where} → {{${ref}}}`);
    };
    for (const t of tags) scan(collectStrings(t.parameter), `tag ${t.name}`);
    for (const tr of triggers) {
      for (const f of tr.customEventFilter ?? []) scan(collectStrings(f.parameter), `trigger ${tr.name}`);
      for (const f of tr.filter ?? []) scan(collectStrings(f.parameter), `trigger ${tr.name}`);
    }
    expect(dangling).toEqual([]);
  });

  it('chaque firingTriggerId cible un trigger existant', () => {
    const { tags, triggers } = container();
    const triggerIds = new Set(triggers.map((t) => t.triggerId));
    for (const t of tags)
      for (const id of t.firingTriggerId ?? [])
        expect(triggerIds, `tag ${t.name}`).toContain(id);
  });

  it('chaque setupTag cible un tag existant', () => {
    const { tags } = container();
    const tagNames = new Set(tags.map((t) => t.name));
    for (const t of tags)
      for (const s of t.setupTag ?? [])
        expect(tagNames, `setupTag de ${t.name}`).toContain(s.tagName);
  });

  it('aucun trigger orphelin (chaque trigger est référencé par ≥1 tag)', () => {
    const { tags, triggers } = container();
    const used = new Set(tags.flatMap((t) => t.firingTriggerId ?? []));
    const orphans = triggers.filter((tr) => !used.has(tr.triggerId)).map((tr) => tr.name);
    expect(orphans).toEqual([]);
  });

  it('IDs base-10 uniques par namespace (tag/trigger/variable)', () => {
    const { tags, triggers, variables } = container();
    const check = (ids: string[], ns: string) => {
      for (const id of ids) expect(id, `${ns} id`).toMatch(/^\d+$/);
      expect(new Set(ids).size, `${ns} unicité`).toBe(ids.length);
    };
    check(tags.map((t) => t.tagId), 'tag');
    check(triggers.map((t) => t.triggerId), 'trigger');
    check(variables.map((v) => v.variableId), 'variable');
  });

  it('chaque tag a au moins un firingTriggerId (pas de tag mort)', () => {
    for (const t of container().tags) {
      expect(t.firingTriggerId, `tag ${t.name}`).toBeDefined();
      expect(t.firingTriggerId!.length).toBeGreaterThan(0);
    }
  });
});

describe('GTM container — casse des enums (import UI)', () => {
  it('parameter.type ∈ UPPERCASE autorisés (récursif)', () => {
    const allowed = new Set(['TEMPLATE', 'BOOLEAN', 'INTEGER', 'LIST', 'MAP', 'TAG_REFERENCE', 'TRIGGER_REFERENCE']);
    const { tags, triggers, variables } = container();
    const walk = (params: GtmParam[] | undefined, where: string) => {
      for (const p of params ?? []) {
        expect(allowed, `${where} type=${p.type}`).toContain(p.type);
        walk(p.list, where);
        walk(p.map, where);
      }
    };
    for (const t of tags) walk(t.parameter, `tag ${t.name}`);
    for (const v of variables) walk(v.parameter, `var ${v.name}`);
    for (const tr of triggers) {
      for (const f of tr.customEventFilter ?? []) walk(f.parameter, `trigger ${tr.name}`);
      for (const f of tr.filter ?? []) walk(f.parameter, `trigger ${tr.name}`);
    }
  });

  it('trigger.type + filter.type sont UPPER_SNAKE / UPPERCASE', () => {
    const { triggers } = container();
    for (const tr of triggers) {
      expect(tr.type).toMatch(/^[A-Z_]+$/);
      for (const f of [...(tr.customEventFilter ?? []), ...(tr.filter ?? [])])
        expect(f.type).toMatch(/^[A-Z_]+$/);
    }
  });
});

describe('Pont runtime — les DLV de conversion résolvent sur un emit réel (ROAS)', () => {
  // Client à consentement refusé : l'entry est poussée AVANT le gate consent,
  // donc capturable sans flush réseau (cf. client.ts).
  function emitPurchase() {
    getDataLayer().flush();
    const client = new TrackingClient({
      consent: () => ({
        ad_storage: 'denied', analytics_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied', functional_storage: 'denied',
      }),
      user: () => ({ anonymous_id: 'anon_1', session_id: 'sess_1' }),
      page: () => ({ url: 'https://femiglow.ma/fr/kit', path: '/fr/kit', title: '', referrer: '', locale: 'fr' }),
    });
    client.emit(
      'purchase',
      { value: 199, currency: 'MAD', transaction_id: 'tx_42', items: [{ item_id: 'kit', price: 199, quantity: 1 }] },
      { userData: { sha256_email_address: 'a'.repeat(64), sha256_phone_number: 'b'.repeat(64) } },
    );
    return getDataLayer().recent(1)[0]!;
  }

  it('value/currency/transaction_id/page.locale/event_id : chemin DLV → valeur définie sur l’entry', () => {
    const { variables } = container();
    const entry = emitPurchase();
    // Mappe nom DLV → chemin, puis vérifie la résolution réelle.
    const pathByName = new Map(variables.map((v) => [v.name, dlvPath(v)] as const));
    const cases: Array<[string, unknown]> = [
      ['DLV - value', 199],
      ['DLV - currency', 'MAD'],
      ['DLV - transaction_id', 'tx_42'],
      ['DLV - page.locale', 'fr'],
      ['DLV - event_id', entry.event_id],
    ];
    for (const [name, expected] of cases) {
      const path = pathByName.get(name);
      expect(path, `${name} doit exister dans le container`).toBeDefined();
      expect(resolvePath(entry, path!), `${name} (${path}) doit résoudre`).toBe(expected);
    }
  });

  it('les DLV user_data (advanced matching / enhanced conversions) résolvent', () => {
    const { variables } = container();
    const entry = emitPurchase();
    const emailVar = variables.find((v) => v.name === 'DLV - user_data.email_sha256');
    const phoneVar = variables.find((v) => v.name === 'DLV - user_data.phone_sha256');
    expect(emailVar, 'DLV email présent').toBeDefined();
    expect(resolvePath(entry, dlvPath(emailVar!)!)).toBe('a'.repeat(64));
    expect(resolvePath(entry, dlvPath(phoneVar!)!)).toBe('b'.repeat(64));
  });

  it('GARDE-FOU T-01 : aucune DLV ne lit un chemin `ecommerce.*` (jamais poussé)', () => {
    const { variables } = container();
    const bad = variables.filter((v) => (dlvPath(v) ?? '').startsWith('ecommerce.'));
    expect(bad.map((v) => v.name)).toEqual([]);
    // …et la valeur DOIT être sous params.*.
    expect(DATALAYER_PATHS.value).toBe('params.value');
  });
});

describe('Couverture providers — chaque conversion câble sa valeur', () => {
  const CONVERSIONS = ['purchase', 'generate_lead', 'lead_capture'] as const;

  it('awct (Google Ads) : conversionValue/currencyCode/orderId par conversion', () => {
    const { tags } = container();
    for (const ev of CONVERSIONS) {
      const awct = tags.find((t) => t.type === 'awct' && t.name.startsWith(`Ads Conv — ${ev}`));
      expect(awct, `awct ${ev}`).toBeDefined();
      const params = Object.fromEntries(awct!.parameter.map((p) => [p.key, p.value]));
      expect(params.conversionValue).toBe('{{DLV - value}}');
      expect(params.currencyCode).toBe('{{DLV - currency}}');
      expect(params.orderId).toBe('{{DLV - transaction_id}}');
    }
  });

  it('GA4 (gaawe) : eventSettingsTable value/currency par conversion', () => {
    const { tags } = container();
    for (const ev of CONVERSIONS) {
      const ga4 = tags.find((t) => t.type === 'gaawe' && t.name === `GA4 Evt — ${ev}`);
      expect(ga4, `gaawe ${ev}`).toBeDefined();
      const settings = ga4!.parameter.find((p) => p.key === 'eventSettingsTable');
      expect(settings, `${ev} eventSettingsTable`).toBeDefined();
      const flat = collectStrings(settings!.list).join('|');
      expect(flat).toContain('{{DLV - value}}');
      expect(flat).toContain('{{DLV - currency}}');
    }
  });

  it('Meta (fbq) : value/currency en custom_data par conversion', () => {
    const { tags } = container();
    for (const ev of CONVERSIONS) {
      const meta = tags.find((t) => t.type === 'html' && t.name.startsWith(`Meta Evt — ${ev}`));
      expect(meta, `meta ${ev}`).toBeDefined();
      const html = meta!.parameter.find((p) => p.key === 'html')!.value!;
      expect(html).toContain('value: {{DLV - value}}');
      expect(html).toContain("currency: '{{DLV - currency}}'");
      expect(html).toContain('eventID: {{DLV - event_id}}');
    }
  });

  it('chaque provider actif produit au moins son tag d’init + ses event tags', () => {
    const { tags } = container();
    const names = tags.map((t) => t.name);
    expect(names).toContain('GA4 Cfg');
    expect(names).toContain('Ads Cfg');
    expect(names).toContain('Meta Init');
    expect(names).toContain('TikTok Init');
    expect(names).toContain('Snap Init');
    expect(tags.filter((t) => t.type === 'awct').length).toBeGreaterThanOrEqual(3);
    expect(tags.some((t) => t.name.startsWith('TikTok Evt'))).toBe(true);
    expect(tags.some((t) => t.name.startsWith('Snap Evt'))).toBe(true);
  });
});

describe('Couverture catalogue — aucun event silencieusement perdu', () => {
  it('chaque event GA4 du catalogue, inclus dans le plan, produit son trigger + son tag', () => {
    const events = EVENT_CATALOG.filter((e) => e.defaultProviders.includes('google_ga4')).map(
      (e) => ({ key: e.name, providers: { ga4: true } }),
    );
    expect(events.length).toBeGreaterThan(30); // garde-fou : catalogue non vide
    const { tags, triggers } = container(fullPlan({ events }));
    const triggerNames = new Set(triggers.map((t) => t.name));
    const tagNames = new Set(tags.map((t) => t.name));
    const missing: string[] = [];
    for (const e of events) {
      if (!triggerNames.has(`CE — ${e.key}`)) missing.push(`trigger CE — ${e.key}`);
      if (!tagNames.has(`GA4 Evt — ${e.key}`)) missing.push(`tag GA4 Evt — ${e.key}`);
    }
    expect(missing).toEqual([]);
  });

  it('export déterministe : même plan → même bundleId (re-export stable)', () => {
    const a = exportPlan(fullPlan(), 'production');
    const b = exportPlan(fullPlan(), 'production');
    expect(a.bundleId).toBe(b.bundleId);
    expect(a.bundleId).toMatch(/^[a-f0-9]{64}$/);
  });
});

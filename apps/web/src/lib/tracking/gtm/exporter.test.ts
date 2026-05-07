import { describe, it, expect } from 'vitest';
import { gtmExporter } from './exporter';
import { prettyPrint } from './pretty';
import { computeStats, computeMeta } from './stats';
import { buildContainer } from './builders';

const FIXED_DATE = new Date('2026-05-07T10:00:00.000Z');

describe('gtmExporter — déterminisme', () => {
  it('produit un pretty-print byte-identique entre deux runs (même date d\'export)', () => {
    const a = prettyPrint(buildContainer({ env: 'production', exportTime: FIXED_DATE }));
    const b = prettyPrint(buildContainer({ env: 'production', exportTime: FIXED_DATE }));
    expect(a).toBe(b);
  });

  it('produit un sha256 stable pour le même contenu', () => {
    const c = buildContainer({ env: 'production', exportTime: FIXED_DATE });
    const m1 = computeMeta(prettyPrint(c));
    const m2 = computeMeta(prettyPrint(c));
    expect(m1.sha256).toBe(m2.sha256);
    expect(m1.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('change de sha256 quand l\'environnement change', () => {
    const prod = prettyPrint(buildContainer({ env: 'production', exportTime: FIXED_DATE }));
    const stage = prettyPrint(buildContainer({ env: 'stage', exportTime: FIXED_DATE }));
    expect(prod).not.toBe(stage);
  });
});

describe('gtmExporter — contenu généré', () => {
  it('inclut un trigger Custom Event pour chaque event du catalogue', () => {
    const c = buildContainer({ env: 'production', exportTime: FIXED_DATE });
    const customEventTriggers = c.containerVersion.trigger.filter(
      (t) => t.type === 'customEvent',
    );
    // Au moins 1 trigger par event chat (12 historiques + 6 ajoutés)
    const chatTriggers = customEventTriggers.filter((t) => t.name?.startsWith('CE — chat_'));
    expect(chatTriggers.length).toBeGreaterThanOrEqual(18);
  });

  it('inclut les variables DLV chat issues du plan d\'attribution', () => {
    const c = buildContainer({ env: 'production', exportTime: FIXED_DATE });
    const names = c.containerVersion.variable.map((v) => v.name);
    expect(names).toContain('DLV - chat.session_id');
    expect(names).toContain('DLV - chat.message_id');
    expect(names).toContain('DLV - chat.role');
    expect(names).toContain('DLV - chat.intent_dominant');
  });

  it('crée un tag GA4 pour chaque event qui a google_ga4 dans defaultProviders', () => {
    const c = buildContainer({ env: 'production', exportTime: FIXED_DATE });
    const ga4Tags = c.containerVersion.tag.filter((t) => t.name.startsWith('GA4 Evt — '));
    // Doit au moins contenir page_view + chat_message_sent + purchase
    const names = ga4Tags.map((t) => t.name);
    expect(names).toContain('GA4 Evt — page_view');
    expect(names).toContain('GA4 Evt — chat_message_sent');
    expect(names).toContain('GA4 Evt — purchase');
  });

  it('crée un tag Meta uniquement si un mapping existe', () => {
    const c = buildContainer({ env: 'production', exportTime: FIXED_DATE });
    const metaTags = c.containerVersion.tag.filter((t) => t.name.startsWith('Meta Evt — '));
    // Au moins Purchase, ChatEngagement, Contact
    const names = metaTags.map((t) => t.name);
    expect(names).toContain('Meta Evt — Purchase');
    expect(names).toContain('Meta Evt — ChatEngagement');
    expect(names).toContain('Meta Evt — Contact');
  });

  it('en environnement dev, ne crée aucun tag pixel (providers vides)', () => {
    const c = buildContainer({ env: 'dev', exportTime: FIXED_DATE });
    expect(c.containerVersion.tag).toHaveLength(0);
  });

  it('compte au moins 9 folders structurels (incluant Chat assistant)', () => {
    const c = buildContainer({ env: 'production', exportTime: FIXED_DATE });
    const names = c.containerVersion.folder.map((f) => f.name);
    expect(names).toContain('00 — Configuration');
    expect(names).toContain('08 — Chat assistant');
    expect(names.length).toBeGreaterThanOrEqual(9);
  });
});

describe('gtmExporter.build', () => {
  it('expose container, pretty, minified, stats, meta, env', () => {
    const exp = gtmExporter.build({ env: 'production', exportTime: FIXED_DATE });
    expect(exp.env).toBe('production');
    expect(exp.container.exportFormatVersion).toBe(2);
    expect(exp.pretty).toContain('"exportFormatVersion": 2');
    expect(exp.pretty.endsWith('\n')).toBe(true);
    expect(exp.minified).toContain('"exportFormatVersion":2');
    expect(exp.stats.tags).toBeGreaterThan(0);
    expect(exp.meta.sizeBytes).toBe(Buffer.byteLength(exp.pretty, 'utf8'));
  });
});

describe('computeStats', () => {
  it('compte correctement les chat triggers et chat dims', () => {
    const c = buildContainer({ env: 'production', exportTime: FIXED_DATE });
    const stats = computeStats(c);
    expect(stats.chatTriggers).toBeGreaterThanOrEqual(18);
    expect(stats.chatDims).toBeGreaterThanOrEqual(5);
  });
});

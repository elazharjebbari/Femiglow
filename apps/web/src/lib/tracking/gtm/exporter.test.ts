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
      (t) => t.type === 'CUSTOM_EVENT',
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
    const names = metaTags.map((t) => t.name);
    // Les noms de tags Meta incluent l'event FemiGlow source pour éviter les
    // doublons (cf. duplicate_name linter rule).
    expect(names.some((n) => n.includes('(Purchase)'))).toBe(true);
    expect(names.some((n) => n.includes('(ChatEngagement)'))).toBe(true);
    expect(names.some((n) => n.includes('(Contact)'))).toBe(true);
  });

  it('en environnement dev, ne crée aucun tag pixel (providers vides)', () => {
    const c = buildContainer({ env: 'dev', exportTime: FIXED_DATE });
    expect(c.containerVersion.tag).toHaveLength(0);
  });

  it("régression GTM import : enums au bon casing (UPPER_SNAKE pour parameter/trigger/filter/firing/builtIn)", () => {
    // Cf. docs Google + 4 conteneurs réels exportFormatVersion 2 (Shopify,
    // Stape, Wix, Planet-Caravan). L'UI « Importer un conteneur » exige :
    //   - parameter.type        ∈ TEMPLATE | BOOLEAN | INTEGER | LIST | MAP …
    //   - trigger.type          ∈ PAGEVIEW | CUSTOM_EVENT | CLICK …
    //   - customEventFilter.type∈ EQUALS | CONTAINS | REGEX …
    //   - tagFiringOption       ∈ ONCE_PER_EVENT | ONCE_PER_LOAD | UNLIMITED
    //   - builtInVariable.type  ∈ PAGE_URL | CLICK_ELEMENT | EVENT …
    // Les valeurs lowercase/camelCase sont systématiquement rejetées.
    // Tag.type et Variable.type, eux, RESTENT lowercase (`gaawc`, `gaawe`,
    // `html`, `c`, `v` — identifiants stables côté GTM).
    const c = buildContainer({ env: 'production', exportTime: FIXED_DATE });
    const cv = c.containerVersion;
    const isUpperSnake = (s: string): boolean => /^[A-Z][A-Z0-9_]*$/.test(s);

    // 1. Built-in variables
    for (const bv of cv.builtInVariable) {
      expect(isUpperSnake(bv.type), `builtInVariable.type=${bv.type}`).toBe(true);
    }
    // 2. Triggers + filters
    for (const tr of cv.trigger) {
      expect(isUpperSnake(tr.type), `trigger.type=${tr.type}`).toBe(true);
      for (const f of tr.customEventFilter ?? []) {
        expect(isUpperSnake(f.type), `customEventFilter.type=${f.type}`).toBe(true);
      }
      for (const f of tr.filter ?? []) {
        expect(isUpperSnake(f.type), `filter.type=${f.type}`).toBe(true);
      }
    }
    // 3. Tags : tagFiringOption + priority + parameter
    for (const t of cv.tag) {
      if (t.tagFiringOption) {
        expect(
          isUpperSnake(t.tagFiringOption),
          `tagFiringOption=${t.tagFiringOption}`,
        ).toBe(true);
      }
      if (t.priority) {
        // GTM rejette `priority.type = TEMPLATE` avec « La valeur de la
        // priorité de déclenchement doit être un nombre entier » — le type
        // doit être strictement `INTEGER` et la valeur un string décimal.
        expect(t.priority.type, `priority.type=${t.priority.type}`).toBe('INTEGER');
        expect(t.priority.value, `priority.value=${t.priority.value}`).toMatch(/^[0-9]+$/);
      }
      for (const p of t.parameter ?? []) {
        expect(isUpperSnake(p.type), `tag.parameter.type=${p.type}`).toBe(true);
      }
    }
    // 4. Parameters dans variables (deep)
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') return;
      const obj = node as Record<string, unknown>;
      if (typeof obj.type === 'string' && 'key' in obj) {
        // C'est un Parameter
        expect(isUpperSnake(obj.type as string), `parameter.type=${obj.type}`).toBe(
          true,
        );
      }
      for (const v of Object.values(obj)) visit(v);
    };
    for (const v of cv.variable) {
      for (const p of v.parameter ?? []) visit(p);
    }
  });

  it("régression GTM import : folderId en base-10 (UI rejette « Invalid parent_folder_id »)", () => {
    // GTM exige que `folderId` ET `parentFolderId` soient des chaînes
    // numériques en base 10 (`'1'`, `'12'`…). Le format historique `F-00`
    // déclenche « Invalid parent_folder_id (base 10 number expected) »
    // à l'import.
    const c = buildContainer({ env: 'production', exportTime: FIXED_DATE });
    const cv = c.containerVersion;
    const isBase10 = (s: string): boolean => /^[0-9]+$/.test(s);

    for (const f of cv.folder) {
      expect(isBase10(f.folderId), `folder.folderId=${f.folderId}`).toBe(true);
    }
    const checkRef = (id: string | undefined, where: string): void => {
      if (id === undefined) return;
      expect(isBase10(id), `${where}=${id}`).toBe(true);
    };
    for (const t of cv.tag) checkRef(t.parentFolderId, 'tag.parentFolderId');
    for (const t of cv.trigger) checkRef(t.parentFolderId, 'trigger.parentFolderId');
    for (const v of cv.variable) checkRef(v.parentFolderId, 'variable.parentFolderId');
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

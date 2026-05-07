/**
 * Tests dédiés du convertisseur descriptor → Mermaid.
 *
 * Cas couverts :
 *  - structure flowchart valide
 *  - subgraph par dossier (incluant chat)
 *  - --> entre triggers et tags
 *  - -. setup .-> pour setupTags
 *  - escape des guillemets et caractères spéciaux
 *  - sanitize des IDs (espaces, accents, caractères non-alphanum)
 *  - classDef trigCE pour les Custom Events
 *  - descripteur vide → flowchart minimal
 */
import { describe, expect, it } from 'vitest';
import { descriptorToMermaid } from './mermaid';
import type { GraphDescriptor } from './descriptor';

const SIMPLE: GraphDescriptor = {
  folders: [
    {
      id: 'F-08',
      name: '08 — Chat assistant',
      color: 'sauge-profond',
      items: [
        {
          kind: 'tag',
          name: 'GA4 Evt — chat_widget_open',
          type: 'gaawe',
          triggers: [{ name: 'CE — chat_widget_open', type: 'customEvent' }],
          setupTags: [],
        },
      ],
    },
  ],
  orphans: [],
  totalTags: 1,
  totalTriggers: 1,
  totalVariables: 0,
};

describe('descriptorToMermaid — structure', () => {
  it('démarre par "flowchart LR"', () => {
    expect(descriptorToMermaid(SIMPLE).split('\n')[0]).toBe('flowchart LR');
  });

  it('inclut un subgraph par dossier', () => {
    const mer = descriptorToMermaid(SIMPLE);
    expect(mer).toMatch(/subgraph\s+F_08\["08 — Chat assistant"\]/);
    expect(mer).toContain('end');
  });

  it('relie triggers → tags via "-->"', () => {
    const mer = descriptorToMermaid(SIMPLE);
    expect(mer).toMatch(/T_CE___chat_widget_open\s*-->\s*Tg_GA4_Evt___chat_widget_open/);
  });

  it('inclut un classDef trigCE pour les Custom Events', () => {
    expect(descriptorToMermaid(SIMPLE)).toContain('classDef trigCE');
  });

  it('marque les triggers Custom Event avec class trigCE', () => {
    const mer = descriptorToMermaid(SIMPLE);
    expect(mer).toMatch(/class T_CE___chat_widget_open trigCE/);
  });
});

describe('descriptorToMermaid — setup tags', () => {
  it('inclut une flèche pointillée "-. setup .->" pour les setupTags', () => {
    const desc: GraphDescriptor = {
      folders: [
        {
          id: 'F-02',
          name: '02 — E-commerce',
          color: 'sauge-clair',
          items: [
            {
              kind: 'tag',
              name: 'Meta Evt — Purchase',
              type: 'html',
              triggers: [{ name: 'CE — purchase', type: 'customEvent' }],
              setupTags: ['Meta Init'],
            },
          ],
        },
      ],
      orphans: [],
      totalTags: 1,
      totalTriggers: 1,
      totalVariables: 0,
    };
    const mer = descriptorToMermaid(desc);
    expect(mer).toContain('-. setup .->');
    expect(mer).toMatch(/Tg_Meta_Init/);
  });
});

describe('descriptorToMermaid — sanitize / escape', () => {
  it('échappe les guillemets dans les noms de tags', () => {
    const desc: GraphDescriptor = {
      folders: [
        {
          id: 'F-X',
          name: 'Folder "weird"',
          color: 'stone',
          items: [
            {
              kind: 'tag',
              name: 'Tag "with quotes"',
              type: 'html',
              triggers: [],
              setupTags: [],
            },
          ],
        },
      ],
      orphans: [],
      totalTags: 1,
      totalTriggers: 0,
      totalVariables: 0,
    };
    const mer = descriptorToMermaid(desc);
    // Échappement \" présent
    expect(mer).toContain('Tag \\"with quotes\\"');
    expect(mer).toContain('Folder \\"weird\\"');
  });

  it('sanitize les IDs (caractères non-alphanum → _)', () => {
    const desc: GraphDescriptor = {
      folders: [],
      orphans: [
        {
          kind: 'tag',
          name: 'Tag — émoji 🎉 spécial',
          type: 'html',
          triggers: [{ name: 'CE — événement', type: 'customEvent' }],
          setupTags: [],
        },
      ],
      totalTags: 1,
      totalTriggers: 1,
      totalVariables: 0,
    };
    const mer = descriptorToMermaid(desc);
    // L'ID Mermaid utilise [A-Za-z0-9_]+, pas d'emoji ni accents.
    // Le nom "CE — événement" → sanitize donne `CE____v_nement` (4 underscores
    // pour " — ") puis `_v_nement` pour "événement".
    expect(mer).toMatch(/T_CE_+v_nement/);
    // Le nom original (avec accents et emoji) n'apparait pas comme ID,
    // mais peut apparaitre dans le label entre guillemets.
    expect(mer).not.toMatch(/T_CE — événement/);
  });

  it('remplace les retours à la ligne dans les noms par des espaces (dans les labels)', () => {
    const desc: GraphDescriptor = {
      folders: [],
      orphans: [
        {
          kind: 'tag',
          name: 'Multi\nline\ntag',
          type: 'html',
          triggers: [],
          setupTags: [],
        },
      ],
      totalTags: 1,
      totalTriggers: 0,
      totalVariables: 0,
    };
    const mer = descriptorToMermaid(desc);
    // Les newlines doivent être remplacés par des espaces dans le label.
    expect(mer).toContain('"Multi line tag"');
    // Pas de saut de ligne réel dans le label.
    const labelLine = mer.split('\n').find((l) => l.includes('Multi'));
    expect(labelLine).toBeDefined();
    expect(labelLine!.includes('\n')).toBe(false);
  });
});

describe('descriptorToMermaid — déduplication', () => {
  it("ne déclare un trigger qu'une seule fois même si plusieurs tags l'utilisent", () => {
    const desc: GraphDescriptor = {
      folders: [
        {
          id: 'F-02',
          name: '02 — E-commerce',
          color: 'sauge-clair',
          items: [
            {
              kind: 'tag',
              name: 'GA4 Evt — purchase',
              type: 'gaawe',
              triggers: [{ name: 'CE — purchase', type: 'customEvent' }],
              setupTags: [],
            },
            {
              kind: 'tag',
              name: 'Meta Evt — Purchase',
              type: 'html',
              triggers: [{ name: 'CE — purchase', type: 'customEvent' }],
              setupTags: [],
            },
          ],
        },
      ],
      orphans: [],
      totalTags: 2,
      totalTriggers: 1,
      totalVariables: 0,
    };
    const mer = descriptorToMermaid(desc);
    const triggerDecls = mer
      .split('\n')
      .filter((l) => l.match(/^\s*T_CE___purchase\(\[/));
    expect(triggerDecls).toHaveLength(1);
  });
});

describe('descriptorToMermaid — descripteur vide', () => {
  it('retourne au moins le header + classDef', () => {
    const empty: GraphDescriptor = {
      folders: [],
      orphans: [],
      totalTags: 0,
      totalTriggers: 0,
      totalVariables: 0,
    };
    const mer = descriptorToMermaid(empty);
    expect(mer).toContain('flowchart LR');
    expect(mer).toContain('classDef trigCE');
  });
});

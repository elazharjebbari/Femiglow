import { describe, it, expect } from 'vitest';
import { buildContainer } from '../builders';
import { buildGraphDescriptor } from './descriptor';
import { descriptorToMermaid } from './mermaid';

const FIXED = new Date('2026-05-07T10:00:00.000Z');

describe('buildGraphDescriptor', () => {
  it('regroupe les tags par dossier', () => {
    const container = buildContainer({ env: 'production', exportTime: FIXED });
    const desc = buildGraphDescriptor(container);
    expect(desc.folders.length).toBeGreaterThan(0);
    const chatFolder = desc.folders.find((f) => f.name.includes('Chat'));
    expect(chatFolder).toBeDefined();
    expect(chatFolder!.items.length).toBeGreaterThan(0);
    expect(chatFolder!.color).toBe('sauge-profond');
  });

  it('attache les triggers à chaque tag', () => {
    const container = buildContainer({ env: 'production', exportTime: FIXED });
    const desc = buildGraphDescriptor(container);
    const tag = desc.folders
      .flatMap((f) => f.items)
      .find((it) => it.name === 'GA4 Evt — purchase');
    expect(tag).toBeDefined();
    if (!tag) return;
    expect(tag.triggers.length).toBeGreaterThanOrEqual(1);
    expect(tag.triggers[0]?.name).toBe('CE — purchase');
  });

  it('en environnement dev, retourne 0 folder (aucun tag)', () => {
    const container = buildContainer({ env: 'dev', exportTime: FIXED });
    const desc = buildGraphDescriptor(container);
    expect(desc.folders).toHaveLength(0);
    expect(desc.totalTags).toBe(0);
  });

  it('expose les totaux globaux (tags/triggers/variables)', () => {
    const container = buildContainer({ env: 'production', exportTime: FIXED });
    const desc = buildGraphDescriptor(container);
    expect(desc.totalTags).toBeGreaterThan(0);
    expect(desc.totalTriggers).toBeGreaterThan(0);
    expect(desc.totalVariables).toBeGreaterThan(0);
  });
});

describe('descriptorToMermaid', () => {
  it('produit un flowchart valide démarrant par "flowchart LR"', () => {
    const container = buildContainer({ env: 'production', exportTime: FIXED });
    const desc = buildGraphDescriptor(container);
    const mer = descriptorToMermaid(desc);
    expect(mer.split('\n')[0]).toBe('flowchart LR');
    expect(mer).toContain('subgraph');
    expect(mer).toContain('end');
    expect(mer).toContain('-->');
  });

  it('échappe les guillemets dans les noms', () => {
    const container = buildContainer({ env: 'production', exportTime: FIXED });
    const desc = buildGraphDescriptor(container);
    const mer = descriptorToMermaid(desc);
    expect(mer.includes('"')).toBe(true);
  });

  it('inclut un classDef pour les triggers Custom Event', () => {
    const container = buildContainer({ env: 'production', exportTime: FIXED });
    const desc = buildGraphDescriptor(container);
    const mer = descriptorToMermaid(desc);
    expect(mer).toContain('classDef trigCE');
  });
});

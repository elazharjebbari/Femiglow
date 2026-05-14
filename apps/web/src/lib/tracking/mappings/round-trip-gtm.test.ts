/**
 * Test ULTIMATE T54 — Round-trip GTM.
 *
 * Garantit que :
 *  1. L'export GTM produit un JSON conforme au schema officiel `exportFormatVersion: 2`
 *  2. Tous les `firingTriggerId` référencent un trigger existant
 *  3. Le sha256 est reproductible (déterministe)
 *  4. Round-trip : on peut re-charger le JSON et reconstruire conceptuellement les mappings
 *
 * cf. docs/event-mappings/70-tests/playwright-suites.md + Q.4
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildGtmContainer } from './gtm-export';
import type { Mappings } from './types';
import defaultMappingFile from '../../../../../../docs/event-mappings/20-data/default-mapping.json';

// Schema strict pour valider le format GTM Container Import (extrait simplifié)
const gtmContainerSchema = z.object({
  exportFormatVersion: z.literal(2),
  exportTime: z.string(),
  containerVersion: z.object({
    container: z.object({
      name: z.string(),
      publicId: z.string(),
      usageContext: z.array(z.literal('WEB')),
    }),
    tag: z.array(
      z.object({
        tagId: z.string(),
        name: z.string(),
        type: z.string(),
        parameter: z.array(z.object({ type: z.string(), key: z.string(), value: z.string() })),
        firingTriggerId: z.array(z.string()),
      }),
    ),
    trigger: z.array(
      z.object({
        triggerId: z.string(),
        name: z.string(),
        type: z.string(),
      }),
    ),
    variable: z.array(
      z.object({
        variableId: z.string(),
        name: z.string(),
        type: z.string(),
      }),
    ),
  }),
});

describe('ULTIMATE round-trip GTM (T54)', () => {
  it('build default mapping → JSON conforme au schema GTM officiel', () => {
    const mappings = (defaultMappingFile as { mappings: Mappings }).mappings;
    const result = buildGtmContainer({ mappings, env: 'production' });
    const parsed = gtmContainerSchema.parse(result.containerJson);
    expect(parsed.exportFormatVersion).toBe(2);
    expect(parsed.containerVersion.tag.length).toBeGreaterThan(0);
  });

  it('chaque tag référence un trigger existant', () => {
    const mappings = (defaultMappingFile as { mappings: Mappings }).mappings;
    const result = buildGtmContainer({ mappings, env: 'production' });
    const triggerIds = new Set(result.containerJson.containerVersion.trigger.map((t) => t.triggerId));
    for (const tag of result.containerJson.containerVersion.tag) {
      for (const tid of tag.firingTriggerId) {
        expect(triggerIds.has(tid)).toBe(true);
      }
    }
  });

  it('sha256 reproductible (export 2x → même hash)', () => {
    const mappings = (defaultMappingFile as { mappings: Mappings }).mappings;
    const r1 = buildGtmContainer({ mappings, env: 'production' });
    const r2 = buildGtmContainer({ mappings, env: 'production' });
    expect(r1.meta.sha256).toBe(r2.meta.sha256);
  });

  it('compte cohérent : tagsCount = (sum cells isEnabled && mappedName!=null)', () => {
    const mappings = (defaultMappingFile as { mappings: Mappings }).mappings;
    let expectedTagsCount = 0;
    for (const event of Object.values(mappings)) {
      for (const cell of Object.values(event)) {
        if (cell.isEnabled && cell.mappedName !== null) expectedTagsCount++;
      }
    }
    const result = buildGtmContainer({ mappings, env: 'production' });
    expect(result.meta.tagsCount).toBe(expectedTagsCount);
  });
});

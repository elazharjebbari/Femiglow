/**
 * F28 — FAQ gateway — tests régression I3 + R2.
 *
 * Référence audit : `docs/chat-audit-2026-05/02-audit-critique.md` §I3, §R2
 *
 * I3 — Threshold default schema (0.85) vs commentaire orchestrator (0.60) :
 *      contradiction qui rend les FAQ entries silencieusement mortes si les
 *      seeders n'override pas le champ.
 *
 * R2 — FAQ branch dans orchestrator court-circuite la modération inbound :
 *      un message toxique qui matche FAQ par hasard sert la réponse
 *      scripted sans filtre. (Test documente le gap actuel.)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chatFaqEntryFactory, type ChatFaqEntryLike } from '@/test/factories/chat-faq-entry.factory';

describe('F28 — FAQ gateway — régression I3 (threshold contradiction)', () => {
  it('factory utilise threshold 0.60 (conforme commentaire orchestrator)', () => {
    const e = chatFaqEntryFactory.build();
    expect(e.threshold).toBeCloseTo(0.6, 2);
  });

  it('factory.highThreshold() = 0.9 (cas conservateur)', () => {
    const e = chatFaqEntryFactory.highThreshold();
    expect(e.threshold).toBeCloseTo(0.9, 2);
  });

  it('schema DB default = 0.85 (régression I3 — divergent vs factory 0.60)', () => {
    const schemaPath = resolve(__dirname, '../db/schema.ts');
    const content = readFileSync(schemaPath, 'utf8');
    // Vérifie que le default schema est bien 0.85 (état actuel)
    expect(content).toMatch(/threshold.*default\(['"`]0\.85['"`]\)/);
  });

  it('orchestrator commentaire mentionne 0.60 (régression I3 — divergent vs schema)', () => {
    const orchestratorPath = resolve(__dirname, '../services/orchestrator.ts');
    const content = readFileSync(orchestratorPath, 'utf8');
    // Vérifie que le commentaire fait référence à 0.60 (état actuel — gap)
    expect(content).toMatch(/0[,.]60|0\.6\b/);
  });

  it.fails('FIX I3 — schema default doit s\'aligner sur 0.60', () => {
    const schemaPath = resolve(__dirname, '../db/schema.ts');
    const content = readFileSync(schemaPath, 'utf8');
    // Après fix : le default devrait être 0.6 ou 0.65, PAS 0.85
    expect(content).toMatch(/threshold.*default\(['"`]0\.6[05]?['"`]\)/);
  });

  it.fails('FIX I3 — seeders chat-faq doivent forcer threshold explicite', () => {
    const seederPath = resolve(__dirname, '../../seeders/items/chat-faq.ts');
    const content = readFileSync(seederPath, 'utf8');
    // Après fix : chaque entry du seeder doit avoir un threshold explicite
    expect(content).toMatch(/threshold:\s*['"]?0?\.\d+/);
  });
});

describe('F28 — FAQ entry — contrat', () => {
  it('factory produit toutes les colonnes du schema', () => {
    const e = chatFaqEntryFactory.build();
    const required: (keyof ChatFaqEntryLike)[] = [
      'id', 'key', 'language', 'audience', 'questionCanonical',
      'questionEmbedding', 'scriptedReply', 'threshold', 'enabled',
      'createdAt', 'updatedAt',
    ];
    for (const k of required) {
      expect(e).toHaveProperty(k);
    }
  });

  it('questionEmbedding a 1536 dimensions (compatible OpenAI text-embedding-3-small)', () => {
    const e = chatFaqEntryFactory.build();
    expect(e.questionEmbedding).toHaveLength(1536);
  });

  it('traits langue produisent la bonne language', () => {
    expect(chatFaqEntryFactory.fr().language).toBe('fr');
    expect(chatFaqEntryFactory.ar().language).toBe('ar');
    expect(chatFaqEntryFactory.arMa().language).toBe('ar-MA');
  });

  it('disabled() désactive enabled', () => {
    expect(chatFaqEntryFactory.disabled().enabled).toBe(false);
  });
});

describe('F28 — régression R2 — FAQ branch hors modération inbound', () => {
  it.fails('FIX R2 — orchestrator doit appeler moderation AVANT FAQ match', () => {
    // Le test inspecte l'ordre des appels dans orchestrator.ts.
    // Actuellement la branche FAQ (lignes 189-260) sert le canned reply
    // sans passer par moderation. Le fix consiste à appeler
    // `moderateChatText` AVANT de yielder la FAQ scripted reply.
    const orchestratorPath = resolve(__dirname, '../services/orchestrator.ts');
    const content = readFileSync(orchestratorPath, 'utf8');
    // Heuristique : vérifier la présence d'un appel moderateChatText dans la branche FAQ
    const faqBranchMatch = content.match(/faq[\s\S]{0,2000}moderateChatText/);
    expect(faqBranchMatch).not.toBeNull();
  });
});

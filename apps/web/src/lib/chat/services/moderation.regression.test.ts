/**
 * F27 — Moderation — tests étendus + régression C2.
 *
 * Référence audit : `docs/chat-audit-2026-05/02-audit-critique.md` §C2
 * (modération outbound advisory only — réponse déjà streamée).
 */
import { describe, it, expect } from 'vitest';
import { decideOnModeration, type ChatModerationResult } from './moderation';

function makeResult(overrides: Partial<ChatModerationResult> = {}): ChatModerationResult {
  return {
    flagged: false,
    categories: [],
    scores: {},
    source: 'openai',
    latencyMs: 50,
    ...overrides,
  };
}

describe('F27 — decideOnModeration', () => {
  describe('allow path', () => {
    it('not flagged → allow', () => {
      const r = decideOnModeration(makeResult({ flagged: false }), 'inbound');
      expect(r.action).toBe('allow');
    });

    it('source=disabled → allow (flag off)', () => {
      const r = decideOnModeration(makeResult({ source: 'disabled' }), 'outbound');
      expect(r.action).toBe('allow');
    });

    it('source=fail_soft + not flagged → allow', () => {
      const r = decideOnModeration(makeResult({ source: 'fail_soft' }), 'inbound');
      expect(r.action).toBe('allow');
    });
  });

  describe('inbound flagged → replace_scripted', () => {
    test.each([
      ['hate', false],
      ['harassment', false],
      ['violence/graphic', true],
      ['sexual/minors', true],
    ])('flagged %s (hard=%s) → replace_scripted', (category) => {
      const r = decideOnModeration(
        makeResult({ flagged: true, categories: [category] }),
        'inbound',
      );
      expect(r.action).toBe('replace_scripted');
      expect(r.scriptedMessage).toBeTruthy();
    });
  });

  describe('outbound flagged → truncate ou reject', () => {
    it('soft category (hate) → truncate', () => {
      const r = decideOnModeration(
        makeResult({ flagged: true, categories: ['hate'] }),
        'outbound',
      );
      expect(r.action).toBe('truncate');
    });

    it('hard category (sexual/minors) → reject', () => {
      const r = decideOnModeration(
        makeResult({ flagged: true, categories: ['sexual/minors'] }),
        'outbound',
      );
      expect(r.action).toBe('reject');
      expect(r.scriptedMessage).toBeTruthy();
    });

    it('hard category (violence/graphic) → reject', () => {
      const r = decideOnModeration(
        makeResult({ flagged: true, categories: ['violence/graphic'] }),
        'outbound',
      );
      expect(r.action).toBe('reject');
    });
  });

  describe('régression C2 — outbound advisory limitation', () => {
    it('le SDK retourne une decision mais c\'est à l\'orchestrator de l\'enforcer AVANT le yield', () => {
      // Le contrat actuel est correct : decideOnModeration retourne `action`
      // L'usage est advisory côté orchestrator → c'est là que le bug C2 vit.
      const r = decideOnModeration(
        makeResult({ flagged: true, categories: ['hate'] }),
        'outbound',
      );
      // Au minimum on a un action != allow
      expect(r.action).not.toBe('allow');
    });

    it.fails('FUTUR C2 — la decision outbound devrait avoir un flag mustBufferBeforeYield', () => {
      const r = decideOnModeration(
        makeResult({ flagged: true, categories: ['hate'] }),
        'outbound',
      );
      // À implémenter : signal explicite pour l'orchestrator de NE PAS yielder progressivement
      expect((r as { mustBufferBeforeYield?: boolean }).mustBufferBeforeYield).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('flagged sans categories → cas dégénéré, action != allow', () => {
      const r = decideOnModeration(
        makeResult({ flagged: true, categories: [] }),
        'outbound',
      );
      expect(r.action).not.toBe('allow');
    });

    it('multiple categories incluant hard → reject prend priorité', () => {
      const r = decideOnModeration(
        makeResult({
          flagged: true,
          categories: ['hate', 'sexual/minors'],
        }),
        'outbound',
      );
      expect(r.action).toBe('reject');
    });
  });
});

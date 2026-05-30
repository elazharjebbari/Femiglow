/**
 * State machine tests — F21.
 *
 * Tests exhaustifs sur la matrix de transitions :
 * - 11 transitions valides explicites
 * - 22 transitions invalides (depuis published, cancelled, ou autres
 *   shortcuts comme draft→published)
 * - États terminaux + retry
 */
import { describe, expect, it } from 'vitest';
import {
  assertSocialPublishJobTransition,
  canTransitionSocialPublishJob,
  isTerminalSocialPublishJobStatus,
  nextRetryStatus,
} from './state-machine';
import type { SocialPublishJobStatus } from './contracts';

const ALL_STATUSES: SocialPublishJobStatus[] = [
  'draft',
  'approved',
  'queued',
  'publishing',
  'published',
  'failed',
  'cancelled',
];

const VALID_TRANSITIONS: Array<[SocialPublishJobStatus, SocialPublishJobStatus]> = [
  ['draft', 'approved'],
  ['draft', 'cancelled'],
  ['approved', 'queued'],
  ['approved', 'cancelled'],
  ['queued', 'publishing'],
  ['queued', 'cancelled'],
  ['queued', 'failed'],
  ['publishing', 'published'],
  ['publishing', 'failed'],
  ['failed', 'queued'],
  ['failed', 'cancelled'],
];

describe('social publishing state machine', () => {
  describe('happy paths', () => {
    it('autorise le chemin nominal de publication', () => {
      expect(canTransitionSocialPublishJob('draft', 'approved')).toBe(true);
      expect(canTransitionSocialPublishJob('approved', 'queued')).toBe(true);
      expect(canTransitionSocialPublishJob('queued', 'publishing')).toBe(true);
      expect(canTransitionSocialPublishJob('publishing', 'published')).toBe(true);
    });
  });

  describe('valid transitions matrix', () => {
    it.each(VALID_TRANSITIONS)('autorise %s → %s', (from, to) => {
      expect(canTransitionSocialPublishJob(from, to)).toBe(true);
      expect(() => assertSocialPublishJobTransition(from, to)).not.toThrow();
    });
  });

  describe('invalid transitions — terminal states', () => {
    it.each(ALL_STATUSES.filter((s) => s !== 'published'))('refuse published → %s', (to) => {
      expect(canTransitionSocialPublishJob('published', to)).toBe(false);
      expect(() => assertSocialPublishJobTransition('published', to)).toThrow();
    });

    it.each(ALL_STATUSES.filter((s) => s !== 'cancelled'))('refuse cancelled → %s', (to) => {
      expect(canTransitionSocialPublishJob('cancelled', to)).toBe(false);
      expect(() => assertSocialPublishJobTransition('cancelled', to)).toThrow();
    });
  });

  describe('invalid transitions — skips', () => {
    it('refuse draft → published (skip queued+publishing)', () => {
      expect(canTransitionSocialPublishJob('draft', 'published')).toBe(false);
    });

    it('refuse draft → publishing', () => {
      expect(canTransitionSocialPublishJob('draft', 'publishing')).toBe(false);
    });

    it('refuse draft → queued (need approved first)', () => {
      expect(canTransitionSocialPublishJob('draft', 'queued')).toBe(false);
    });

    it('refuse approved → published (skip queued)', () => {
      expect(canTransitionSocialPublishJob('approved', 'published')).toBe(false);
    });

    it('refuse approved → publishing', () => {
      expect(canTransitionSocialPublishJob('approved', 'publishing')).toBe(false);
    });

    it('refuse queued → published (skip publishing)', () => {
      expect(canTransitionSocialPublishJob('queued', 'published')).toBe(false);
    });

    it('refuse publishing → queued (cannot rollback during in-flight)', () => {
      expect(canTransitionSocialPublishJob('publishing', 'queued')).toBe(false);
    });

    it('refuse publishing → cancelled (must use failed first)', () => {
      expect(canTransitionSocialPublishJob('publishing', 'cancelled')).toBe(false);
    });

    it('refuse failed → published (need retry first)', () => {
      expect(canTransitionSocialPublishJob('failed', 'published')).toBe(false);
    });

    it('refuse failed → publishing (need to go through queued)', () => {
      expect(canTransitionSocialPublishJob('failed', 'publishing')).toBe(false);
    });
  });

  describe('same-state transitions', () => {
    it.each(ALL_STATUSES)('refuse %s → %s (no-op not allowed)', (s) => {
      expect(canTransitionSocialPublishJob(s, s)).toBe(false);
    });
  });

  describe('bloque les transitions dangereuses', () => {
    it('published → queued est interdit', () => {
      expect(canTransitionSocialPublishJob('published', 'queued')).toBe(false);
    });

    it('assertSocialPublishJobTransition lance une erreur explicite', () => {
      expect(() => assertSocialPublishJobTransition('draft', 'published')).toThrow(
        /Invalid social publish transition/,
      );
    });
  });

  describe('retry', () => {
    it('ne retry que les jobs failed', () => {
      expect(nextRetryStatus('failed')).toBe('queued');
    });

    it.each<SocialPublishJobStatus>([
      'draft',
      'approved',
      'queued',
      'publishing',
      'published',
      'cancelled',
    ])('refuse retry depuis %s', (s) => {
      expect(() => nextRetryStatus(s)).toThrow(/Only failed/);
    });
  });

  describe('états terminaux', () => {
    it('published est terminal', () => {
      expect(isTerminalSocialPublishJobStatus('published')).toBe(true);
    });
    it('cancelled est terminal', () => {
      expect(isTerminalSocialPublishJobStatus('cancelled')).toBe(true);
    });
    it.each<SocialPublishJobStatus>(['draft', 'approved', 'queued', 'publishing', 'failed'])(
      '%s n est pas terminal',
      (s) => {
        expect(isTerminalSocialPublishJobStatus(s)).toBe(false);
      },
    );
  });
});

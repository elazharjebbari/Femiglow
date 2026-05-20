import { describe, expect, it } from 'vitest';
import {
  assertSocialPublishJobTransition,
  canTransitionSocialPublishJob,
  isTerminalSocialPublishJobStatus,
  nextRetryStatus,
} from './state-machine';

describe('social publishing state machine', () => {
  it('autorise le chemin nominal de publication', () => {
    expect(canTransitionSocialPublishJob('draft', 'approved')).toBe(true);
    expect(canTransitionSocialPublishJob('approved', 'queued')).toBe(true);
    expect(canTransitionSocialPublishJob('queued', 'publishing')).toBe(true);
    expect(canTransitionSocialPublishJob('publishing', 'published')).toBe(true);
  });

  it('bloque les transitions dangereuses', () => {
    expect(canTransitionSocialPublishJob('published', 'queued')).toBe(false);
    expect(() => assertSocialPublishJobTransition('draft', 'published')).toThrow(/Invalid social publish transition/);
  });

  it('ne retry que les jobs échoués', () => {
    expect(nextRetryStatus('failed')).toBe('queued');
    expect(() => nextRetryStatus('publishing')).toThrow(/Only failed/);
  });

  it('identifie les états terminaux', () => {
    expect(isTerminalSocialPublishJobStatus('published')).toBe(true);
    expect(isTerminalSocialPublishJobStatus('cancelled')).toBe(true);
    expect(isTerminalSocialPublishJobStatus('failed')).toBe(false);
  });
});

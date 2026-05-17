import { describe, expect, it } from 'vitest';
import { canTransition } from './state-machine';
import { HttpError } from '@/lib/errors/http-error';

describe('content-studio state machine transitions', () => {
  describe('valid transitions', () => {
    const validTransitions: Array<[string, string]> = [
      ['idea', 'brief'],
      ['idea', 'archived'],
      ['brief', 'generated'],
      ['brief', 'rejected'],
      ['brief', 'archived'],
      ['generated', 'needs_review'],
      ['generated', 'rejected'],
      ['generated', 'archived'],
      ['needs_review', 'approved'],
      ['needs_review', 'generated'],
      ['needs_review', 'rejected'],
      ['needs_review', 'archived'],
      ['approved', 'scheduled'],
      ['approved', 'archived'],
      ['scheduled', 'published'],
      ['scheduled', 'failed'],
      ['scheduled', 'cancelled'],
      ['scheduled', 'approved'],
      ['published', 'measured'],
      ['published', 'archived'],
      ['failed', 'scheduled'],
      ['failed', 'archived'],
      ['cancelled', 'archived'],
      ['rejected', 'generated'],
      ['rejected', 'archived'],
      ['measured', 'archived'],
    ];

    it.each(validTransitions)('autorise %s → %s', (from, to) => {
      expect(canTransition(from as ContentStatus, to as ContentStatus)).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    const invalidTransitions: Array<[string, string]> = [
      ['idea', 'approved'],
      ['idea', 'scheduled'],
      ['idea', 'published'],
      ['generated', 'approved'],
      ['generated', 'scheduled'],
      ['needs_review', 'scheduled'],
      ['needs_review', 'published'],
      ['approved', 'needs_review'],
      ['approved', 'generated'],
      ['scheduled', 'needs_review'],
      ['published', 'approved'],
      ['archived', 'idea'],
      ['archived', 'generated'],
      ['measured', 'scheduled'],
    ];

    it.each(invalidTransitions)('interdit %s → %s', (from, to) => {
      expect(canTransition(from as ContentStatus, to as ContentStatus)).toBe(false);
    });
  });
});

// Import ContentStatus type for the test
type ContentStatus = 'idea' | 'brief' | 'generated' | 'needs_review' | 'approved' | 'scheduled' | 'published' | 'failed' | 'cancelled' | 'rejected' | 'archived' | 'measured';
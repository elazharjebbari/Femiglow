import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { CostTracker, globalCostTracker } from './cost-tracker';

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
    vi.useFakeTimers();
    // Set a known date for deterministic tests
    vi.setSystemTime(new Date('2026-05-25T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('recordCost adds to daily spend', () => {
    tracker.recordCost('tenant-1', 'openai', 'gpt-4', 'generateScript', 100, 50, 5);
    expect(tracker.getDailySpend('tenant-1')).toBe(5);
  });

  it('getDailySpend returns accumulated costs', () => {
    tracker.recordCost('tenant-1', 'openai', 'gpt-4', 'generateScript', 100, 50, 5);
    tracker.recordCost('tenant-1', 'openai', 'gpt-4', 'generateCaption', 80, 40, 3);
    tracker.recordCost('tenant-1', 'openai', 'dall-e-3', 'generateImages', 0, 0, 8);
    expect(tracker.getDailySpend('tenant-1')).toBe(16);
  });

  it('getRemainingBudget returns budget minus spend', () => {
    tracker.recordCost('tenant-1', 'openai', 'gpt-4', 'generateScript', 100, 50, 30);
    const remaining = tracker.getRemainingBudget('tenant-1', 100);
    expect(remaining).toBe(70);
  });

  it('resets on new day', () => {
    tracker.recordCost('tenant-1', 'openai', 'gpt-4', 'generateScript', 100, 50, 25);
    expect(tracker.getDailySpend('tenant-1')).toBe(25);

    // Advance to the next day
    vi.setSystemTime(new Date('2026-05-26T12:00:00Z'));

    expect(tracker.getDailySpend('tenant-1')).toBe(0);
  });

  it('tracks multiple providers separately per tenant', () => {
    tracker.recordCost('tenant-1', 'openai', 'gpt-4', 'node-a', 100, 50, 10);
    tracker.recordCost('tenant-2', 'anthropic', 'claude-3', 'node-b', 200, 100, 20);

    expect(tracker.getDailySpend('tenant-1')).toBe(10);
    expect(tracker.getDailySpend('tenant-2')).toBe(20);
  });

  it('zero cost returns full budget remaining', () => {
    const remaining = tracker.getRemainingBudget('tenant-1', 500);
    expect(remaining).toBe(500);
  });

  it('returns 0 (not negative) when over budget via getRemainingBudget', () => {
    tracker.recordCost('tenant-1', 'openai', 'gpt-4', 'node-a', 100, 50, 150);
    const remaining = tracker.getRemainingBudget('tenant-1', 100);
    // getRemainingBudget uses Math.max(0, ...) so it clamps at 0
    expect(remaining).toBe(0);
  });

  it('globalCostTracker is a singleton', () => {
    expect(globalCostTracker).toBeInstanceOf(CostTracker);
    // Record cost and verify it persists on the same instance
    globalCostTracker.recordCost('singleton-test', 'openai', 'gpt-4', 'test', 10, 5, 2);
    expect(globalCostTracker.getDailySpend('singleton-test')).toBe(2);
  });
});

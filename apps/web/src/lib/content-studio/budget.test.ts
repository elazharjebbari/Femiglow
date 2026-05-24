import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { ContentGenerationRun } from './types';

// Pure logic tests — no DB, env, or module dependency
// We replicate the budget check logic to test the branching.

class TestHttpError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'HttpError';
  }
}

function checkBudgetLogic(
  budgetCents: number,
  spentCents: number,
  estimatedCostCents: number,
): void {
  if (budgetCents <= 0) return; // unlimited
  if (spentCents + estimatedCostCents > budgetCents) {
    throw new TestHttpError(
      'budget_exceeded',
      `Budget quotidien dépassé : ${spentCents}¢ dépensés + ${estimatedCostCents}¢ estimés > ${budgetCents}¢ budget.`,
    );
  }
}

describe('Budget check logic', () => {
  it('autorise quand budget est 0 (illimité)', () => {
    expect(() => checkBudgetLogic(0, 9999, 100)).not.toThrow();
  });

  it('autorise quand budget est négatif (illimité)', () => {
    expect(() => checkBudgetLogic(-1, 9999, 100)).not.toThrow();
  });

  it('autorise quand dépense + estimation <= budget', () => {
    expect(() => checkBudgetLogic(100, 50, 40)).not.toThrow();
  });

  it('autorise quand dépense + estimation == budget exact', () => {
    expect(() => checkBudgetLogic(100, 50, 50)).not.toThrow();
  });

  it('rejette quand dépense + estimation > budget', () => {
    expect(() => checkBudgetLogic(100, 50, 51)).toThrow(TestHttpError);
  });

  it('rejette avec le bon code erreur', () => {
    try {
      checkBudgetLogic(100, 80, 30);
    } catch (e) {
      expect(e).toBeInstanceOf(TestHttpError);
      expect((e as TestHttpError).code).toBe('budget_exceeded');
    }
  });

  it('rejette même si estimation seule <= budget', () => {
    expect(() => checkBudgetLogic(100, 95, 10)).toThrow(TestHttpError);
  });
});

// ---------------------------------------------------------------------------
// Integration-style tests — mock repository + env, import the real module
// ---------------------------------------------------------------------------

function buildRun(overrides: Partial<ContentGenerationRun> = {}): ContentGenerationRun {
  return {
    id: 'cgr_test',
    ideaId: null,
    briefId: null,
    provider: 'openai',
    model: 'gpt-4o-mini',
    promptVersion: 'v0',
    input: {},
    output: {},
    status: 'succeeded',
    costCents: 10,
    errorMessage: null,
    createdBy: null,
    createdAt: new Date(),
    ...overrides,
  };
}

vi.mock('./repository', () => ({
  listGenerationRuns: vi.fn().mockResolvedValue([]),
}));

describe('getDailySpentCents', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('ADMIN_SESSION_PASSWORD', 'a'.repeat(32));
    vi.stubEnv('WEBHOOK_SECRET_KEY', 'b'.repeat(32));
    vi.stubEnv('CRON_SECRET', 'c'.repeat(32));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('sums costCents from generation runs created today only', async () => {
    const { listGenerationRuns } = await import('./repository');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    (listGenerationRuns as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildRun({ costCents: 20, createdAt: today }),
      buildRun({ costCents: 30, createdAt: today }),
      buildRun({ costCents: 100, createdAt: yesterday }),
    ]);

    const { getDailySpentCents } = await import('./budget');
    const spent = await getDailySpentCents();
    expect(spent).toBe(50);
  });

  it('returns 0 when no runs exist', async () => {
    const { listGenerationRuns } = await import('./repository');
    (listGenerationRuns as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { getDailySpentCents } = await import('./budget');
    const spent = await getDailySpentCents();
    expect(spent).toBe(0);
  });
});

describe('checkDailyBudget', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('ADMIN_SESSION_PASSWORD', 'a'.repeat(32));
    vi.stubEnv('WEBHOOK_SECRET_KEY', 'b'.repeat(32));
    vi.stubEnv('CRON_SECRET', 'c'.repeat(32));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('always allows when budget is 0 (unlimited)', async () => {
    vi.stubEnv('CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS', '0');
    const { checkDailyBudget } = await import('./budget');
    // Should not throw even with a large estimated cost
    await expect(checkDailyBudget(99999)).resolves.toBeUndefined();
  });

  it('allows when spent < budget', async () => {
    vi.stubEnv('CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS', '100');
    const { listGenerationRuns } = await import('./repository');
    (listGenerationRuns as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildRun({ costCents: 40, createdAt: new Date() }),
    ]);
    const { checkDailyBudget } = await import('./budget');
    await expect(checkDailyBudget(10)).resolves.toBeUndefined();
  });

  it('refuses when spent + estimated > budget', async () => {
    vi.stubEnv('CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS', '100');
    const { listGenerationRuns } = await import('./repository');
    (listGenerationRuns as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildRun({ costCents: 90, createdAt: new Date() }),
    ]);
    const { checkDailyBudget } = await import('./budget');
    await expect(checkDailyBudget(20)).rejects.toThrow(/budget/i);
  });

  it('refuses when spent equals budget exactly and estimated > 0', async () => {
    vi.stubEnv('CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS', '100');
    const { listGenerationRuns } = await import('./repository');
    (listGenerationRuns as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildRun({ costCents: 100, createdAt: new Date() }),
    ]);
    const { checkDailyBudget } = await import('./budget');
    await expect(checkDailyBudget(1)).rejects.toThrow(/budget/i);
  });
});
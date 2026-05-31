import { describe, it, expect } from 'vitest';

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
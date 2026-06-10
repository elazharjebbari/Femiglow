import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests RÉELS du module ./budget — avant, ce fichier redéclarait une copie de
 * la logique (`checkBudgetLogic`) et ne validait jamais le module de prod
 * (auto-validant, audit 2026-06-10 §04). On importe ici le vrai module avec
 * `vi.resetModules()` + `vi.stubEnv` pour faire varier le budget env.
 */
describe('budget — module réel (checkDailyBudget / getDailySpentCents)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('ADMIN_SESSION_PASSWORD', 'a'.repeat(32));
    vi.stubEnv('WEBHOOK_SECRET_KEY', 'b'.repeat(32));
    vi.stubEnv('CRON_SECRET', 'c'.repeat(32));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function setup(budgetCents: string) {
    vi.stubEnv('CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS', budgetCents);
    const { resetMemoryStore } = await import('@/lib/db/client');
    resetMemoryStore();
    const { insertGenerationRun } = await import('./repository');
    const { checkDailyBudget, getDailySpentCents } = await import('./budget');
    return { insertGenerationRun, checkDailyBudget, getDailySpentCents };
  }

  function runFixture(costCents: number) {
    return {
      ideaId: null,
      briefId: null,
      provider: 'openai',
      model: 'gpt-image-1-mini',
      promptVersion: 'test-v0',
      input: {},
      output: {},
      status: 'succeeded' as const,
      costCents,
      errorMessage: null,
      createdBy: null,
    };
  }

  it('budget 0 = illimité (jamais de blocage)', async () => {
    const { insertGenerationRun, checkDailyBudget } = await setup('0');
    await insertGenerationRun(runFixture(9999));
    await expect(checkDailyBudget(1000)).resolves.toBeUndefined();
  });

  it('cumule les runs du jour et lève budget_exceeded au dépassement', async () => {
    const { insertGenerationRun, checkDailyBudget, getDailySpentCents } = await setup('10');
    await insertGenerationRun(runFixture(4));
    await insertGenerationRun(runFixture(5));
    expect(await getDailySpentCents()).toBe(9);
    // 9 + 1 = 10 ≤ 10 → autorisé ; 9 + 2 = 11 > 10 → bloqué.
    await expect(checkDailyBudget(1)).resolves.toBeUndefined();
    await expect(checkDailyBudget(2)).rejects.toMatchObject({ code: 'budget_exceeded' });
  });

  it('autorise quand rien n’a été dépensé aujourd’hui', async () => {
    const { checkDailyBudget, getDailySpentCents } = await setup('10');
    expect(await getDailySpentCents()).toBe(0);
    await expect(checkDailyBudget(10)).resolves.toBeUndefined();
  });
});

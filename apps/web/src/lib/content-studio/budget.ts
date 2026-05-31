import { HttpError } from '@/lib/errors/http-error';
import { env } from '@/lib/env';
import { listGenerationRuns } from './repository';

export async function getDailySpentCents(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const runs = await listGenerationRuns(1000);
  return runs
    .filter((r) => r.createdAt.getTime() >= today.getTime())
    .reduce((sum, r) => sum + r.costCents, 0);
}

export async function checkDailyBudget(estimatedCostCents: number): Promise<void> {
  const budgetCents = Number(env.CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS) || 0;
  if (budgetCents <= 0) return; // 0 = unlimited

  const spent = await getDailySpentCents();
  if (spent + estimatedCostCents > budgetCents) {
    throw new HttpError(
      'budget_exceeded',
      `Budget quotidien dépassé : ${spent}¢ dépensés + ${estimatedCostCents}¢ estimés > ${budgetCents}¢ budget.`,
    );
  }
}
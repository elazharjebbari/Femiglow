interface CostEntry {
  tenantId: string;
  provider: string;
  model: string;
  node: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  timestamp: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export class CostTracker {
  private readonly entries = new Map<string, CostEntry[]>();
  private lastResetDate = todayKey();

  recordCost(
    tenantId: string,
    provider: string,
    model: string,
    node: string,
    inputTokens: number,
    outputTokens: number,
    costCents: number,
  ): void {
    this.resetIfNewDay();

    const key = `${tenantId}:${todayKey()}`;
    const existing = this.entries.get(key) ?? [];
    existing.push({
      tenantId,
      provider,
      model,
      node,
      inputTokens,
      outputTokens,
      costCents,
      timestamp: Date.now(),
    });
    this.entries.set(key, existing);
  }

  getDailySpend(tenantId: string): number {
    this.resetIfNewDay();
    const key = `${tenantId}:${todayKey()}`;
    const entries = this.entries.get(key);
    if (!entries) return 0;
    return entries.reduce((sum, e) => sum + e.costCents, 0);
  }

  getRemainingBudget(tenantId: string, dailyBudgetCents: number): number {
    const spent = this.getDailySpend(tenantId);
    return Math.max(0, dailyBudgetCents - spent);
  }

  private resetIfNewDay(): void {
    const today = todayKey();
    if (today !== this.lastResetDate) {
      this.entries.clear();
      this.lastResetDate = today;
    }
  }
}

export const globalCostTracker = new CostTracker();

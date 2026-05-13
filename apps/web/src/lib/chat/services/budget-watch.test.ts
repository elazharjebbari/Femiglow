/**
 * CHAT-047 — Tests `watchProviderBudgets`.
 *
 * On mocke `providerRepo.listAll` + `providerRepo.update` pour valider :
 *  - rapport vide quand aucun provider activé n'a de quota
 *  - warned quand ratio >= 0.8 et < 1.0
 *  - disabled quand ratio >= 1.0 (et appel update enabled=false)
 *  - dryRun ne mute pas la DB
 *  - providers déjà désactivés ignorés
 *  - thresholds custom respectés
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repos/provider', () => ({
  providerRepo: {
    listAll: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('./slack-notify', () => ({
  sendChatAlert: vi.fn(),
}));

import { providerRepo } from '../repos/provider';
import { sendChatAlert } from './slack-notify';
import { watchProviderBudgets } from './budget-watch';

const listMock = providerRepo.listAll as unknown as ReturnType<typeof vi.fn>;
const updateMock = providerRepo.update as unknown as ReturnType<typeof vi.fn>;
const alertMock = sendChatAlert as unknown as ReturnType<typeof vi.fn>;

function provider(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'cp_1',
    kind: 'openai',
    label: 'OpenAI primary',
    role: 'chat',
    priority: 100,
    enabled: true,
    chatModel: 'gpt-4o-mini',
    embeddingModel: null,
    moderationModel: null,
    apiBase: null,
    apiKeyEncrypted: null,
    apiKeyIv: null,
    headers: null,
    parameters: null,
    quotaMonthlyEur: '10.00',
    consumedMonthEur: '0.000000',
    consumedResetAt: new Date(),
    egressAllowed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('watchProviderBudgets', () => {
  it('renvoie un rapport vide si aucun provider ne consomme', async () => {
    listMock.mockResolvedValueOnce([provider({ consumedMonthEur: '0.000000' })]);
    const report = await watchProviderBudgets();
    expect(report.scanned).toBe(1);
    expect(report.warned).toBe(0);
    expect(report.disabled).toBe(0);
    expect(report.alerts).toEqual([]);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('warn quand ratio >= 0.8 et < 1.0', async () => {
    listMock.mockResolvedValueOnce([
      provider({ consumedMonthEur: '8.500000', quotaMonthlyEur: '10.00' }),
    ]);
    const report = await watchProviderBudgets();
    expect(report.warned).toBe(1);
    expect(report.disabled).toBe(0);
    expect(report.alerts[0]).toMatchObject({
      providerId: 'cp_1',
      action: 'warned',
      consumedEur: 8.5,
      quotaEur: 10,
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('disable quand ratio >= 1.0 et appelle update + sendChatAlert', async () => {
    listMock.mockResolvedValueOnce([
      provider({ consumedMonthEur: '10.500000', quotaMonthlyEur: '10.00' }),
    ]);
    updateMock.mockResolvedValueOnce({ id: 'cp_1', enabled: false });
    alertMock.mockResolvedValueOnce(true);
    const report = await watchProviderBudgets();
    expect(report.disabled).toBe(1);
    expect(report.warned).toBe(0);
    expect(report.alerts[0]).toMatchObject({
      providerId: 'cp_1',
      action: 'disabled',
    });
    expect(updateMock).toHaveBeenCalledWith('cp_1', { enabled: false });
    expect(alertMock).toHaveBeenCalledTimes(1);
    expect(alertMock.mock.calls[0]?.[0]).toMatchObject({
      severity: 'critical',
    });
  });

  it("n'envoie pas d'alerte Slack en dry-run", async () => {
    listMock.mockResolvedValueOnce([
      provider({ consumedMonthEur: '20.000000', quotaMonthlyEur: '10.00' }),
    ]);
    const report = await watchProviderBudgets({ dryRun: true });
    expect(report.disabled).toBe(1);
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("n'envoie pas d'alerte Slack pour un simple warn", async () => {
    listMock.mockResolvedValueOnce([
      provider({ consumedMonthEur: '8.500000', quotaMonthlyEur: '10.00' }),
    ]);
    const report = await watchProviderBudgets();
    expect(report.warned).toBe(1);
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('dryRun ne mute pas la DB', async () => {
    listMock.mockResolvedValueOnce([
      provider({ consumedMonthEur: '15.000000', quotaMonthlyEur: '10.00' }),
    ]);
    const report = await watchProviderBudgets({ dryRun: true });
    expect(report.disabled).toBe(1);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('ignore les providers déjà désactivés', async () => {
    listMock.mockResolvedValueOnce([
      provider({ enabled: false, consumedMonthEur: '50.000000', quotaMonthlyEur: '10.00' }),
    ]);
    const report = await watchProviderBudgets();
    expect(report.scanned).toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('ignore les providers sans quota', async () => {
    listMock.mockResolvedValueOnce([
      provider({ quotaMonthlyEur: null, consumedMonthEur: '999.000000' }),
    ]);
    const report = await watchProviderBudgets();
    expect(report.scanned).toBe(0);
  });

  it('respecte les thresholds custom', async () => {
    listMock.mockResolvedValueOnce([
      provider({ consumedMonthEur: '5.000000', quotaMonthlyEur: '10.00' }),
    ]);
    const report = await watchProviderBudgets({
      warnThreshold: 0.5,
      disableThreshold: 0.9,
    });
    expect(report.warned).toBe(1);
    expect(report.alerts[0]?.action).toBe('warned');
  });

  it('gère plusieurs providers dans un seul run', async () => {
    listMock.mockResolvedValueOnce([
      provider({ id: 'cp_ok', consumedMonthEur: '1.000000', quotaMonthlyEur: '10.00' }),
      provider({ id: 'cp_warn', consumedMonthEur: '9.000000', quotaMonthlyEur: '10.00' }),
      provider({ id: 'cp_kill', consumedMonthEur: '12.000000', quotaMonthlyEur: '10.00' }),
    ]);
    updateMock.mockResolvedValue({ id: 'cp_kill', enabled: false });
    const report = await watchProviderBudgets();
    expect(report.scanned).toBe(3);
    expect(report.warned).toBe(1);
    expect(report.disabled).toBe(1);
    expect(report.alerts.map((a) => a.providerId).sort()).toEqual(['cp_kill', 'cp_warn']);
  });

  it('ignore un quota invalide (<=0 ou NaN)', async () => {
    listMock.mockResolvedValueOnce([
      provider({ quotaMonthlyEur: '0', consumedMonthEur: '5.000000' }),
      provider({ id: 'cp_2', quotaMonthlyEur: '-3.00', consumedMonthEur: '5.000000' }),
    ]);
    const report = await watchProviderBudgets();
    expect(report.scanned).toBe(0);
  });
});

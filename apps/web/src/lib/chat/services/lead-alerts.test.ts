/**
 * CHAT-066 — Tests `notifyHotLead`.
 *
 * On mocke `sendChatAlert` pour valider :
 *  - les raisons "chaudes" déclenchent l'alerte avec severity=critical
 *  - les raisons non chaudes ne déclenchent PAS l'alerte
 *  - RGPD : ni téléphone ni email ne sont envoyés à Slack
 *  - un lien admin est ajouté quand `adminBaseUrl` est fourni
 *  - une erreur dans sendChatAlert est swallowée et logguée
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./slack-notify', () => ({
  sendChatAlert: vi.fn(),
}));

import type { ChatLeadRow } from '../db/schema';
import { sendChatAlert } from './slack-notify';
import { notifyHotLead } from './lead-alerts';

const alertMock = sendChatAlert as unknown as ReturnType<typeof vi.fn>;

function lead(over: Partial<ChatLeadRow> = {}): Pick<
  ChatLeadRow,
  'id' | 'triggerReason' | 'firstName' | 'language' | 'createdAt'
> {
  return {
    id: 'cl_1',
    triggerReason: 'purchase-intent',
    firstName: 'Sara',
    language: 'fr',
    createdAt: new Date('2026-05-13T10:00:00Z'),
    ...over,
  } as Pick<ChatLeadRow, 'id' | 'triggerReason' | 'firstName' | 'language' | 'createdAt'>;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('notifyHotLead', () => {
  it('déclenche une alerte critical pour purchase-intent', async () => {
    alertMock.mockResolvedValueOnce(true);
    const ok = await notifyHotLead(lead({ triggerReason: 'purchase-intent' }));
    expect(ok).toBe(true);
    expect(alertMock).toHaveBeenCalledTimes(1);
    const payload = alertMock.mock.calls[0]![0] as {
      title: string;
      severity: string;
      fields: Array<{ label: string; value: string }>;
    };
    expect(payload.severity).toBe('critical');
    expect(payload.title).toContain('purchase-intent');
    expect(payload.fields.some((f) => f.label === 'Prénom' && f.value === 'Sara')).toBe(true);
  });

  it('déclenche une alerte pour explicit-request', async () => {
    alertMock.mockResolvedValueOnce(true);
    await notifyHotLead(lead({ triggerReason: 'explicit-request' }));
    expect(alertMock).toHaveBeenCalledTimes(1);
  });

  it('déclenche une alerte pour inline-contact', async () => {
    alertMock.mockResolvedValueOnce(true);
    await notifyHotLead(lead({ triggerReason: 'inline-contact' }));
    expect(alertMock).toHaveBeenCalledTimes(1);
  });

  it("ne déclenche PAS d'alerte pour une raison non chaude (b2b)", async () => {
    const ok = await notifyHotLead(lead({ triggerReason: 'b2b' }));
    expect(ok).toBe(false);
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("ne déclenche PAS d'alerte pour out-of-knowledge", async () => {
    const ok = await notifyHotLead(lead({ triggerReason: 'out-of-knowledge' }));
    expect(ok).toBe(false);
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("ne déclenche PAS d'alerte pour manual", async () => {
    const ok = await notifyHotLead(lead({ triggerReason: 'manual' }));
    expect(ok).toBe(false);
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('RGPD : la payload ne contient ni téléphone ni email', async () => {
    alertMock.mockResolvedValueOnce(true);
    await notifyHotLead(lead({ triggerReason: 'purchase-intent' }));
    const payload = JSON.stringify(alertMock.mock.calls[0]![0]);
    expect(payload).not.toMatch(/\+212/);
    expect(payload).not.toMatch(/@/);
    expect(payload).not.toMatch(/phone/i);
  });

  it('ajoute un lien admin si adminBaseUrl est fourni', async () => {
    alertMock.mockResolvedValueOnce(true);
    await notifyHotLead(lead({ id: 'cl_abc' }), {
      adminBaseUrl: 'https://example.com',
    });
    const payload = alertMock.mock.calls[0]![0] as {
      fields: Array<{ label: string; value: string }>;
    };
    const link = payload.fields.find((f) => f.label === 'Fiche admin');
    expect(link?.value).toBe('https://example.com/admin/chat/leads/cl_abc');
  });

  it('strip le trailing slash du adminBaseUrl', async () => {
    alertMock.mockResolvedValueOnce(true);
    await notifyHotLead(lead({ id: 'cl_abc' }), {
      adminBaseUrl: 'https://example.com/',
    });
    const payload = alertMock.mock.calls[0]![0] as {
      fields: Array<{ label: string; value: string }>;
    };
    const link = payload.fields.find((f) => f.label === 'Fiche admin');
    expect(link?.value).toBe('https://example.com/admin/chat/leads/cl_abc');
  });

  it("n'ajoute pas de lien admin si adminBaseUrl absent", async () => {
    alertMock.mockResolvedValueOnce(true);
    await notifyHotLead(lead({ triggerReason: 'purchase-intent' }));
    const payload = alertMock.mock.calls[0]![0] as {
      fields: Array<{ label: string; value: string }>;
    };
    expect(payload.fields.find((f) => f.label === 'Fiche admin')).toBeUndefined();
  });

  it('swallow et log une erreur dans sendChatAlert', async () => {
    alertMock.mockRejectedValueOnce(new Error('slack-down'));
    const ok = await notifyHotLead(lead({ triggerReason: 'purchase-intent' }));
    expect(ok).toBe(false);
  });

  it('utilise "fr" comme langue par défaut si absente', async () => {
    alertMock.mockResolvedValueOnce(true);
    await notifyHotLead(
      lead({ triggerReason: 'purchase-intent', language: null as unknown as 'fr' }),
    );
    const payload = alertMock.mock.calls[0]![0] as {
      fields: Array<{ label: string; value: string }>;
    };
    expect(payload.fields.find((f) => f.label === 'Langue')?.value).toBe('fr');
  });
});

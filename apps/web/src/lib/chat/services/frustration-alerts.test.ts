/**
 * CHAT-066 — Tests `notifyFrustrationSpike`.
 *
 * On mocke `eventRepo.append` + `sendChatAlert` pour valider :
 *  - non-frustration → ne fire pas
 *  - one-shot (1 seul message frustration) → ne fire pas
 *  - spike (≥ 2 messages frustration récents) → append event + Slack
 *  - alreadyEmitted → skip
 *  - lien admin construit correctement quand adminBaseUrl est fourni
 *  - severity Slack = 'warning'
 *  - RGPD : pas de contenu PII dans la payload Slack
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repos/event', () => ({
  eventRepo: {
    append: vi.fn(),
  },
}));

vi.mock('./slack-notify', () => ({
  sendChatAlert: vi.fn(),
}));

import { eventRepo } from '../repos/event';
import { sendChatAlert } from './slack-notify';
import { notifyFrustrationSpike } from './frustration-alerts';

const appendMock = eventRepo.append as unknown as ReturnType<typeof vi.fn>;
const alertMock = sendChatAlert as unknown as ReturnType<typeof vi.fn>;

interface MiniMessage {
  role: 'user' | 'assistant';
  content: string;
}

const FRUSTRATION_TEXT_1 = 'toujours pas de réponse ?';
const FRUSTRATION_TEXT_2 = 'on tourne en rond là, c’est n’importe quoi';
const NEUTRAL_TEXT = 'Bonjour, je voulais juste savoir le prix';

afterEach(() => {
  vi.resetAllMocks();
});

describe('notifyFrustrationSpike', () => {
  it("ne fire PAS quand l'intent n'est pas frustration", async () => {
    const res = await notifyFrustrationSpike({
      sessionId: 'cs_1',
      history: [{ role: 'user', content: 'salut' }] as MiniMessage[],
      currentIntent: 'greeting',
    });
    expect(res).toEqual({ fired: false, reason: 'not-frustrated' });
    expect(appendMock).not.toHaveBeenCalled();
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("ne fire PAS quand alreadyEmitted=true", async () => {
    const res = await notifyFrustrationSpike({
      sessionId: 'cs_1',
      history: [
        { role: 'user', content: FRUSTRATION_TEXT_1 },
        { role: 'user', content: FRUSTRATION_TEXT_2 },
      ] as MiniMessage[],
      currentIntent: 'frustration',
      alreadyEmitted: true,
    });
    expect(res).toEqual({ fired: false, reason: 'already-emitted' });
    expect(appendMock).not.toHaveBeenCalled();
  });

  it("ne fire PAS sur un one-shot frustration (pas de précédent dans la fenêtre)", async () => {
    const res = await notifyFrustrationSpike({
      sessionId: 'cs_1',
      history: [
        { role: 'user', content: NEUTRAL_TEXT },
        { role: 'user', content: FRUSTRATION_TEXT_1 },
      ] as MiniMessage[],
      currentIntent: 'frustration',
    });
    expect(res).toEqual({ fired: false, reason: 'one-shot' });
    expect(appendMock).not.toHaveBeenCalled();
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("fire quand ≥ 2 messages user frustration récents (spike)", async () => {
    appendMock.mockResolvedValueOnce(undefined);
    alertMock.mockResolvedValueOnce(true);
    const res = await notifyFrustrationSpike({
      sessionId: 'cs_42',
      history: [
        { role: 'user', content: FRUSTRATION_TEXT_1 },
        { role: 'assistant', content: 'Désolée…' },
        { role: 'user', content: FRUSTRATION_TEXT_2 },
      ] as MiniMessage[],
      currentIntent: 'frustration',
    });
    expect(res.fired).toBe(true);
    expect(res.reason).toBe('fired');
    expect(appendMock).toHaveBeenCalledWith('cs_42', 'frustration_detected', {
      window: 3,
    });
    expect(alertMock).toHaveBeenCalledTimes(1);
  });

  it("envoie une alerte severity=warning à Slack", async () => {
    appendMock.mockResolvedValueOnce(undefined);
    alertMock.mockResolvedValueOnce(true);
    await notifyFrustrationSpike({
      sessionId: 'cs_42',
      history: [
        { role: 'user', content: FRUSTRATION_TEXT_1 },
        { role: 'user', content: FRUSTRATION_TEXT_2 },
      ] as MiniMessage[],
      currentIntent: 'frustration',
    });
    const payload = alertMock.mock.calls[0]![0] as { severity: string };
    expect(payload.severity).toBe('warning');
  });

  it('inclut un lien admin si adminBaseUrl est fourni', async () => {
    appendMock.mockResolvedValueOnce(undefined);
    alertMock.mockResolvedValueOnce(true);
    await notifyFrustrationSpike({
      sessionId: 'cs_xyz',
      history: [
        { role: 'user', content: FRUSTRATION_TEXT_1 },
        { role: 'user', content: FRUSTRATION_TEXT_2 },
      ] as MiniMessage[],
      currentIntent: 'frustration',
      adminBaseUrl: 'https://example.com/',
    });
    const payload = alertMock.mock.calls[0]![0] as {
      fields: Array<{ label: string; value: string }>;
    };
    const link = payload.fields.find((f) => f.label === 'Conversation');
    expect(link?.value).toBe('https://example.com/admin/chat/conversations/cs_xyz');
  });

  it("RGPD : la payload Slack ne contient PAS le texte du message user", async () => {
    appendMock.mockResolvedValueOnce(undefined);
    alertMock.mockResolvedValueOnce(true);
    await notifyFrustrationSpike({
      sessionId: 'cs_1',
      history: [
        { role: 'user', content: FRUSTRATION_TEXT_1 },
        { role: 'user', content: FRUSTRATION_TEXT_2 },
      ] as MiniMessage[],
      currentIntent: 'frustration',
    });
    const payload = JSON.stringify(alertMock.mock.calls[0]![0]);
    expect(payload).not.toContain(FRUSTRATION_TEXT_1);
    expect(payload).not.toContain(FRUSTRATION_TEXT_2);
  });

  it("swallow une erreur d'eventRepo.append et tente quand même Slack", async () => {
    appendMock.mockRejectedValueOnce(new Error('db-down'));
    alertMock.mockResolvedValueOnce(true);
    const res = await notifyFrustrationSpike({
      sessionId: 'cs_1',
      history: [
        { role: 'user', content: FRUSTRATION_TEXT_1 },
        { role: 'user', content: FRUSTRATION_TEXT_2 },
      ] as MiniMessage[],
      currentIntent: 'frustration',
    });
    expect(res.fired).toBe(true);
    expect(alertMock).toHaveBeenCalledTimes(1);
  });

  it("swallow une erreur Slack et reste fired=true (event KPI déjà loggué)", async () => {
    appendMock.mockResolvedValueOnce(undefined);
    alertMock.mockRejectedValueOnce(new Error('slack-down'));
    const res = await notifyFrustrationSpike({
      sessionId: 'cs_1',
      history: [
        { role: 'user', content: FRUSTRATION_TEXT_1 },
        { role: 'user', content: FRUSTRATION_TEXT_2 },
      ] as MiniMessage[],
      currentIntent: 'frustration',
    });
    expect(res.fired).toBe(true);
  });
});

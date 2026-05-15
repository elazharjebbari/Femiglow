import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import {
  setTrackingSetting,
  TRACKING_SETTING_KEYS,
} from '@/lib/db/queries/tracking/settings';

const chatDbMock = vi.hoisted(() => ({
  chatDb: vi.fn(() => null),
}));

vi.mock('@/lib/chat/db/client', () => ({
  chatDb: chatDbMock.chatDb,
}));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { scanAndDispatchLeadStep1Abandon } from './lead-step1-abandon-scanner';

afterEach(() => {
  resetMemoryStore();
  vi.clearAllMocks();
});

describe('scanAndDispatchLeadStep1Abandon', () => {
  it('renvoie disabled sans toucher la DB si le setting est off', async () => {
    await setTrackingSetting(TRACKING_SETTING_KEYS.LEAD_STEP1_ABANDON_ENABLED, false);
    const result = await scanAndDispatchLeadStep1Abandon();
    expect(result).toMatchObject({ scanned: 0, disabled: 1, timeoutMinutes: 5 });
    expect(chatDbMock.chatDb).not.toHaveBeenCalled();
  });

  it('retourne vide proprement quand DATABASE_URL/chatDb est absent', async () => {
    const result = await scanAndDispatchLeadStep1Abandon();
    expect(result).toMatchObject({ scanned: 0, sent: 0, failed: 0, skipped: 0, disabled: 0 });
  });
});

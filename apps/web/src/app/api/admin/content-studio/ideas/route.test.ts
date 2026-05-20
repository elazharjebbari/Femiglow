import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { HttpError } from '@/lib/errors/http-error';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { GET, POST } from './route';

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn(),
  requireContentStudioEnabled: vi.fn(),
}));

const requireAdminApiMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const requireContentStudioEnabledMock = requireContentStudioEnabled as unknown as ReturnType<typeof vi.fn>;

function adminSession() {
  return {
    adminId: 'adm_content_studio',
    email: 'admin@femiglow.local',
    issuedAt: 0,
    expiresAt: Date.now() + 60_000,
  };
}

function ideaPayload() {
  return {
    pillar: 'rituel',
    objective: 'conversion',
    platform: 'instagram',
    format: 'post',
    prompt: 'Créer un post staging robuste pour tester l idempotence.',
  };
}

function postIdea(body: unknown, key?: string): Request {
  return new Request('http://localhost/api/admin/content-studio/ideas', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: JSON.stringify(body),
  });
}

function getIdeas(): Request {
  return new Request('http://localhost/api/admin/content-studio/ideas?limit=50&offset=0');
}

beforeEach(() => {
  resetMemoryStore();
  vi.clearAllMocks();
  requireContentStudioEnabledMock.mockReturnValue(undefined);
  requireAdminApiMock.mockResolvedValue(adminSession());
});

describe('POST /api/admin/content-studio/ideas', () => {
  it('exige une session admin même avec une clé idempotente', async () => {
    requireAdminApiMock.mockRejectedValueOnce(
      new HttpError('unauthorized', 'Session expirée. Veuillez vous reconnecter.'),
    );

    const res = await POST(postIdea(ideaPayload(), 'route-test-unauthorized'));

    expect(res.status).toBe(401);
    expect(requireAdminApiMock).toHaveBeenCalledTimes(1);
  });

  it('réutilise la réponse idempotente sans créer une deuxième idée', async () => {
    const key = `route-test-${Date.now()}`;

    const first = await POST(postIdea(ideaPayload(), key));
    const second = await POST(postIdea(ideaPayload(), key));

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const firstBody = (await first.json()) as { idea: { id: string; prompt: string } };
    const secondBody = (await second.json()) as { idea: { id: string; prompt: string } };
    expect(secondBody).toEqual(firstBody);

    const list = await GET(getIdeas());
    const listBody = (await list.json()) as { ideas: Array<{ id: string }> };
    expect(listBody.ideas).toHaveLength(1);
    expect(listBody.ideas[0]?.id).toBe(firstBody.idea.id);
    expect(requireAdminApiMock).toHaveBeenCalledTimes(3);
  });
});

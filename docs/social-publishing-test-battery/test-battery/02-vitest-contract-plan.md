# Vitest Contract plan

## Routes × tests

| Route | Tests | Fichier |
|-------|-------|---------|
| POST /publish-now | 8 | `social-publishing-publish-now.contract.test.ts` |
| POST /schedule | 9 | `social-publishing-schedule.contract.test.ts` |
| POST /draft-on-provider | 7 | `social-publishing-draft-on-provider.contract.test.ts` |
| POST /cancel | 6 | `social-publishing-cancel.contract.test.ts` |
| PATCH /reschedule | 7 | `social-publishing-reschedule.contract.test.ts` |
| GET /publish-jobs | 6 | `social-publishing-publish-jobs-list.contract.test.ts` |
| POST /publish-jobs/:id/retry | 6 | `social-publishing-retry.contract.test.ts` |
| POST /publish-jobs/:id/cancel | 6 | `social-publishing-job-cancel.contract.test.ts` |
| POST /postiz/integrations/sync | 5 | `social-publishing-postiz-sync.contract.test.ts` |
| **Total** | **60 tests** | |

## Pattern par route

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({ get: vi.fn() })) }));
vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'a1' }),
  requireContentStudioEnabled: vi.fn(),
}));

const serviceFn = vi.fn();
vi.mock('@/lib/social-publishing/admin-service', () => ({
  publishContentPostNow: (...args) => serviceFn(...args),
}));

import { POST } from '@/app/api/admin/content-studio/posts/[id]/publish-now/route';

describe('POST /publish-now — contract', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 201 happy path', async () => {
    serviceFn.mockResolvedValue({ status: 'queued', jobs: [{}] });
    const res = await POST(makeReq({}), { params: { id: 'post_1' } });
    expect(res.status).toBe(201);
  });

  it('handles HttpError', async () => {
    serviceFn.mockRejectedValue(new HttpError('invalid_state', 'msg', { code: 'no_media_attached' }));
    const res = await POST(makeReq({}), { params: { id: 'post_1' } });
    expect(res.status).toBe(409);
  });

  // ... autres cas
});
```

## Couverture par route

Pour chaque route, valider :
- 200/201 happy
- Chaque champ requis manquant → 400
- Chaque enum invalide → 400
- 401 sans auth
- 404 ressource introuvable
- 409 pour chaque code business (au moins 2 codes par route)
- 429 / 500 (mappés via service)
- Idempotency replay (where applicable)

## Commande
```bash
pnpm vitest run src/test/api-contracts/social-publishing-*.contract.test.ts
```

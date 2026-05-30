# Vitest Plan — Content Studio v2 Create

## Cibles

### Unit tests

| Fichier source | Fichier de test | # tests estimé |
|----------------|-----------------|----------------|
| `lib/content-studio-v2/models/registry.ts` (nouveau) | `registry.test.ts` | 8 |
| `lib/content-studio/services/generation.ts` | `generation.test.ts` (étendre existant) | 10 |
| `lib/content-studio/services/image-generation.ts` | `image-generation.test.ts` (étendre) | 6 |
| `lib/content-studio/services/video-generation.ts` (nouveau) | `video-generation.test.ts` | 6 |
| `lib/content-studio/state-machine.ts` | existant | 10 |
| `lib/content-studio-v2/state/StudioContext.tsx` | existant + étendre | 15 |
| `lib/content-studio-v2/errors/messages.ts` (nouveau) | `messages.test.ts` | 4 |
| **Total unit** | | **~59 tests** |

### Component tests

| Composant | Fichier de test | # tests estimé |
|-----------|-----------------|----------------|
| Stepper.tsx | existant (à mettre à jour) | 10 |
| IntentionForm.tsx | existant (à mettre à jour) | 12 |
| ModelPicker.tsx (nouveau) | `ModelPicker.test.tsx` | 14 |
| VariantsCompare.tsx | existant (à mettre à jour) | 14 |
| MediaStudio.tsx | existant (à mettre à jour) | 16 |
| CaptionEditor.tsx | existant | 10 |
| PreviewPane.tsx | existant + intégration | 12 |
| ApproveButton.tsx (nouveau) | `ApproveButton.test.tsx` | 10 |
| PublishActionGroup.tsx | existant (à mettre à jour) | 12 |
| CreateWorkspace.tsx | (orchestration) | 8 |
| MockModeBadge.tsx (nouveau) | `MockModeBadge.test.tsx` | 4 |
| BudgetIndicator.tsx (nouveau) | `BudgetIndicator.test.tsx` | 6 |
| **Total component** | | **~128 tests** |

### Contract tests

| Route | Fichier de test | # tests estimé |
|-------|-----------------|----------------|
| GET /models | `content-studio-v2-models.contract.test.ts` | 8 |
| POST /ideas | `content-studio-v2-ideas.contract.test.ts` | 8 |
| POST /ideas/:id/generate | `content-studio-v2-ideas-generate.contract.test.ts` | 8 |
| PATCH /drafts/:id | `content-studio-v2-drafts-patch.contract.test.ts` | 6 |
| POST /drafts/:id/generate-visual | `content-studio-v2-drafts-generate-visual.contract.test.ts` | 10 |
| POST /drafts/:id/review | `content-studio-v2-drafts-review.contract.test.ts` | 4 |
| POST /drafts/:id/approve | `content-studio-v2-drafts-approve.contract.test.ts` | 8 |
| POST /drafts/:id/reject | `content-studio-v2-drafts-reject.contract.test.ts` | 4 |
| POST /posts/:id/publish-now | `content-studio-v2-posts-publish-now.contract.test.ts` | 6 |
| POST /posts/:id/schedule | `content-studio-v2-posts-schedule.contract.test.ts` | 6 |
| POST /posts/:id/draft-on-provider | `content-studio-v2-posts-draft.contract.test.ts` | 4 |
| **Total contract** | | **~72 tests** |

## Conventions

### Structure d'un test composant

```ts
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ModelPicker', () => {
  it('fetches models on open', async () => {
    server.use(
      http.get('/api/admin/content-studio/models', () =>
        HttpResponse.json({ models: [...], suggested: {...}, providers: [] })
      )
    );

    render(<ModelPicker role="chat" format="post" value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByText('GPT-4o mini')).toBeVisible());
  });
});
```

### Structure d'un test contract

```ts
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/admin/content-studio/ideas/route';

describe('POST /api/admin/content-studio/ideas', () => {
  it('returns 200 with valid payload', async () => {
    const req = new Request('http://test/api/admin/content-studio/ideas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pillar: 'rituel', objective: 'consideration', platform: 'instagram', format: 'post', prompt: '...' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
```

## Setup

```ts
// src/test/setup.ts (existant — à enrichir)
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers as csv2Handlers } from './msw/content-studio-v2-handlers';
import { handlers as contentStudioHandlers } from './msw/content-studio-handlers';

export const server = setupServer(...csv2Handlers, ...contentStudioHandlers);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/content-studio-v2/create',
}));
```

## Commandes

```bash
# Tous les tests
pnpm vitest run

# Composants /create seuls
pnpm vitest run src/components/admin/content-studio-v2/create

# Mode watch (dev)
pnpm vitest src/components/admin/content-studio-v2/create

# Coverage
pnpm vitest run --coverage
```

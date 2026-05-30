# Phase 1 — Foundations

## Objectif
Poser les fondations utilisées par toutes les phases suivantes :
1. Env flag `CONTENT_STUDIO_V2_MOCK_MODE`
2. Model registry centralisé
3. Endpoint `GET /api/admin/content-studio/models`
4. Endpoint `GET /api/admin/content-studio/health` (étendu avec mockMode)
5. Composant `MockModeBadge`

## Durée estimée
1 jour-personne (dev) + 0.5 j (tests)

## Fichiers à créer

### 1. `apps/web/src/lib/env.ts` — étendre
```ts
// Ajouter :
CONTENT_STUDIO_V2_MOCK_MODE: z.coerce.boolean().default(false),
CONTENT_STUDIO_VIDEO_PROVIDER: z.enum(['mock', 'higgsfield', 'veo', 'sora']).default('mock'),
CONTENT_STUDIO_VIDEO_MODEL: z.string().default('mock-video-1.0'),
```

### 2. `apps/web/.env.example`
Documenter les nouvelles vars.

### 3. `apps/web/src/lib/content-studio-v2/models/registry.ts`
Cf `proposals/P04-autocomplete-per-format.md` pour le contenu complet.

Squelette :
```ts
import type { ContentFormat } from '@/lib/content-studio/types';

export interface ModelEntry {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'mock';
  role: 'chat' | 'image' | 'video';
  label: string;
  description?: string;
  tier: 'fast' | 'balanced' | 'premium';
  capabilities: string[];
  contextWindow?: number;
  pricing: { inputCentsPer1k?: number; outputCentsPer1k?: number; perCall?: number };
  recommendedFor: ContentFormat[];
  source: 'static' | 'cache' | 'live';
  isDefault?: boolean;
}

export interface ProviderInfo {
  id: string;
  label: string;
  status: 'healthy' | 'degraded' | 'down' | 'mock';
}

export const MODELS: ReadonlyArray<ModelEntry> = [
  // … see P04 for full list
];

export function listChatModels(): ModelEntry[] {
  return MODELS.filter(m => m.role === 'chat');
}

export function listImageModels(): ModelEntry[] {
  return MODELS.filter(m => m.role === 'image');
}

export function listVideoModels(): ModelEntry[] {
  return MODELS.filter(m => m.role === 'video');
}

export function listModels(role: 'chat' | 'image' | 'video'): ModelEntry[] {
  return MODELS.filter(m => m.role === role);
}

export function suggestForFormat(format: ContentFormat) {
  const tierOrder = { fast: 0, balanced: 1, premium: 2 };

  function pick(role: 'chat' | 'image' | 'video'): ModelEntry | null {
    const recommended = MODELS.filter(m => m.role === role && m.recommendedFor.includes(format));
    if (recommended.length > 0) {
      return [...recommended].sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier])[0];
    }
    return MODELS.find(m => m.role === role && m.isDefault)
      ?? MODELS.find(m => m.role === role)
      ?? null;
  }

  return {
    chat: pick('chat'),
    image: pick('image'),
    video: pick('video'),
  };
}

export function listProviders(): ProviderInfo[] {
  const seen = new Set<string>();
  const providers: ProviderInfo[] = [];
  for (const m of MODELS) {
    if (seen.has(m.provider)) continue;
    seen.add(m.provider);
    providers.push({
      id: m.provider,
      label: m.provider === 'openai' ? 'OpenAI'
        : m.provider === 'anthropic' ? 'Anthropic'
        : m.provider === 'google' ? 'Google'
        : 'Mock',
      status: m.provider === 'mock' ? 'mock' : 'healthy',
    });
  }
  return providers;
}
```

### 4. `apps/web/src/app/api/admin/content-studio/models/route.ts`
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listModels, suggestForFormat, listProviders } from '@/lib/content-studio-v2/models/registry';
import { requireAdmin } from '@/lib/auth/require-admin';

const querySchema = z.object({
  role: z.enum(['chat', 'image', 'video']),
  format: z.enum(['post', 'story', 'reel', 'carousel']).optional(),
});

export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    role: url.searchParams.get('role'),
    format: url.searchParams.get('format') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'invalid_query', message: parsed.error.message } },
      { status: 400 }
    );
  }
  const { role, format } = parsed.data;
  const models = listModels(role);
  const suggestion = format ? suggestForFormat(format) : null;
  const suggested = suggestion?.[role] ?? models.find(m => m.isDefault) ?? models[0] ?? null;
  return NextResponse.json({
    models,
    suggested,
    providers: listProviders(),
  });
}
```

### 5. `apps/web/src/app/api/admin/content-studio/health/route.ts` — étendre
Ajouter `mockMode` à la réponse :
```ts
return NextResponse.json({
  ok: true,
  mode: ...,
  version: ...,
  mockMode: env.CONTENT_STUDIO_V2_MOCK_MODE === true,
});
```

### 6. `apps/web/src/components/admin/content-studio-v2/create/MockModeBadge.tsx`
```tsx
'use client';
import { Sparkles } from 'lucide-react';

export function MockModeBadge() {
  return (
    <span
      role="status"
      aria-label="Mode mock activé"
      style={{
        display: 'inline-flex', gap: 6, alignItems: 'center',
        padding: '4px 10px',
        background: 'var(--cs-warning-bg)',
        color: 'var(--cs-warning)',
        borderRadius: 'var(--cs-radius-full)',
        fontSize: 11, fontWeight: 500,
      }}
    >
      <Sparkles size={12} />
      Mode mock — actions simulées
    </span>
  );
}
```

### 7. Étendre StudioContext pour exposer `mockMode`
```tsx
const [mockMode, setMockMode] = useState(false);
useEffect(() => {
  fetch('/api/admin/content-studio/health')
    .then(r => r.json())
    .then(j => setMockMode(j?.mockMode === true))
    .catch(() => {});
}, []);
```

## Tests à écrire

### Unit
- `registry.test.ts` (8 tests) : 4 cas format × 2 cas role
- `suggestForFormat(post).chat.id === 'gpt-4o-mini'`
- `suggestForFormat(reel).video.id === 'mock-video-1.0'`
- `listChatModels().length >= 3`
- `listProviders()` retourne providers déduplés

### Contract
- `content-studio-v2-models.contract.test.ts` (8 tests)
  - GET /models?role=chat → 200, models > 0
  - GET /models?role=chat&format=reel → suggested.tier=balanced
  - GET /models?role=image&format=story → suggested.id contient 'mini'
  - GET /models?role=video → suggested.provider='mock'
  - GET /models?role=invalid → 400
  - GET /models sans role → 400
  - GET /models?role=chat&format=invalid → 400 ou ignore format
  - Sans auth → 401

### Component
- `MockModeBadge.test.tsx` (4 tests)
  - Renders text + icon
  - Has role=status
  - Has aria-label
  - Has color warning

## Validation

```bash
pnpm vitest run src/lib/content-studio-v2/models src/test/api-contracts/content-studio-v2-models.contract.test.ts src/components/admin/content-studio-v2/create/MockModeBadge.test.tsx
pnpm run type-check
pnpm run build
```

## Acceptance

- [ ] `CONTENT_STUDIO_V2_MOCK_MODE` documenté dans `.env.example`
- [ ] Registry exporte ≥ 7 modèles répartis sur 3 rôles
- [ ] `GET /models` répond 200 avec models + suggested + providers
- [ ] `GET /health` inclut `mockMode: boolean`
- [ ] `MockModeBadge` rendu et stylisé
- [ ] 0 fail sur les tests Phase 1

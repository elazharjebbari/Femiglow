# 40.4 — Client API

## `lib/admin/mappings-client.ts`

Wrapper TypeScript typé autour des routes REST. Utilisé par tous les composants.

```typescript
import type { MappingVersion, MappingVersionListItem, Mappings } from '@/lib/tracking/mappings/types';

export class MappingsClient {
  constructor(private baseUrl = '') {}
  
  async list(opts: { status?: Status[]; limit?: number } = {}): Promise<{
    versions: MappingVersionListItem[];
    activeId: string | null;
    defaultId: string;
  }> {
    const params = new URLSearchParams();
    if (opts.status?.length) params.set('status', opts.status.join(','));
    if (opts.limit) params.set('limit', String(opts.limit));
    const res = await fetch(`${this.baseUrl}/api/admin/tracking/events/mappings?${params}`, {
      cache: 'no-store',
    });
    return handleResponse(res);
  }
  
  async get(id: string): Promise<MappingVersion> {
    const res = await fetch(`${this.baseUrl}/api/admin/tracking/events/mappings/${id}`, {
      cache: 'no-store',
    });
    return handleResponse(res);
  }
  
  async create(input: {
    name: string;
    notes?: string;
    source: { kind: 'default' } | { kind: 'clone'; sourceId: string } | { kind: 'import'; mappings: Mappings };
  }): Promise<MappingVersion> {
    const res = await fetch(`${this.baseUrl}/api/admin/tracking/events/mappings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse(res);
  }
  
  async update(id: string, input: { mappings: Mappings; name?: string; notes?: string }): Promise<MappingVersion> { /* PUT */ }
  async activate(id: string): Promise<MappingVersion> { /* POST /activate */ }
  async archive(id: string): Promise<MappingVersion> { /* POST */ }
  async softDelete(id: string): Promise<void> { /* DELETE */ }
  async restore(id: string): Promise<MappingVersion> { /* POST */ }
  
  async test(id: string, eventName: string, params?: object): Promise<{
    results: Record<ProviderKind, { wouldDispatch: boolean; mappedName: string | null; isCustom: boolean; skipReason?: string }>;
  }> { /* POST /test */ }
  
  async exportGtm(id: string, env: 'production' | 'stage' | 'preview' | 'dev'): Promise<{
    containerJson: object;
    meta: { sha256: string; eventsCount: number; tagsCount: number; env: string };
  }> { /* POST /export-gtm */ }
  
  async resetToDefault(): Promise<MappingVersion> { /* POST /reset-default */ }
  
  async diff(a: string, b: string): Promise<{
    added: Array<{ event: string; provider: ProviderKind; cell: MappingCell }>;
    removed: Array<{ event: string; provider: ProviderKind; cell: MappingCell }>;
    changed: Array<{ event: string; provider: ProviderKind; before: MappingCell; after: MappingCell }>;
  }> { /* GET /diff/:a/:b */ }
  
  async listAudit(versionId: string, opts: { limit?: number } = {}): Promise<MappingAuditEntry[]> { /* GET /[id]/audit */ }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new MappingApiError(
      body?.error?.code ?? 'unknown',
      body?.error?.message ?? `HTTP ${res.status}`,
      body?.error?.details,
      res.status,
    );
  }
  return res.json();
}

export class MappingApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: unknown,
    public httpStatus: number,
  ) {
    super(message);
  }
}

export const mappingsClient = new MappingsClient();
```

## Usage typique

```typescript
'use client';

import { mappingsClient } from '@/lib/admin/mappings-client';
import { useState } from 'react';

export function ActivateButton({ versionId }: { versionId: string }) {
  const [loading, setLoading] = useState(false);
  
  async function handle() {
    setLoading(true);
    try {
      await mappingsClient.activate(versionId);
      toast.success("Version activée");
      router.refresh();
    } catch (err) {
      if (err instanceof MappingApiError) {
        if (err.code === 'version_already_active') toast.info("Déjà active");
        else if (err.code === 'unauthorized') router.push('/admin/login');
        else toast.error(err.message);
      } else {
        toast.error("Erreur inattendue");
      }
    } finally {
      setLoading(false);
    }
  }
  
  return <button onClick={handle} disabled={loading}>Activer</button>;
}
```

## Tests

Le client est testé via :
- Tests intégration côté routes (vitest) — pas besoin de re-mock le fetch
- Tests Playwright e2e — utilise les routes réelles
- Tests MSW — peuvent intercepter et mocker les routes pour tests offline (cf. `tracking-providers-handlers.ts` pattern)

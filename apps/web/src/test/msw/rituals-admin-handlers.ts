/**
 * Handlers MSW pour les routes admin rituels.
 * Utilisés par les tests d'intégration qui mockent la couche API
 * sans monter Next.js.
 *
 * Cf. docs/reviews-wall/execution/09-tests-msw.md
 */
import { http, HttpResponse } from 'msw';

export interface MockRitualsAdminState {
  rituals: Array<{
    id: string;
    publicSlug: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
    body: string;
    featured: boolean;
  }>;
  /** Compte des appels par endpoint pour assertions. */
  callCount: Record<string, number>;
}

export function createMockState(): MockRitualsAdminState {
  return {
    rituals: [
      { id: 'r1', publicSlug: 'slug1', status: 'PENDING', body: 'Test A', featured: false },
      { id: 'r2', publicSlug: 'slug2', status: 'PENDING', body: 'Test B', featured: false },
      { id: 'r3', publicSlug: 'slug3', status: 'APPROVED', body: 'Test C', featured: false },
    ],
    callCount: {},
  };
}

export function adminRitualsHandlers(state: MockRitualsAdminState) {
  const inc = (key: string) => {
    state.callCount[key] = (state.callCount[key] ?? 0) + 1;
  };

  return [
    http.get('http://localhost/api/admin/rituals/:id/neighbors', ({ params, request }) => {
      inc('neighbors');
      const url = new URL(request.url);
      const statusFilter = url.searchParams.get('status') ?? 'PENDING';
      const statuses = statusFilter.split(',');
      const id = params.id as string;
      const inFile = state.rituals.filter((r) => statuses.includes(r.status));
      const idx = inFile.findIndex((r) => r.id === id);
      if (idx === -1) {
        return HttpResponse.json({
          data: { previousId: null, nextId: null, position: 0, total: 0 },
        });
      }
      return HttpResponse.json({
        data: {
          previousId: idx > 0 ? inFile[idx - 1]!.id : null,
          nextId: idx < inFile.length - 1 ? inFile[idx + 1]!.id : null,
          position: idx + 1,
          total: inFile.length,
        },
      });
    }),

    http.patch('http://localhost/api/admin/rituals/:id', async ({ params, request }) => {
      inc('patch');
      const id = params.id as string;
      const ritual = state.rituals.find((r) => r.id === id);
      if (!ritual) {
        return HttpResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
      }
      const body = (await request.json()) as { action: string; note?: string };
      switch (body.action) {
        case 'approve':
          ritual.status = 'APPROVED';
          break;
        case 'reject':
          if (!body.note) {
            return HttpResponse.json(
              { error: { code: 'VALIDATION_ERROR' } },
              { status: 400 },
            );
          }
          ritual.status = 'REJECTED';
          break;
        case 'hide':
          ritual.status = 'HIDDEN';
          break;
        case 'restore':
          ritual.status = 'APPROVED';
          break;
        case 'feature':
          ritual.featured = true;
          break;
        case 'unfeature':
          ritual.featured = false;
          break;
        default:
          return HttpResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
      }
      return HttpResponse.json({ data: ritual });
    }),

    http.post('http://localhost/api/admin/rituals/bulk-action', async ({ request }) => {
      inc('bulk-action');
      const body = (await request.json()) as {
        action: string;
        ids: string[];
        note?: string;
      };
      let succeeded = 0;
      let skipped = 0;
      for (const id of body.ids) {
        const r = state.rituals.find((x) => x.id === id);
        if (!r) {
          skipped += 1;
          continue;
        }
        if (body.action === 'approve') r.status = 'APPROVED';
        if (body.action === 'reject') r.status = 'REJECTED';
        if (body.action === 'hide') r.status = 'HIDDEN';
        if (body.action === 'restore') r.status = 'APPROVED';
        if (body.action === 'feature') r.featured = true;
        if (body.action === 'unfeature') r.featured = false;
        succeeded += 1;
      }
      return HttpResponse.json({
        data: { totalSucceeded: succeeded, totalSkipped: skipped, totalFailed: 0 },
      });
    }),
  ];
}

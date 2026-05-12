import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { server } from './server';
import {
  adminRitualsHandlers,
  createMockState,
  type MockRitualsAdminState,
} from './rituals-admin-handlers';

let state: MockRitualsAdminState;

beforeAll(() => {
  state = createMockState();
  server.use(...adminRitualsHandlers(state));
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  state = createMockState();
  server.resetHandlers();
  server.use(...adminRitualsHandlers(state));
});

afterAll(() => server.close());

describe('MSW — admin rituals handlers (intégration API contract)', () => {
  describe('GET /api/admin/rituals/:id/neighbors', () => {
    it('retourne les voisins corrects pour l\'élément du milieu', async () => {
      const res = await fetch('http://localhost/api/admin/rituals/r2/neighbors');
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.data.previousId).toBe('r1');
      expect(json.data.nextId).toBeNull(); // r3 est APPROVED, file PENDING par défaut
      expect(json.data.total).toBe(2);
    });

    it('respecte le filtre status multi', async () => {
      const res = await fetch(
        'http://localhost/api/admin/rituals/r3/neighbors?status=APPROVED',
      );
      const json = await res.json();
      expect(json.data.total).toBe(1);
      expect(json.data.position).toBe(1);
    });

    it('compte les appels (pour assertion test)', async () => {
      await fetch('http://localhost/api/admin/rituals/r1/neighbors');
      await fetch('http://localhost/api/admin/rituals/r2/neighbors');
      expect(state.callCount.neighbors).toBe(2);
    });
  });

  describe('PATCH /api/admin/rituals/:id', () => {
    it('approve change le status', async () => {
      const res = await fetch('http://localhost/api/admin/rituals/r1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'approve' }),
      });
      expect(res.ok).toBe(true);
      expect(state.rituals.find((r) => r.id === 'r1')!.status).toBe('APPROVED');
    });

    it('reject sans note → 400', async () => {
      const res = await fetch('http://localhost/api/admin/rituals/r1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reject' }),
      });
      expect(res.status).toBe(400);
    });

    it('NOT_FOUND si id inconnu', async () => {
      const res = await fetch('http://localhost/api/admin/rituals/r_inconnu', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'approve' }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/admin/rituals/bulk-action', () => {
    it('bulk approve sur 2 ids', async () => {
      const res = await fetch('http://localhost/api/admin/rituals/bulk-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'approve', ids: ['r1', 'r2'] }),
      });
      const json = await res.json();
      expect(json.data.totalSucceeded).toBe(2);
      expect(json.data.totalSkipped).toBe(0);
    });

    it('compte skipped pour ids inconnus', async () => {
      const res = await fetch('http://localhost/api/admin/rituals/bulk-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'approve', ids: ['r1', 'inconnu', 'autre'] }),
      });
      const json = await res.json();
      expect(json.data.totalSucceeded).toBe(1);
      expect(json.data.totalSkipped).toBe(2);
    });
  });
});

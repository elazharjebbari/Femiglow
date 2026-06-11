/**
 * Vague 4 — FONDATION — contrat des routes de suggestions
 * (recipients-autocomplete / sources / leads autocomplete).
 *
 * Couvre auth (déléguée à requireAdmin, mocké OK), validation Zod du paramètre
 * `q`, et le repli « DB indisponible → liste vide (200) ». Le comportement de
 * REQUÊTE réel (DISTINCT, préfixe, plafond 20) est prouvé par la suite vraie-DB
 * (UX4-FONDATION-006). On valide aussi l'utilitaire `escapeLikePrefix`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ email: 'admin@test', id: 'admin-1' }),
  getAdminSession: vi.fn().mockResolvedValue({ email: 'admin@test', id: 'admin-1' }),
}));

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';

beforeEach(() => {
  vi.clearAllMocks();
  // Par défaut DB indisponible → repli liste vide.
  vi.mocked(getDb).mockReturnValue(null as never);
});

describe('escapeLikePrefix', () => {
  it('échappe les métacaractères LIKE (% _ \\) pour neutraliser le wildcard', async () => {
    const { escapeLikePrefix } = await import('@/lib/mail/escape-like-prefix');
    expect(escapeLikePrefix('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
    expect(escapeLikePrefix('kaoutar')).toBe('kaoutar');
  });
});

describe('GET recipients-autocomplete — contrat', () => {
  it('200 + { recipients: [] } quand la DB est indisponible', async () => {
    const { GET } = await import('../route');
    const res = await GET(new Request('http://t/x?q=ka'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recipients: [] });
  });

  it('200 même sans paramètre q (q optionnel, défaut "")', async () => {
    const { GET } = await import('../route');
    const res = await GET(new Request('http://t/x'));
    expect(res.status).toBe(200);
  });

  it('422 quand q dépasse 200 caractères', async () => {
    const { GET } = await import('../route');
    const long = 'a'.repeat(201);
    const res = await GET(new Request(`http://t/x?q=${long}`));
    expect(res.status).toBe(422);
  });
});

describe('GET sources — contrat', () => {
  it('200 + { sources: [] } quand la DB est indisponible', async () => {
    const { GET } = await import('../../sources/route');
    const res = await GET(new Request('http://t/x?q=api'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sources: [] });
  });

  it('422 quand q dépasse 200 caractères', async () => {
    const { GET } = await import('../../sources/route');
    const res = await GET(new Request(`http://t/x?q=${'a'.repeat(201)}`));
    expect(res.status).toBe(422);
  });
});

describe('GET leads autocomplete — contrat', () => {
  it('200 + { leads: [] } quand la DB est indisponible', async () => {
    const { GET } = await import('../../../leads/autocomplete/route');
    const res = await GET(new Request('http://t/x?q=amal'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ leads: [] });
  });

  it('422 quand q dépasse 200 caractères', async () => {
    const { GET } = await import('../../../leads/autocomplete/route');
    const res = await GET(new Request(`http://t/x?q=${'a'.repeat(201)}`));
    expect(res.status).toBe(422);
  });
});

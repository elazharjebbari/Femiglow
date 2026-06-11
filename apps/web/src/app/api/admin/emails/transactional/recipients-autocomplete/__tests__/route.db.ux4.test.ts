/**
 * Vague 4 — FONDATION — suite VRAIE-DB des routes de suggestions
 * (UX4-FONDATION-006).
 *
 * Skip honnête sans DATABASE_URL femiglow_test (`describeEmailsDb`). On insère
 * des lignes outbox via `makeOutboxRow` puis on appelle les route handlers GET
 * RÉELS — qui passent par `db()` de `@/lib/db/client` (lit `DATABASE_URL`, qui
 * DOIT pointer sur femiglow_test, cf. en-tête emails-db.ts). Oracles :
 *   - recipients-autocomplete : `to_email` DISTINCTS préfixés par `q`, ≤ 20 ;
 *   - sources : `source` DISTINCTES, filtrables par préfixe.
 *
 * Auth mockée OK (les handlers appellent requireAdmin). Sérialisé
 * (`--no-file-parallelism` via le script npm) + TRUNCATE en beforeEach.
 */
import { afterAll, beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ email: 'admin@test', id: 'admin-1' }),
  getAdminSession: vi.fn().mockResolvedValue({ email: 'admin@test', id: 'admin-1' }),
}));

import { describeEmailsDb, emailsTestDb, truncateEmailTables, closeTestDb } from '@/test/db/emails-db';
import { makeOutboxRow, resetEmailFactories } from '@/test/factories/emails.factory';
import { emailOutbox } from '@/lib/db/schema-emails';

describeEmailsDb('routes de suggestions (vraie-DB) — UX4-FONDATION-006', () => {
  beforeEach(async () => {
    await truncateEmailTables();
    resetEmailFactories();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('UX4-FONDATION-006 : recipients-autocomplete renvoie les to_email DISTINCTS préfixés', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values([
      makeOutboxRow({ toEmail: 'amal@exemple.test' }),
      makeOutboxRow({ toEmail: 'amal@exemple.test' }), // doublon → DISTINCT
      makeOutboxRow({ toEmail: 'amine@exemple.test' }),
      makeOutboxRow({ toEmail: 'bouchra@exemple.test' }),
    ]);

    const { GET } = await import('../route');
    const res = await GET(new Request('http://t/x?q=am'));
    expect(res.status).toBe(200);
    const { recipients } = (await res.json()) as { recipients: string[] };

    // Préfixe 'am' → amal + amine, dédupliqués, pas bouchra.
    expect(recipients).toContain('amal@exemple.test');
    expect(recipients).toContain('amine@exemple.test');
    expect(recipients).not.toContain('bouchra@exemple.test');
    // DISTINCT : amal n'apparaît qu'une fois.
    expect(recipients.filter((r) => r === 'amal@exemple.test')).toHaveLength(1);
  });

  it('UX4-FONDATION-006b : recipients-autocomplete plafonne à 20 résultats', async () => {
    const db = emailsTestDb();
    const rows = Array.from({ length: 30 }, (_, i) =>
      makeOutboxRow({ toEmail: `client${String(i).padStart(2, '0')}@plafond.test` }),
    );
    await db.insert(emailOutbox).values(rows);

    const { GET } = await import('../route');
    const res = await GET(new Request('http://t/x?q=client'));
    const { recipients } = (await res.json()) as { recipients: string[] };
    expect(recipients).toHaveLength(20);
  });

  it('UX4-FONDATION-006c : recipients-autocomplete n’injecte pas de wildcard via q', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values([
      makeOutboxRow({ toEmail: 'amal@exemple.test' }),
      makeOutboxRow({ toEmail: 'xyz@exemple.test' }),
    ]);

    const { GET } = await import('../route');
    // '%' littéral : doit être traité comme un caractère, PAS comme un wildcard
    // (sinon il matcherait tout). Aucun email ne commence par '%'.
    const res = await GET(new Request('http://t/x?q=%25'));
    const { recipients } = (await res.json()) as { recipients: string[] };
    expect(recipients).toHaveLength(0);
  });

  it('UX4-FONDATION-006d : sources renvoie les source DISTINCTES, filtrables par préfixe', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values([
      makeOutboxRow({ source: 'api.contact' }),
      makeOutboxRow({ source: 'api.contact' }), // doublon
      makeOutboxRow({ source: 'app' }),
      makeOutboxRow({ source: 'import' }),
    ]);

    const { GET: GETsources } = await import('../../sources/route');

    // Sans filtre → toutes les sources distinctes.
    const all = (await (await GETsources(new Request('http://t/x'))).json()) as {
      sources: string[];
    };
    expect(all.sources).toEqual(
      expect.arrayContaining(['api.contact', 'app', 'import']),
    );
    expect(all.sources.filter((s) => s === 'api.contact')).toHaveLength(1);

    // Préfixe 'api' → seulement api.contact.
    const filtered = (await (
      await GETsources(new Request('http://t/x?q=api'))
    ).json()) as { sources: string[] };
    expect(filtered.sources).toContain('api.contact');
    expect(filtered.sources).not.toContain('app');
    expect(filtered.sources).not.toContain('import');
  });
});

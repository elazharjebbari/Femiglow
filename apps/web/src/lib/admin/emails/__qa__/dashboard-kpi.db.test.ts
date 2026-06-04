// @vitest-environment node
/**
 * Module 01 — Dashboard santé : EXACTITUDE des KPI contre une VRAIE Postgres
 * (femiglow_test_m01dash). Couvre `getOutboxKpi()` et `listRecentOutbox()`
 * (lib/admin/emails/queries.ts) — la source de vérité des chiffres du dashboard.
 *
 * Priorité du chantier : l'exactitude. On seed un jeu CONTRASTÉ daté au jour
 * près et on vérifie des oracles CHIFFRÉS exacts :
 *  - définition de chaque KPI (quels statuts comptent dans sent/delivered/…),
 *  - fenêtre 7 jours glissants : bornes inclusives/exclusives (createdAt >= now-7j),
 *  - `pendingNow` instantané (pas de fenêtre — compte TOUS les pending),
 *  - `listRecentOutbox` : tri created_at desc, limite, état vide.
 *
 * Suite VRAIE-DB → DATABASE_URL/DATABASE_URL_TEST sur femiglow_test_m01dash :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m01dash#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/lib/admin/emails/__qa__/dashboard-kpi.db.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { emailOutbox } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb, type DrizzleDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeOutboxRow, resetEmailFactories } from '@/test/factories';
import { getOutboxKpi, listRecentOutbox } from '@/lib/admin/emails/queries';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Ancrages relatifs à l'horloge réelle (getOutboxKpi calcule now-7j en JS). */
const ago = (ms: number) => new Date(Date.now() - ms);

beforeAll(() => {
  const db = emailsTestDb();
  // `getOutboxKpi`/`listRecentOutbox` lisent `db()` de @/lib/db/client → on leur
  // injecte l'instance de test (schéma de test plus large, mêmes tables SQL).
  __setTestDb(db as unknown as DrizzleDb);
});

beforeEach(async () => {
  await truncateEmailTables();
  resetEmailFactories();
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('getOutboxKpi — exactitude des compteurs (DSH-DB-KPI)', () => {
  /**
   * Seed CONTRASTÉ daté au jour près, tout DANS la fenêtre 7 jours sauf mention :
   *  - 12 « envoyés » : 6 sent + 3 delivered + 2 opened + 1 clicked
   *    → sentLast7d = 12 (sent+delivered+opened+clicked),
   *    → deliveredLast7d = 6 (delivered+opened+clicked uniquement),
   *  - 3 « échecs » : 1 failed + 1 bounced_soft + 1 bounced_permanent → failed = 3,
   *  - 2 dlq → dlq = 2,
   *  - 2 pending → pending = 2 (instantané),
   *  - 1 sending (ni envoyé, ni échec, ni dlq, ni pending) → bruit neutre,
   *  - 1 suppressed → bruit neutre.
   * Total inséré dans la fenêtre = 12 + 3 + 2 + 2 + 1 + 1 = 21 → totalLast7d = 21.
   */
  async function seedContrasted() {
    const db = emailsTestDb();
    const at = ago(2 * DAY_MS); // bien à l'intérieur de la fenêtre
    const rows = [
      // 12 envoyés
      ...Array.from({ length: 6 }, () => makeOutboxRow({ status: 'sent', createdAt: at })),
      ...Array.from({ length: 3 }, () => makeOutboxRow({ status: 'delivered', createdAt: at, deliveredAt: at })),
      ...Array.from({ length: 2 }, () => makeOutboxRow({ status: 'opened', createdAt: at, deliveredAt: at })),
      makeOutboxRow({ status: 'clicked', createdAt: at, deliveredAt: at }),
      // 3 échecs
      makeOutboxRow({ status: 'failed', createdAt: at }),
      makeOutboxRow({ status: 'bounced_soft', createdAt: at }),
      makeOutboxRow({ status: 'bounced_permanent', createdAt: at }),
      // 2 dlq
      ...Array.from({ length: 2 }, () => makeOutboxRow({ status: 'dlq', createdAt: at })),
      // 2 pending
      ...Array.from({ length: 2 }, () => makeOutboxRow({ status: 'pending', createdAt: at })),
      // bruit neutre
      makeOutboxRow({ status: 'sending', createdAt: at }),
      makeOutboxRow({ status: 'suppressed', createdAt: at }),
    ];
    await db.insert(emailOutbox).values(rows);
  }

  // DSH-DB-KPI-001 — chaque KPI compte EXACTEMENT les bons statuts.
  it('compte exactement sent/delivered/failed/dlq/pending/total selon leur définition', async () => {
    await seedContrasted();
    const kpi = await getOutboxKpi();

    expect(kpi.sentLast7d).toBe(12); // sent+delivered+opened+clicked
    expect(kpi.deliveredLast7d).toBe(6); // delivered+opened+clicked
    expect(kpi.failedLast7d).toBe(3); // failed+bounced_soft+bounced_permanent
    expect(kpi.dlqLast7d).toBe(2);
    expect(kpi.pendingNow).toBe(2);
    expect(kpi.totalLast7d).toBe(21); // toutes les lignes de la fenêtre
  });

  // DSH-DB-KPI-002 — base vide : tous les compteurs à 0 (zéro est une donnée).
  it('renvoie tous les compteurs à 0 sur une base vide', async () => {
    const kpi = await getOutboxKpi();
    expect(kpi).toEqual({
      totalLast7d: 0,
      sentLast7d: 0,
      deliveredLast7d: 0,
      failedLast7d: 0,
      dlqLast7d: 0,
      pendingNow: 0,
    });
  });

  // DSH-DB-KPI-003 — REGRESSION F-001 : livrés=0 alors qu'envoyés>0 reflété
  // FIDÈLEMENT dans les chiffres (l'alerte UI s'appuie là-dessus).
  it('reflète sent>0 & delivered=0 quand toutes les lignes restent au statut "sent"', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values(
      Array.from({ length: 4200 / 100 }, () => makeOutboxRow({ status: 'sent', createdAt: ago(DAY_MS) })),
    );
    const kpi = await getOutboxKpi();
    expect(kpi.sentLast7d).toBe(42);
    expect(kpi.deliveredLast7d).toBe(0);
  });
});

describeEmailsDb('getOutboxKpi — fenêtre 7 jours glissants (bornes) (DSH-DB-WINDOW)', () => {
  // DSH-DB-WINDOW-001 — borne INCLUSIVE : une ligne créée il y a 7 jours moins
  // une minute est DANS la fenêtre ; une ligne il y a 7 jours plus une heure est
  // HORS fenêtre. La frontière est `created_at >= now()-7j`.
  it('inclut une ligne juste à l intérieur de 7j et EXCLUT une ligne juste au-delà', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values([
      // À l'intérieur : 7 jours - 1h.
      makeOutboxRow({ status: 'sent', createdAt: ago(7 * DAY_MS - HOUR_MS) }),
      // Au-delà : 7 jours + 1h → exclue.
      makeOutboxRow({ status: 'sent', createdAt: ago(7 * DAY_MS + HOUR_MS) }),
    ]);
    const kpi = await getOutboxKpi();
    expect(kpi.sentLast7d).toBe(1);
    expect(kpi.totalLast7d).toBe(1);
  });

  // DSH-DB-WINDOW-002 — une ligne créée il y a 30 jours n'entre dans AUCUN
  // compteur fenêtré.
  it('ignore une ligne vieille de 30 jours dans tous les compteurs fenêtrés', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values([
      makeOutboxRow({ status: 'sent', createdAt: ago(30 * DAY_MS) }),
      makeOutboxRow({ status: 'delivered', createdAt: ago(30 * DAY_MS), deliveredAt: ago(30 * DAY_MS) }),
      makeOutboxRow({ status: 'failed', createdAt: ago(30 * DAY_MS) }),
      makeOutboxRow({ status: 'dlq', createdAt: ago(30 * DAY_MS) }),
    ]);
    const kpi = await getOutboxKpi();
    expect(kpi.sentLast7d).toBe(0);
    expect(kpi.deliveredLast7d).toBe(0);
    expect(kpi.failedLast7d).toBe(0);
    expect(kpi.dlqLast7d).toBe(0);
    expect(kpi.totalLast7d).toBe(0);
  });

  // DSH-DB-WINDOW-003 — `pendingNow` est INSTANTANÉ : il compte un pending même
  // vieux de 30 jours (pas de fenêtre 7j), contrairement aux compteurs fenêtrés.
  it('compte un pending vieux de 30 jours dans pendingNow (instantané, hors fenêtre 7j)', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values([
      makeOutboxRow({ status: 'pending', createdAt: ago(30 * DAY_MS) }),
      makeOutboxRow({ status: 'pending', createdAt: ago(1 * HOUR_MS) }),
    ]);
    const kpi = await getOutboxKpi();
    expect(kpi.pendingNow).toBe(2);
    // Mais ces pending vieux/récents n'entrent ni dans sent ni dans delivered.
    expect(kpi.sentLast7d).toBe(0);
    expect(kpi.deliveredLast7d).toBe(0);
    // totalLast7d ne compte que la ligne récente (l'ancienne est hors fenêtre).
    expect(kpi.totalLast7d).toBe(1);
  });
});

describeEmailsDb('listRecentOutbox — tri, limite, état vide (DSH-DB-RECENT)', () => {
  // DSH-DB-RECENT-001 — tri created_at DESC : le plus récent en tête.
  it('retourne les lignes triées par created_at décroissant', async () => {
    const db = emailsTestDb();
    const oldest = ago(3 * DAY_MS);
    const middle = ago(2 * DAY_MS);
    const newest = ago(1 * HOUR_MS);
    await db.insert(emailOutbox).values([
      makeOutboxRow({ status: 'sent', toEmail: 'milieu@exemple.test', createdAt: middle }),
      makeOutboxRow({ status: 'sent', toEmail: 'ancien@exemple.test', createdAt: oldest }),
      makeOutboxRow({ status: 'sent', toEmail: 'recent@exemple.test', createdAt: newest }),
    ]);
    const rows = await listRecentOutbox({ limit: 8 });
    expect(rows.map((r) => r.toEmail)).toEqual([
      'recent@exemple.test',
      'milieu@exemple.test',
      'ancien@exemple.test',
    ]);
  });

  // DSH-DB-RECENT-002 — la limite est respectée (on ne renvoie que N lignes).
  it('respecte la limite demandée (8) même avec plus de lignes en base', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values(
      Array.from({ length: 20 }, (_, i) =>
        makeOutboxRow({ status: 'sent', createdAt: ago((i + 1) * HOUR_MS) }),
      ),
    );
    const rows = await listRecentOutbox({ limit: 8 });
    expect(rows).toHaveLength(8);
  });

  // DSH-DB-RECENT-003 — état vide : tableau vide (le composant affiche alors la
  // ligne « Aucun envoi sur la période. »).
  it('retourne un tableau vide quand l outbox est vide', async () => {
    const rows = await listRecentOutbox({ limit: 8 });
    expect(rows).toEqual([]);
  });

  // DSH-DB-RECENT-004 — filtre par statut : ne renvoie que le statut demandé.
  it('filtre par statut quand demandé', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values([
      makeOutboxRow({ status: 'sent', createdAt: ago(1 * HOUR_MS) }),
      makeOutboxRow({ status: 'dlq', createdAt: ago(2 * HOUR_MS) }),
      makeOutboxRow({ status: 'dlq', createdAt: ago(3 * HOUR_MS) }),
    ]);
    const rows = await listRecentOutbox({ limit: 8, status: 'dlq' });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === 'dlq')).toBe(true);
  });
});

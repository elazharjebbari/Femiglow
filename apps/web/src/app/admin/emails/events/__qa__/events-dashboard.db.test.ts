// @vitest-environment node
/**
 * Module 01 — Page events (`/admin/emails/events`) : EXACTITUDE des données du
 * dashboard debug `user_event`, contre une VRAIE Postgres (femiglow_test_m01dash).
 *
 * La page RSC lit trois requêtes (lib/user-events/queries.ts) :
 *   - getTotalEvents()        → compteur 24h glissant,
 *   - getEventCountsByName()  → top events par (event_name, source) sur 24h,
 *   - getRecentEvents()       → 100 derniers events, filtrables par source.
 * Ce sont les CHIFFRES affichés ; on verrouille leur exactitude (fenêtre 24h,
 * agrégation, tri, filtre source, états vides).
 *
 * `user_event` n'est PAS dans la liste de truncate du harnais emailing → on la
 * vide explicitement en beforeEach via emailsTestSql().
 *
 * Suite VRAIE-DB → DATABASE_URL/DATABASE_URL_TEST sur femiglow_test_m01dash :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m01dash#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/app/admin/emails/events/__qa__/events-dashboard.db.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { userEvent, type UserEventInsert } from '@/lib/db/schema';
import { __setTestDb, __resetTestDb, type DrizzleDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  emailsTestSql,
  describeEmailsDb,
} from '@/test/db/emails-db';
import {
  getEventCountsByName,
  getRecentEvents,
  getTotalEvents,
} from '@/lib/user-events/queries';

const HOUR_MS = 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms);

let evSeq = 0;
function makeUserEvent(over: Partial<UserEventInsert> = {}): UserEventInsert {
  evSeq += 1;
  return {
    email: `event${evSeq}@exemple.test`,
    eventName: 'page_view',
    ts: ago(1 * HOUR_MS),
    properties: {},
    sessionId: `sess_${evSeq}`,
    source: 'web',
    leadId: null,
    ...over,
  };
}

beforeAll(() => {
  const db = emailsTestDb();
  __setTestDb(db as unknown as DrizzleDb);
});

beforeEach(async () => {
  evSeq = 0;
  // user_event hors périmètre du truncate emailing → nettoyage explicite.
  await emailsTestSql().unsafe('TRUNCATE TABLE user_event RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('getTotalEvents — fenêtre 24h (EVT-DB-TOTAL)', () => {
  // EVT-DB-TOTAL-001 — compte exactement les events des 24 dernières heures.
  it('compte les events dans la fenêtre 24h et exclut les plus anciens', async () => {
    const db = emailsTestDb();
    await db.insert(userEvent).values([
      makeUserEvent({ ts: ago(1 * HOUR_MS) }),
      makeUserEvent({ ts: ago(12 * HOUR_MS) }),
      makeUserEvent({ ts: ago(23 * HOUR_MS) }),
      // Hors fenêtre : 25h.
      makeUserEvent({ ts: ago(25 * HOUR_MS) }),
    ]);
    expect(await getTotalEvents()).toBe(3);
  });

  // EVT-DB-TOTAL-002 — base vide → 0 (zéro est une donnée, pas une erreur).
  it('retourne 0 sur une base vide', async () => {
    expect(await getTotalEvents()).toBe(0);
  });
});

describeEmailsDb('getEventCountsByName — agrégation par (name, source) (EVT-DB-COUNTS)', () => {
  // EVT-DB-COUNTS-001 — agrège par (event_name, source) et trie par count desc.
  it('agrège par (event_name, source) et trie par volume décroissant', async () => {
    const db = emailsTestDb();
    await db.insert(userEvent).values([
      makeUserEvent({ eventName: 'page_view', source: 'web', ts: ago(1 * HOUR_MS) }),
      makeUserEvent({ eventName: 'page_view', source: 'web', ts: ago(2 * HOUR_MS) }),
      makeUserEvent({ eventName: 'page_view', source: 'web', ts: ago(3 * HOUR_MS) }),
      makeUserEvent({ eventName: 'email_open', source: 'email', ts: ago(1 * HOUR_MS) }),
      // Même nom mais source différente → bucket distinct.
      makeUserEvent({ eventName: 'page_view', source: 'server', ts: ago(1 * HOUR_MS) }),
    ]);
    const counts = await getEventCountsByName();

    // 3 buckets : (page_view,web)=3, (email_open,email)=1, (page_view,server)=1.
    expect(counts).toHaveLength(3);
    // Le plus gros bucket en tête (tri par count desc).
    expect(counts[0]).toEqual({ eventName: 'page_view', source: 'web', count: 3 });
    const webPv = counts.find((c) => c.eventName === 'page_view' && c.source === 'web');
    const serverPv = counts.find((c) => c.eventName === 'page_view' && c.source === 'server');
    expect(webPv?.count).toBe(3);
    expect(serverPv?.count).toBe(1);
  });

  // EVT-DB-COUNTS-002 — exclut les events hors fenêtre 24h de l'agrégation.
  it('exclut les events hors fenêtre 24h', async () => {
    const db = emailsTestDb();
    await db.insert(userEvent).values([
      makeUserEvent({ eventName: 'page_view', source: 'web', ts: ago(1 * HOUR_MS) }),
      makeUserEvent({ eventName: 'page_view', source: 'web', ts: ago(30 * HOUR_MS) }),
    ]);
    const counts = await getEventCountsByName();
    expect(counts).toHaveLength(1);
    expect(counts[0]?.count).toBe(1);
  });

  // EVT-DB-COUNTS-003 — base vide → tableau vide (la page affiche alors le
  // message « Aucun event sur les 24 dernières heures. »).
  it('retourne un tableau vide sur une base vide', async () => {
    expect(await getEventCountsByName()).toEqual([]);
  });
});

describeEmailsDb('getRecentEvents — tri, limite, filtre source (EVT-DB-RECENT)', () => {
  // EVT-DB-RECENT-001 — tri ts DESC : le plus récent en tête.
  it('retourne les events triés par ts décroissant', async () => {
    const db = emailsTestDb();
    await db.insert(userEvent).values([
      makeUserEvent({ email: 'milieu@exemple.test', ts: ago(2 * HOUR_MS) }),
      makeUserEvent({ email: 'ancien@exemple.test', ts: ago(5 * HOUR_MS) }),
      makeUserEvent({ email: 'recent@exemple.test', ts: ago(1 * HOUR_MS) }),
    ]);
    const rows = await getRecentEvents({ limit: 100 });
    expect(rows.map((r) => r.email)).toEqual([
      'recent@exemple.test',
      'milieu@exemple.test',
      'ancien@exemple.test',
    ]);
  });

  // EVT-DB-RECENT-002 — filtre par source : ne renvoie que la source demandée.
  it('filtre par source quand demandé', async () => {
    const db = emailsTestDb();
    await db.insert(userEvent).values([
      makeUserEvent({ source: 'web', ts: ago(1 * HOUR_MS) }),
      makeUserEvent({ source: 'email', ts: ago(2 * HOUR_MS) }),
      makeUserEvent({ source: 'email', ts: ago(3 * HOUR_MS) }),
      makeUserEvent({ source: 'admin', ts: ago(4 * HOUR_MS) }),
    ]);
    const rows = await getRecentEvents({ limit: 100, source: 'email' });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.source === 'email')).toBe(true);
  });

  // EVT-DB-RECENT-003 — sans filtre, getRecentEvents ne fenêtre PAS sur 24h :
  // il retourne aussi des events plus anciens (contrairement aux 2 autres
  // requêtes). On verrouille ce comportement réel (pas de fenêtre temporelle).
  it('ne fenêtre PAS sur 24h (retourne aussi des events anciens)', async () => {
    const db = emailsTestDb();
    await db.insert(userEvent).values([
      makeUserEvent({ ts: ago(1 * HOUR_MS) }),
      makeUserEvent({ ts: ago(72 * HOUR_MS) }),
    ]);
    const rows = await getRecentEvents({ limit: 100 });
    expect(rows).toHaveLength(2);
  });

  // EVT-DB-RECENT-004 — la limite est respectée.
  it('respecte la limite demandée', async () => {
    const db = emailsTestDb();
    await db.insert(userEvent).values(
      Array.from({ length: 10 }, (_, i) => makeUserEvent({ ts: ago((i + 1) * HOUR_MS) })),
    );
    const rows = await getRecentEvents({ limit: 5 });
    expect(rows).toHaveLength(5);
  });

  // EVT-DB-RECENT-005 — état vide → tableau vide (message « Aucun event ne
  // correspond aux filtres. »).
  it('retourne un tableau vide quand aucun event', async () => {
    expect(await getRecentEvents({ limit: 100 })).toEqual([]);
    expect(await getRecentEvents({ limit: 100, source: 'web' })).toEqual([]);
  });
});

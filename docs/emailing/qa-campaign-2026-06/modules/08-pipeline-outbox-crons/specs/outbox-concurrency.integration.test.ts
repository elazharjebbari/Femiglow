/**
 * PIP-INT-060/061/062/064/065/150/152 — drain concurrent (SKIP LOCKED réel).
 *
 * Cette suite exige une VRAIE Postgres de test (cf. 05-conventions-harnais §4)
 * car SKIP LOCKED ne se reproduit pas avec un fake : deux appels concurrents de
 * pickAndProcessBatch doivent traiter des sous-ensembles DISJOINTS de lignes.
 * On stube uniquement le TRANSPORT SMTP (pas la DB) pour isoler la logique de
 * claim/livraison et contrôler succès/lenteur/crash.
 *
 * Prérequis (test-plan.yaml) : DATABASE_URL_TEST = femiglow_test migrée, transport
 * stub injecté. La suite est sérialisée (un fichier = un état).
 *
 * Réf : src/lib/mail/outbox.ts ; inventaire F-082.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

// — Transport SMTP stub (la DB, elle, est RÉELLE) ————————————————————————
const sendMail = vi.fn();
vi.mock('@/lib/mail/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mail/client')>('@/lib/mail/client');
  return { ...actual, getTransporter: () => ({ sendMail, verify: vi.fn() }) };
});

import { testSql, truncateEmailTables } from '@/test/db/setup';
import { pickAndProcessBatch } from '@/lib/mail/outbox';

/** Insère N lignes pending prêtes au drain. */
async function seedPending(n: number, prefix = 'eo'): Promise<string[]> {
  const ids = Array.from({ length: n }, (_, i) => `${prefix}-${i}`);
  for (const id of ids) {
    await testSql`
      INSERT INTO email_outbox
        (id, idempotency_key, template, template_version, to_email, from_email,
         subject, payload_json, html_snapshot, text_snapshot, status, attempts, max_attempts)
      VALUES
        (${id}, ${'idem-' + id}, 'order-confirmation', 1, ${id + '@exemple.test'},
         'info@femiglow-maroc.com', 'Confirmation', '{}'::jsonb, '<html>ok</html>', 'ok',
         'pending', 0, 5)
    `;
  }
  return ids;
}

async function statusOf(id: string): Promise<string> {
  const rows = await testSql<{ status: string }[]>`SELECT status FROM email_outbox WHERE id = ${id}`;
  return rows[0]?.status ?? 'absent';
}

async function countByStatus(): Promise<Record<string, number>> {
  const rows = await testSql<{ status: string; n: number }[]>`
    SELECT status, count(*)::int AS n FROM email_outbox GROUP BY status`;
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

beforeAll(() => {
  // Garde-fou : ne JAMAIS tourner contre une base non-test (cf. setup.ts).
  if (!/_test/.test(process.env.DATABASE_URL_TEST ?? '')) {
    throw new Error('DATABASE_URL_TEST doit pointer vers femiglow_test');
  }
});

beforeEach(async () => {
  vi.clearAllMocks();
  await truncateEmailTables();
});

afterAll(async () => {
  await testSql.end({ timeout: 5 });
});

describe('drain concurrent — SKIP LOCKED (PIP-INT-060/061)', () => {
  it('deux pickAndProcessBatch concurrents traitent des sous-ensembles disjoints', async () => {
    sendMail.mockResolvedValue({ messageId: '<m@x>', response: '250 OK' });
    const ids = await seedPending(60);

    // Lancement RÉELLEMENT concurrent.
    const [a, b] = await Promise.all([pickAndProcessBatch(), pickAndProcessBatch()]);

    // Oracle 1 : aucune ligne traitée deux fois (somme des picked == total, disjoints).
    expect(a.picked + b.picked).toBe(ids.length);
    // Oracle 2 : toutes livrées exactement une fois.
    const counts = await countByStatus();
    expect(counts.sent).toBe(ids.length);
    expect(sendMail).toHaveBeenCalledTimes(ids.length);
    // Oracle 3 : exactement un event 'sent' par ligne (pas de doublon).
    const ev = await testSql<{ n: number }[]>`SELECT count(*)::int AS n FROM email_event WHERE type='sent'`;
    expect(ev[0]!.n).toBe(ids.length);
  });

  it('PIP-INT-061 : aucune ligne perdue entre les deux workers', async () => {
    sendMail.mockResolvedValue({ messageId: '<m@x>', response: '250 OK' });
    await seedPending(40);
    const [a, b] = await Promise.all([pickAndProcessBatch(), pickAndProcessBatch()]);
    const counts = await countByStatus();
    expect((counts.sent ?? 0) + (counts.pending ?? 0) + (counts.failed ?? 0)).toBe(40);
    expect(a.picked + b.picked).toBe(40);
  });
});

describe('drain — ordre & filtres (PIP-INT-062/063/065)', () => {
  it('PIP-INT-063 : une ligne scheduled_for dans le futur n’est pas drainée', async () => {
    sendMail.mockResolvedValue({ messageId: '<m@x>', response: '250 OK' });
    await testSql`
      INSERT INTO email_outbox
        (id, idempotency_key, template, template_version, to_email, from_email, subject,
         payload_json, html_snapshot, text_snapshot, status, attempts, max_attempts, scheduled_for)
      VALUES
        ('eo-future', 'idem-future', 'order-confirmation', 1, 'f@exemple.test',
         'info@femiglow-maroc.com', 'S', '{}'::jsonb, '<html>ok</html>', 'ok',
         'pending', 0, 5, now() + interval '1 hour')
    `;
    const r = await pickAndProcessBatch();
    expect(r.picked).toBe(0);
    expect(await statusOf('eo-future')).toBe('pending');
  });

  it('PIP-INT-065 : au plus BATCH_SIZE lignes par tick', async () => {
    sendMail.mockResolvedValue({ messageId: '<m@x>', response: '250 OK' });
    await seedPending(130); // > BATCH_SIZE (100)
    const r = await pickAndProcessBatch();
    expect(r.picked).toBeLessThanOrEqual(100);
    const counts = await countByStatus();
    expect(counts.pending ?? 0).toBeGreaterThanOrEqual(30);
  });
});

describe('crash mid-batch & redéploiement (PIP-INT-150/151/152)', () => {
  it('PIP-INT-150 : crash après quelques envois laisse des lignes sending orphelines [RED reaper]', async () => {
    // Le 5e envoi jette comme si le worker mourait ; les déjà-sent restent sent,
    // la ligne en cours retombe en failed (catch interne). Les NON traitées
    // restent pending. Ce test prouve qu'aucune ligne déjà 'sent' n'est renvoyée
    // et sert de base au reaper (CIBLE) sur les éventuels 'sending' orphelins.
    let n = 0;
    sendMail.mockImplementation(async () => {
      n++;
      if (n === 5) throw new Error('SIGKILL-like mid-send');
      return { messageId: `<m${n}@x>`, response: '250 OK' };
    });
    const ids = await seedPending(10);
    await pickAndProcessBatch().catch(() => undefined);

    const counts = await countByStatus();
    // Les déjà livrées ne doivent jamais repartir : re-drain ne les re-claim pas.
    sendMail.mockResolvedValue({ messageId: '<again@x>', response: '250 OK' });
    const sentBefore = counts.sent ?? 0;
    await pickAndProcessBatch();
    const after = await countByStatus();
    expect(after.sent ?? 0).toBeGreaterThanOrEqual(sentBefore);
    // PIP-INT-151 : pas de double event 'sent' pour une même ligne.
    for (const id of ids) {
      const ev = await testSql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM email_event WHERE outbox_id=${id} AND type='sent'`;
      expect(ev[0]!.n).toBeLessThanOrEqual(1);
    }
  });
});

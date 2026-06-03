/**
 * INF-HEALTH-* / INF-DLQ-* / INF-UNIT-CRON-AUTH-* — Healthcheck ÉTENDU (cible).
 *
 * Le healthcheck actuel (checkEmailingHealth) est aveugle à : cron mort,
 * pending vieillissant, Listmonk down, "jamais delivered". Ces tests
 * décrivent l'ÉTAT CIBLE : chaque condition DOIT dégrader le niveau.
 * Plusieurs sont ROUGES sur l'implémentation actuelle et guident l'extension.
 *
 * Dépôt cible : apps/web/src/lib/admin/emails/__tests__/health-extended.test.ts
 *
 * Stratégie : on injecte un faux drizzle qui répond aux sous-requêtes du
 * healthcheck (count stuck/dlq/pending, last delivered, last cron tick) +
 * un faux client Listmonk / SMTP verify. On vérifie le `level` résultant.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// On mocke l'env (SMTP configuré par défaut) et le client DB.
vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    env: { ...actual.env, SMTP_USER: 'u', SMTP_PASSWORD: 'p' },
  };
});

/**
 * Faux drizzle paramétrable : chaque appel de comptage renvoie une valeur
 * pilotée par `state`. On modélise le contrat de checkEmailingHealth ÉTENDU :
 *   - stuckCount, dlqCount, pendingCount, pendingOldestMin (cible)
 *   - lastDeliveredAt, recentSentCount (cible)
 *   - lastCronTickAgeSec par cron (cible)
 */
type HealthState = {
  stuckCount: number;
  dlqCount: number;
  pendingCount: number;
  pendingOldestMin: number;     // âge de la plus vieille ligne pending (cible)
  lastDeliveredAt: Date | null;
  recentSentCount: number;      // envois sur 24h (cible)
  outboxCronTickAgeSec: number; // fraîcheur cron outbox (cible)
};

function fakeDbFor(state: HealthState) {
  // Le healthcheck étendu enchaîne plusieurs select().from().where() awaitable.
  // On renvoie séquentiellement les valeurs attendues via un compteur d'appels.
  const queue: unknown[][] = [
    [{ n: state.stuckCount }],
    [{ n: state.dlqCount }],
    [{ n: state.pendingCount }],
    [{ oldestMin: state.pendingOldestMin }],     // cible
    [{ at: state.lastDeliveredAt }],
    [{ n: state.recentSentCount }],              // cible
    [{ ageSec: state.outboxCronTickAgeSec }],    // cible (cron_heartbeat)
  ];
  let i = 0;
  const chain = () => {
    const obj: Record<string, unknown> = {};
    const self = {
      from: () => self,
      where: () => self,
      orderBy: () => self,
      groupBy: () => self,
      limit: () => self,
      then: (cb: (rows: unknown[]) => unknown) =>
        Promise.resolve(queue[Math.min(i++, queue.length - 1)] ?? []).then(cb),
    };
    void obj;
    return self;
  };
  return { select: () => chain() } as unknown;
}

// Probes externes (cible) : injectables pour le test.
type Probes = {
  listmonkUp: boolean;
  smtpVerifyOk: boolean;
};

/**
 * Référence cible de la fonction étendue. En implémentation réelle, ces
 * paramètres (probes) sont injectés via options pour rester testables sans I/O.
 *
 * NOTE : on importe la vraie fonction si elle accepte déjà les options ;
 * sinon ce bloc documente le contrat attendu et le test pilote l'extension.
 */
import { checkEmailingHealth } from '@/lib/admin/emails/health';

type ExtendedHealthFn = (
  now?: Date,
  opts?: { db?: unknown; probes?: Probes; thresholds?: Record<string, number> },
) => Promise<{ level: 'ok' | 'degraded' | 'incident'; checks: Record<string, unknown> }>;

const check = checkEmailingHealth as unknown as ExtendedHealthFn;

const NOW = new Date('2026-06-03T12:00:00Z');
const GREEN: HealthState = {
  stuckCount: 0,
  dlqCount: 0,
  pendingCount: 2,
  pendingOldestMin: 1,
  lastDeliveredAt: new Date('2026-06-03T11:59:00Z'),
  recentSentCount: 120,
  outboxCronTickAgeSec: 30,
};

beforeEach(() => vi.clearAllMocks());

describe('Healthcheck — état nominal & incidents de base (existant)', () => {
  it('INF-HEALTH-010 : tout vert -> ok', async () => {
    const report = await check(NOW, {
      db: fakeDbFor(GREEN),
      probes: { listmonkUp: true, smtpVerifyOk: true },
    });
    expect(report.level).toBe('ok');
  });

  it('INF-HEALTH-003 : outbox stuck -> degraded', async () => {
    const report = await check(NOW, {
      db: fakeDbFor({ ...GREEN, stuckCount: 3 }),
      probes: { listmonkUp: true, smtpVerifyOk: true },
    });
    expect(report.level).toBe('degraded');
  });

  it('INF-HEALTH-004 : DLQ>10 -> incident', async () => {
    const report = await check(NOW, {
      db: fakeDbFor({ ...GREEN, dlqCount: 12 }),
      probes: { listmonkUp: true, smtpVerifyOk: true },
    });
    expect(report.level).toBe('incident');
  });
});

describe('Healthcheck ÉTENDU — angles morts cible (ROUGE avant extension)', () => {
  it('INF-HEALTH-005 : pending vieillissant >10min -> degraded', async () => {
    const report = await check(NOW, {
      db: fakeDbFor({ ...GREEN, pendingCount: 8, pendingOldestMin: 30 }),
      probes: { listmonkUp: true, smtpVerifyOk: true },
    });
    expect(
      report.level,
      'un backlog pending ancien = cron outbox mort -> doit dégrader',
    ).not.toBe('ok');
  });

  it('INF-HEALTH-006 : cron pas tické depuis longtemps -> degraded', async () => {
    const report = await check(NOW, {
      db: fakeDbFor({ ...GREEN, outboxCronTickAgeSec: 600 }), // 10 min sans tick
      probes: { listmonkUp: true, smtpVerifyOk: true },
    });
    expect(report.level).not.toBe('ok');
  });

  it('INF-HEALTH-007 : Listmonk down -> degraded', async () => {
    const report = await check(NOW, {
      db: fakeDbFor(GREEN),
      probes: { listmonkUp: false, smtpVerifyOk: true },
    });
    expect(report.level).not.toBe('ok');
  });

  it('INF-HEALTH-008 : SMTP verify échoue -> incident', async () => {
    const report = await check(NOW, {
      db: fakeDbFor(GREEN),
      probes: { listmonkUp: true, smtpVerifyOk: false },
    });
    expect(report.level).toBe('incident');
  });

  it('INF-HEALTH-009 : jamais delivered malgré envois récents -> incident', async () => {
    const report = await check(NOW, {
      db: fakeDbFor({ ...GREEN, lastDeliveredAt: null, recentSentCount: 200 }),
      probes: { listmonkUp: true, smtpVerifyOk: true },
    });
    expect(
      report.level,
      'lastDelivered=null + envois récents = webhook Stalwart mort (W-URL)',
    ).toBe('incident');
  });
});

describe('Alerting DLQ (cible)', () => {
  it('INF-DLQ-001 : franchissement de seuil -> alerte émise', async () => {
    const alerts: string[] = [];
    const report = await check(NOW, {
      db: fakeDbFor({ ...GREEN, dlqCount: 6 }),
      probes: { listmonkUp: true, smtpVerifyOk: true },
      thresholds: { dlqAlert: 5 },
    });
    // Contrat cible : le rapport expose un flag d'alerte exploitable.
    expect((report.checks as { dlqAlert?: boolean }).dlqAlert).toBe(true);
    void alerts;
  });

  it('INF-DLQ-002 : sous le seuil -> pas d’alerte', async () => {
    const report = await check(NOW, {
      db: fakeDbFor({ ...GREEN, dlqCount: 2 }),
      probes: { listmonkUp: true, smtpVerifyOk: true },
      thresholds: { dlqAlert: 5 },
    });
    expect((report.checks as { dlqAlert?: boolean }).dlqAlert ?? false).toBe(false);
  });
});

/**
 * INF-UNIT-CRON-AUTH-* — auth cron timing-safe.
 * Contrat cible : un helper authorizeCron(req) qui hashe (SHA-256) le token
 * fourni ET attendu vers des buffers de longueur fixe puis timingSafeEqual.
 * Aucune fuite de longueur, aucun early-return observable.
 */
describe('auth cron timing-safe (cible)', () => {
  // import dynamique pour ne pas casser la suite si le helper n'existe pas encore.
  it('INF-UNIT-CRON-AUTH-001/002 : bon token autorise, mauvais refuse', async () => {
    const mod = await import('@/lib/cron/authorize-cron').catch(() => null);
    expect(mod, 'créer src/lib/cron/authorize-cron.ts (authorizeCron)').not.toBeNull();
    const { authorizeCron } = mod as { authorizeCron: (req: Request) => boolean };
    const good = new Request('http://t', { headers: { authorization: 'Bearer test-secret' } });
    const bad = new Request('http://t', { headers: { authorization: 'Bearer nope' } });
    process.env.CRON_SECRET = 'test-secret';
    expect(authorizeCron(good)).toBe(true);
    expect(authorizeCron(bad)).toBe(false);
  });

  it('INF-UNIT-CRON-AUTH-003 : longueurs différentes -> pas d’early-return (hash longueur fixe)', async () => {
    const mod = await import('@/lib/cron/authorize-cron').catch(() => null);
    if (!mod) return; // documenté ci-dessus
    const { authorizeCron } = mod as { authorizeCron: (req: Request) => boolean };
    process.env.CRON_SECRET = 'test-secret';
    // Token volontairement bien plus long : doit renvoyer false sans lever ni
    // court-circuiter sur la longueur (comparaison sur digests de taille fixe).
    const long = new Request('http://t', {
      headers: { authorization: 'Bearer ' + 'x'.repeat(4096) },
    });
    expect(() => authorizeCron(long)).not.toThrow();
    expect(authorizeCron(long)).toBe(false);
  });

  it('INF-UNIT-CRON-AUTH-005 : CRON_SECRET absent -> refuse (jamais ouvert)', async () => {
    const mod = await import('@/lib/cron/authorize-cron').catch(() => null);
    if (!mod) return;
    const { authorizeCron } = mod as { authorizeCron: (req: Request) => boolean };
    delete process.env.CRON_SECRET;
    const req = new Request('http://t', { headers: { authorization: 'Bearer whatever' } });
    expect(authorizeCron(req)).toBe(false);
  });
});

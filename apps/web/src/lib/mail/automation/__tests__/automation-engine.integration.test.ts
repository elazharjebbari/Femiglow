// @vitest-environment node
/**
 * Moteur d'automations — suite d'intégration vraie-DB (chantiers 1.7 + 1.4).
 *
 * ── Pourquoi UN SEUL fichier pour les deux chantiers ? ───────────────────
 * Ces deux batteries partagent la MÊME db de test (femiglow_test_automation) et
 * font un `TRUNCATE` global en `beforeEach`. Vitest exécute les fichiers de test
 * en parallèle (pool forks) : deux fichiers vraie-DB sur la même base se
 * truncate mutuellement en plein run → FK violations / lignes disparues. On les
 * regroupe donc dans un seul fichier (un fork = exécution séquentielle des tests
 * = isolation propre via le beforeEach). Les autres suites automation mockent la
 * DB et ne collisionnent pas.
 *
 * ── Chantier 1.7 — dispatcher de triggers événementiels ──────────────────
 * `email_automation.triggerType` / `triggerConfig` / `triggerConditions` étaient
 * persistés par le wizard puis JAMAIS lus par le runtime (seul `cart-abandoned-1h`
 * câblé en dur). `dispatchEventTriggers` lit ces champs et matche les user_event.
 *
 * ── Chantier 1.4 — sweep des runs orphelins / zombies ────────────────────
 * Le claim met `next_action_at = NULL` AVANT traitement ; un crash mid-tick laisse
 * `status='running'` + `next_action_at IS NULL` → jamais re-sélectionné.
 * `sweepOrphanRuns` (intégré au tick) ré-arme les reconstructibles et erreure les
 * autres avec une raison parlante.
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_automation#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/lib/mail/automation/__tests__/automation-engine.integration.test.ts
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { createId } from '@/lib/ids';
import { emailAutomation, emailAutomationRun } from '@/lib/db/schema-emails';
import { leadTag, leads, userEvent } from '@/lib/db/schema';
import {
  closeTestDb,
  emailsTestDb,
  emailsTestSql,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeAutomationRun, makeEmailAutomation } from '@/test/factories/emails.factory';
import { dispatchEventTriggers } from '../event-dispatcher';
import { sweepOrphanRuns } from '../orphan-sweep';
import { tickAutomation } from '../runner';

// Pas d'envoi réel : le step `wait` ne touche pas sendTransactional, mais on
// neutralise par prudence si une étape send apparaissait dans un tick.
vi.mock('@/lib/mail/send', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mail/send')>('@/lib/mail/send');
  return {
    ...actual,
    sendTransactional: vi.fn().mockResolvedValue({ status: 'queued', outboxId: 'ob_test' }),
  };
});

// Init PARESSEUSE : emailsTestDb() throw sans URL femiglow_test — l'appel
// module-level casserait le run global (le skip describeEmailsDb arrive après
// l'import). Proxies lazy : résolution au premier accès, dans un test actif.
const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});
const pg = new Proxy(((..._: never[]) => {}) as unknown as ReturnType<typeof emailsTestSql>, {
  get: (_t, prop) => (emailsTestSql() as never)[prop],
  apply: (_t, thisArg, args) => Reflect.apply(emailsTestSql() as never, thisArg, args),
});

const ANCHOR = new Date('2026-06-04T10:00:00.000Z');
/** Une étape `wait` simple : un run créé planifie sa première étape sans envoi réel. */
const WAIT_STEP = [{ kind: 'wait', durationMs: 3_600_000 }];

async function cleanup(): Promise<void> {
  // truncateEmailTables NE couvre PAS user_event ni leads → on les vide nous-mêmes.
  await truncateEmailTables();
  await pg`DELETE FROM user_event`;
  await pg`DELETE FROM leads`;
}

async function insertAutomation(over: Parameters<typeof makeEmailAutomation>[0] = {}) {
  const row = makeEmailAutomation({ steps: WAIT_STEP as unknown as object[], active: true, ...over });
  await db.insert(emailAutomation).values(row);
  return row;
}

async function insertRun(over: Parameters<typeof makeAutomationRun>[0] = {}) {
  const row = makeAutomationRun(over);
  await db.insert(emailAutomationRun).values(row);
  return row;
}

async function insertEvent(input: {
  email: string;
  eventName: string;
  ts?: Date;
  leadId?: string | null;
  properties?: Record<string, unknown>;
}): Promise<number> {
  const [row] = await db
    .insert(userEvent)
    .values({
      email: input.email.toLowerCase(),
      eventName: input.eventName,
      ts: input.ts ?? ANCHOR,
      properties: input.properties ?? {},
      source: 'server',
      leadId: input.leadId ?? null,
    })
    .returning({ id: userEvent.id });
  return row!.id;
}

async function runsForAutomation(automationId: string) {
  return db
    .select()
    .from(emailAutomationRun)
    .where(eq(emailAutomationRun.automationId, automationId));
}

async function getRun(id: string) {
  const [r] = await db
    .select()
    .from(emailAutomationRun)
    .where(eq(emailAutomationRun.id, id))
    .limit(1);
  return r!;
}

beforeEach(cleanup);
afterAll(closeTestDb);

// ───────────────────────────────────────────────────────────────────────────
// CHANTIER 1.7 — dispatcher de triggers événementiels
// ───────────────────────────────────────────────────────────────────────────
describeEmailsDb('chantier 1.7 — dispatchEventTriggers (moteur de triggers câblé)', () => {
  // AUT-INT-010 / AUT-INT-017 — triggerType='event' matché crée exactement 1 run
  it('AUT-INT-010 : user_event eventName==triggerConfig.eventName crée 1 run pour l’automation matchée', async () => {
    const auto = await insertAutomation({
      slug: `welcome-on-lead-${createId()}`,
      triggerType: 'event',
      triggerConfig: { eventName: 'lead.created' },
      active: true,
    });
    await insertEvent({ email: 'kaoutar@exemple.test', eventName: 'lead.created' });

    const res = await dispatchEventTriggers(new Date(ANCHOR.getTime() + 1000));

    expect(res.enrolled).toBe(1);
    const runs = await runsForAutomation(auto.id);
    expect(runs).toHaveLength(1);
    // Oracle métier : run prêt à être traité (running + nextActionAt posé + bon destinataire).
    expect(runs[0]!.status).toBe('running');
    expect(runs[0]!.recipientEmail).toBe('kaoutar@exemple.test');
    expect(runs[0]!.nextActionAt).toBeInstanceOf(Date);
    expect(runs[0]!.currentStep).toBe(0);
  });

  // AUT-INT-011 — un event d'un autre nom ne crée aucun run
  it('AUT-INT-011 : user_event d’un autre eventName ne crée aucun run', async () => {
    const auto = await insertAutomation({
      slug: `welcome-on-lead-${createId()}`,
      triggerType: 'event',
      triggerConfig: { eventName: 'lead.created' },
      active: true,
    });
    await insertEvent({ email: 'salma@exemple.test', eventName: 'order.placed' });

    const res = await dispatchEventTriggers(new Date(ANCHOR.getTime() + 1000));

    expect(res.enrolled).toBe(0);
    expect(await runsForAutomation(auto.id)).toHaveLength(0);
  });

  // AUT-INT-002 — automation inactive => aucun run
  it('AUT-INT-002 : automation inactive ne crée aucun run même si l’event matche', async () => {
    const auto = await insertAutomation({
      slug: `inactive-${createId()}`,
      triggerType: 'event',
      triggerConfig: { eventName: 'lead.created' },
      active: false,
    });
    await insertEvent({ email: 'imane@exemple.test', eventName: 'lead.created' });

    const res = await dispatchEventTriggers(new Date(ANCHOR.getTime() + 1000));

    expect(res.automations).toBe(0); // pas même scannée
    expect(res.enrolled).toBe(0);
    expect(await runsForAutomation(auto.id)).toHaveLength(0);
  });

  // AUT-INT-080 (idempotence dispatch) — même event rejoué => pas de doublon
  it('AUT-INT-080 : le même user_event traité deux fois ne crée pas de doublon (idempotence par eventId)', async () => {
    const auto = await insertAutomation({
      slug: `welcome-on-lead-${createId()}`,
      triggerType: 'event',
      triggerConfig: { eventName: 'lead.created' },
      active: true,
    });
    await insertEvent({ email: 'mehdi@exemple.test', eventName: 'lead.created' });

    const first = await dispatchEventTriggers(new Date(ANCHOR.getTime() + 1000));
    const second = await dispatchEventTriggers(new Date(ANCHOR.getTime() + 2000));

    expect(first.enrolled).toBe(1);
    expect(second.enrolled).toBe(0);
    expect(second.deduped).toBe(1);
    // Oracle dur : une seule ligne run au total malgré deux ticks.
    expect(await runsForAutomation(auto.id)).toHaveLength(1);
  });

  // ── AUD-01 — pourquoi consent_marketing et pas has_tag dans ce couple ─────
  // `has_tag` / `not_has_tag` sont NEUTRALISÉS au niveau du rules-compiler : ils
  // compilent en FALSE tant que M5.5 / TAGS_ENABLED n'est pas livré (pour que
  // `not_has_tag` ne matche jamais toute la base = envoi de masse hors cible).
  // Un oracle « condition satisfaite → enrôle » NE PEUT donc PAS s'appuyer sur
  // has_tag : il serait structurellement bloqué (bombe à retardement masquée —
  // c'est ce qui faisait rougir AUT-INT-013). On adosse le couple bloque/enrôle
  // à `consent_marketing`, condition réellement évaluée par le compilateur ; la
  // neutralisation de has_tag est, elle, assertée explicitement par AUT-INT-013b
  // (et couverte unitairement dans rules-compiler.test.ts).

  // AUT-INT-012 — triggerConditions non satisfaites bloquent l'enrôlement
  it('AUT-INT-012 : triggerConditions non satisfaites bloquent l’enrôlement', async () => {
    // Lead présent SANS consentement marketing (consent_marketing défaut false) ;
    // la condition exige consent_marketing=true → non satisfaite → bloque.
    await db.insert(leads).values({
      id: createId('l'),
      email: 'lead-noconsent@exemple.test',
      status: 'new',
    });
    const auto = await insertAutomation({
      slug: `cond-${createId()}`,
      triggerType: 'event',
      triggerConfig: { eventName: 'lead.status_changed' },
      triggerConditions: {
        kind: 'all',
        conditions: [{ kind: 'consent_marketing', value: true }],
      } as unknown as object,
      active: true,
    });
    await insertEvent({ email: 'lead-noconsent@exemple.test', eventName: 'lead.status_changed' });

    const res = await dispatchEventTriggers(new Date(ANCHOR.getTime() + 1000));

    expect(res.conditionBlocked).toBe(1);
    expect(res.enrolled).toBe(0);
    expect(await runsForAutomation(auto.id)).toHaveLength(0);
  });

  // AUT-INT-013 — triggerConditions satisfaites enrôlent le lead
  it('AUT-INT-013 : triggerConditions satisfaites enrôlent le lead', async () => {
    // Lead AVEC consentement marketing ; condition consent_marketing=true →
    // satisfaite → enrôle.
    await db.insert(leads).values({
      id: createId('l'),
      email: 'lead-consent@exemple.test',
      status: 'qualified',
      consentMarketing: true,
    });
    const auto = await insertAutomation({
      slug: `cond-${createId()}`,
      triggerType: 'event',
      triggerConfig: { eventName: 'lead.status_changed' },
      triggerConditions: {
        kind: 'all',
        conditions: [{ kind: 'consent_marketing', value: true }],
      } as unknown as object,
      active: true,
    });
    await insertEvent({ email: 'lead-consent@exemple.test', eventName: 'lead.status_changed' });

    const res = await dispatchEventTriggers(new Date(ANCHOR.getTime() + 1000));

    expect(res.enrolled).toBe(1);
    expect(await runsForAutomation(auto.id)).toHaveLength(1);
  });

  // AUT-INT-013b — INVARIANT AUD-01 : has_tag neutralisé → bloque MÊME quand le
  // lead porte réellement le tag. Garde-fou : tant que M5.5 / TAGS_ENABLED n'est
  // pas livré, aucune automation conditionnée sur un tag ne doit enrôler.
  it('AUT-INT-013b : has_tag neutralisé (AUD-01) bloque même si le lead porte le tag', async () => {
    const leadId = createId('l');
    await db.insert(leads).values({
      id: leadId,
      email: 'lead-vip@exemple.test',
      status: 'qualified',
    });
    await db.insert(leadTag).values({
      id: randomUUID(),
      leadId,
      tag: 'vip',
      source: 'manual',
      sourceRef: null,
    });
    const auto = await insertAutomation({
      slug: `cond-${createId()}`,
      triggerType: 'event',
      triggerConfig: { eventName: 'lead.status_changed' },
      triggerConditions: {
        kind: 'all',
        conditions: [{ kind: 'has_tag', tag: 'vip' }],
      } as unknown as object,
      active: true,
    });
    await insertEvent({ email: 'lead-vip@exemple.test', eventName: 'lead.status_changed' });

    const res = await dispatchEventTriggers(new Date(ANCHOR.getTime() + 1000));

    // Le tag existe en base, mais has_tag compile en FALSE → condition jamais
    // satisfaite → blocage (jamais d'enrôlement hors cible). Le warn structuré
    // `audience.rules.tag_neutralized` est émis (couvert dans rules-compiler.test.ts).
    expect(res.conditionBlocked).toBe(1);
    expect(res.enrolled).toBe(0);
    expect(await runsForAutomation(auto.id)).toHaveLength(0);
  });

  // AUT-INT-015 — triggerType='subscription' enrôle sur newsletter.subscribed
  it('AUT-INT-015 : triggerType=subscription enrôle sur l’event newsletter.subscribed', async () => {
    const auto = await insertAutomation({
      slug: `subscribe-${createId()}`,
      triggerType: 'subscription',
      triggerConfig: {}, // pas d'eventName explicite → défaut newsletter.subscribed
      active: true,
    });
    await insertEvent({ email: 'abonnee@exemple.test', eventName: 'newsletter.subscribed' });

    const res = await dispatchEventTriggers(new Date(ANCHOR.getTime() + 1000));

    expect(res.enrolled).toBe(1);
    expect(await runsForAutomation(auto.id)).toHaveLength(1);
  });

  // AUT-INT-016 / AUT-INT-014 — schedule & webhook ne sont PAS pilotés par le tick
  // (et ne plantent pas le dispatch : log structuré, jamais un silence ni un run).
  it('AUT-INT-016 : triggerType=webhook et =schedule ne créent aucun run via le scan d’events', async () => {
    const wh = await insertAutomation({
      slug: `wh-${createId()}`,
      triggerType: 'webhook',
      triggerConfig: { eventName: 'order.placed' }, // ignoré : webhook = push
      active: true,
    });
    const sched = await insertAutomation({
      slug: `sched-${createId()}`,
      triggerType: 'schedule',
      triggerConfig: { cron: '0 9 * * *' },
      active: true,
    });
    // Un event qui matcherait le eventName du webhook si on le pilotait par scan.
    await insertEvent({ email: 'cliente@exemple.test', eventName: 'order.placed' });

    const res = await dispatchEventTriggers(new Date(ANCHOR.getTime() + 1000));

    expect(res.enrolled).toBe(0);
    expect(await runsForAutomation(wh.id)).toHaveLength(0);
    expect(await runsForAutomation(sched.id)).toHaveLength(0);
  });

  // AUT-INT-010b — deux automations actives sur le même event → un run chacune
  it('AUT-INT-010b : deux automations actives sur le même event créent un run chacune', async () => {
    const a = await insertAutomation({
      slug: `a-${createId()}`,
      triggerType: 'event',
      triggerConfig: { eventName: 'order.delivered' },
      active: true,
    });
    const b = await insertAutomation({
      slug: `b-${createId()}`,
      triggerType: 'event',
      triggerConfig: { eventName: 'order.delivered' },
      active: true,
    });
    await insertEvent({ email: 'cliente2@exemple.test', eventName: 'order.delivered' });

    const res = await dispatchEventTriggers(new Date(ANCHOR.getTime() + 1000));

    expect(res.enrolled).toBe(2);
    expect(await runsForAutomation(a.id)).toHaveLength(1);
    expect(await runsForAutomation(b.id)).toHaveLength(1);
  });

  // AUT-INT-018 — le contexte du run contient les vraies vars de l'event (pas un placeholder)
  it('AUT-INT-018 : le run enrôlé porte les properties réelles de l’event dans contextJson', async () => {
    const auto = await insertAutomation({
      slug: `ctx-${createId()}`,
      triggerType: 'event',
      triggerConfig: { eventName: 'cart.abandoned' },
      active: true,
    });
    const eventId = await insertEvent({
      email: 'panier@exemple.test',
      eventName: 'cart.abandoned',
      properties: { cartTotalMad: 490, itemCount: 2 },
    });

    await dispatchEventTriggers(new Date(ANCHOR.getTime() + 1000));

    const runs = await runsForAutomation(auto.id);
    expect(runs).toHaveLength(1);
    const ctx = runs[0]!.contextJson as Record<string, unknown>;
    expect(ctx.recipientEmail).toBe('panier@exemple.test');
    expect(ctx.cartTotalMad).toBe(490);
    expect(ctx.itemCount).toBe(2);
    expect(ctx.eventId).toBe(eventId);
    // dedupeKey persisté pour l'idempotence (event:<id>).
    expect(ctx.dedupeKey).toBe(`event:${eventId}`);
  });

  // AUT-INT-017 regression — l'event HORS fenêtre de lookback n'est pas re-scanné
  it('AUT-INT-017 : un event plus vieux que la fenêtre de lookback n’est pas enrôlé', async () => {
    const auto = await insertAutomation({
      slug: `old-${createId()}`,
      triggerType: 'event',
      triggerConfig: { eventName: 'lead.created' },
      active: true,
    });
    // Event vieux de 3h ; lookback explicite 1h.
    await insertEvent({
      email: 'vieux@exemple.test',
      eventName: 'lead.created',
      ts: new Date(ANCHOR.getTime() - 3 * 60 * 60_000),
    });

    const res = await dispatchEventTriggers(ANCHOR, { lookbackMs: 60 * 60_000 });

    expect(res.enrolled).toBe(0);
    expect(await runsForAutomation(auto.id)).toHaveLength(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CHANTIER 1.4 — sweep des runs orphelins / zombies
// ───────────────────────────────────────────────────────────────────────────
describeEmailsDb('chantier 1.4 — sweepOrphanRuns (zombies running + next_action_at NULL)', () => {
  // AUT-INT-090 — zombie reconstructible : ré-armé par le sweep
  it('AUT-INT-090 : un run running next_action_at=NULL vieux de 2h est ré-armé (reprise propre)', async () => {
    const auto = await insertAutomation();
    const run = await insertRun({
      automationId: auto.id,
      status: 'running',
      nextActionAt: null,
      triggeredAt: new Date(ANCHOR.getTime() - 2 * 60 * 60_000), // 2h
      currentStep: 0,
      contextJson: { recipientEmail: 'zombie@exemple.test', _path: [0] },
    });

    const res = await sweepOrphanRuns(ANCHOR);

    expect(res.scanned).toBe(1);
    expect(res.rearmed).toBe(1);
    expect(res.errored).toBe(0);
    const after = await getRun(run.id);
    // Oracle : ré-armé pour re-claim — running + next_action_at posé.
    expect(after.status).toBe('running');
    expect(after.nextActionAt).toBeInstanceOf(Date);
    expect(after.nextActionAt!.getTime()).toBe(ANCHOR.getTime());
  });

  // AUT-INT-092 — non reconstructible (path hors-borne) : errored avec raison parlante
  it('AUT-INT-092 : un zombie dont le path est hors-borne passe en errored avec erroredReason parlant', async () => {
    const auto = await insertAutomation(); // 1 seule étape (index 0)
    const run = await insertRun({
      automationId: auto.id,
      status: 'running',
      nextActionAt: null,
      triggeredAt: new Date(ANCHOR.getTime() - 2 * 60 * 60_000),
      currentStep: 5, // hors-borne : aucune étape à l'index 5
      contextJson: { recipientEmail: 'broken@exemple.test', _path: [5] },
    });

    const res = await sweepOrphanRuns(ANCHOR);

    expect(res.scanned).toBe(1);
    expect(res.rearmed).toBe(0);
    expect(res.errored).toBe(1);
    const after = await getRun(run.id);
    expect(after.status).toBe('errored');
    expect(after.nextActionAt).toBeNull();
    expect(after.erroredAt).toBeInstanceOf(Date);
    // Oracle anti-silence : la raison est explicite (mentionne l'étape introuvable).
    expect(after.erroredReason).toBeTruthy();
    expect(after.erroredReason!.toLowerCase()).toContain('orphan');
    expect(after.erroredReason!).toContain('introuvable');
  });

  // AUT-INT-090b — steps JSON invalide : errored (steps non parsables)
  it('AUT-INT-090b : un zombie dont les steps sont invalides passe en errored (steps JSON invalide)', async () => {
    const auto = await insertAutomation({
      steps: [{ kind: 'totally_unknown_kind', foo: 1 }] as unknown as object[],
    });
    const run = await insertRun({
      automationId: auto.id,
      status: 'running',
      nextActionAt: null,
      triggeredAt: new Date(ANCHOR.getTime() - 2 * 60 * 60_000),
      currentStep: 0,
      contextJson: { recipientEmail: 'badsteps@exemple.test', _path: [0] },
    });

    const res = await sweepOrphanRuns(ANCHOR);

    expect(res.errored).toBe(1);
    const after = await getRun(run.id);
    expect(after.status).toBe('errored');
    expect(after.erroredReason!.toLowerCase()).toContain('steps');
  });

  // AUT-INT-090c — zombie trop récent : NON touché (anti-race tick sain)
  it('AUT-INT-090c : un run running next_action_at=NULL très récent n’est PAS balayé', async () => {
    const auto = await insertAutomation();
    const run = await insertRun({
      automationId: auto.id,
      status: 'running',
      nextActionAt: null,
      triggeredAt: new Date(ANCHOR.getTime() - 1000), // 1s — sous le seuil staleAfterMs
      contextJson: { recipientEmail: 'fresh@exemple.test', _path: [0] },
    });

    const res = await sweepOrphanRuns(ANCHOR);

    expect(res.scanned).toBe(0);
    const after = await getRun(run.id);
    expect(after.status).toBe('running');
    expect(after.nextActionAt).toBeNull();
  });
});

describeEmailsDb('chantier 1.4 — tickAutomation intègre le sweep + traite les runs dûs', () => {
  // AUT-INT-092e2e — le zombie reconstructible est repris ET exécuté DANS le même
  // tick (ré-armé puis claimé puis avancé) ; un run dont next_action_at est
  // dépassé est exécuté normalement.
  it('AUT-INT-092e2e : tick ré-arme le zombie ET exécute le run dépassé (les deux avancent)', async () => {
    // Le claim du runner compare next_action_at <= now() (horloge Postgres).
    // On ancre donc les timestamps sur l'horloge réelle pour être robuste.
    const now = new Date();
    const auto = await insertAutomation({
      // 2 étapes pour qu'un `wait` (étape 0) avance vers l'étape 1 (observable).
      steps: [
        { kind: 'wait', durationMs: 1_000 },
        { kind: 'wait', durationMs: 1_000 },
      ] as unknown as object[],
    });

    // (a) zombie : running + next_action_at NULL + vieux de 2h, étape 0.
    const zombie = await insertRun({
      automationId: auto.id,
      status: 'running',
      nextActionAt: null,
      triggeredAt: new Date(now.getTime() - 2 * 60 * 60_000),
      currentStep: 0,
      contextJson: { recipientEmail: 'zombie2@exemple.test', _path: [0] },
    });

    // (b) run dont next_action_at est largement dépassé → claimé normalement.
    const due = await insertRun({
      automationId: auto.id,
      status: 'running',
      nextActionAt: new Date(now.getTime() - 60_000), // dépassé
      triggeredAt: new Date(now.getTime() - 30 * 60_000),
      currentStep: 0,
      contextJson: { recipientEmail: 'due2@exemple.test', _path: [0] },
    });

    const r = await tickAutomation(now);

    // Le sweep a ré-armé le zombie...
    expect(r.orphansRearmed).toBe(1);
    expect(r.orphansErrored).toBe(0);
    // ... et les DEUX runs (zombie ré-armé + run dépassé) ont été claimés/avancés.
    expect(r.picked).toBe(2);
    expect(r.advanced).toBe(2);

    // Oracle observable : chaque run a avancé d'un step `wait` → étape 0 → étape 1.
    const zAfter = await getRun(zombie.id);
    const dAfter = await getRun(due.id);
    expect(zAfter.status).toBe('running');
    expect((zAfter.contextJson as { _path?: unknown })._path).toEqual([1]);
    expect(dAfter.status).toBe('running');
    expect((dAfter.contextJson as { _path?: unknown })._path).toEqual([1]);
  });
});

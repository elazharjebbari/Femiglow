/**
 * Unit tests — stalwart-parser.ts (Module 07 webhooks entrants).
 *
 * Couvre :
 *   - R-021 : normalisation de l'enveloppe NATIVE batch `{events:[…]}` + rétro-
 *     compat de l'enveloppe plate `{event,…}` ;
 *   - R-013 : mapping bounce hard (5xx) vs soft (4xx) — pas de confusion ;
 *   - aplatissement d'une entrée batch (type→event, data hoisté, code→errorCode
 *     pour delivery.failed uniquement, createdAt→ts) ;
 *   - lot partiellement invalide → échec schéma propre (pas de throw) ;
 *   - type inconnu / auth.failed / champ manquant tolérés ;
 *   - rejeu de fixtures réelles ;
 *   - MÉTA-TEST de sensibilité : muter un champ clé d'une fixture casse l'oracle.
 *
 * Pas de DB ici : ce sont des fonctions pures.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  stalwartWebhookSchema,
  stalwartBatchEnvelopeSchema,
  normalizeStalwartPayload,
  flattenBatchEntry,
  isBatchEnvelope,
  isKnownEvent,
  isHardBounce,
  mapStalwartEventToInternal,
  stripMessageIdBrackets,
  messageIdMatchForms,
} from '../stalwart-parser';

const FIXTURES = join(
  process.cwd(),
  'src/test/fixtures/emails/stalwart',
);
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}

describe('stalwart-parser — isBatchEnvelope (R-021)', () => {
  // M07-UNIT-001 — l'enveloppe native {events:[…]} est détectée comme batch.
  it('détecte l\'enveloppe native batch', () => {
    expect(isBatchEnvelope({ events: [{ type: 'delivery.delivered' }] })).toBe(true);
  });

  // M07-UNIT-002 — l'enveloppe plate {event,…} N'EST PAS un batch (rétro-compat).
  it('ne classe PAS l\'enveloppe plate comme batch', () => {
    expect(isBatchEnvelope({ event: 'delivery.delivered', messageId: '<x>' })).toBe(false);
  });

  // M07-UNIT-003 — un objet ambigu portant À LA FOIS event et events → traité
  // comme plat (le chemin legacy prime, des tests existants en dépendent).
  it('priorise le chemin plat si event ET events coexistent', () => {
    expect(isBatchEnvelope({ event: 'x', events: [] })).toBe(false);
  });

  // M07-UNIT-004 — null / primitives ne crashent pas et ne sont pas des batchs.
  it('tolère null/undefined/primitives sans crasher', () => {
    expect(isBatchEnvelope(null)).toBe(false);
    expect(isBatchEnvelope(undefined)).toBe(false);
    expect(isBatchEnvelope('events')).toBe(false);
    expect(isBatchEnvelope(42)).toBe(false);
    expect(isBatchEnvelope({ events: 'not-array' })).toBe(false);
  });
});

describe('stalwart-parser — flattenBatchEntry (R-021)', () => {
  // M07-UNIT-005 — type→event, data hoisté au top-level.
  it('aplatit type→event et hisse les champs de data', () => {
    const flat = flattenBatchEntry({
      id: '1',
      createdAt: '2026-05-13T14:41:37Z',
      type: 'delivery.delivered',
      data: { messageId: '<a@b>', rcpt: 'u@x.test', code: 250 },
    }) as Record<string, unknown>;
    expect(flat.event).toBe('delivery.delivered');
    expect(flat.messageId).toBe('<a@b>');
    expect(flat.rcpt).toBe('u@x.test');
  });

  // M07-UNIT-006 — createdAt → ts quand data n'a pas de ts propre.
  it('mappe createdAt vers ts si absent de data', () => {
    const flat = flattenBatchEntry({
      type: 'delivery.delivered',
      createdAt: '2026-05-13T14:41:37Z',
      data: { messageId: '<a@b>' },
    }) as Record<string, unknown>;
    expect(flat.ts).toBe('2026-05-13T14:41:37Z');
  });

  // M07-UNIT-007 — un ts présent dans data n'est PAS écrasé par createdAt.
  it('ne surcharge pas un ts déjà fourni dans data', () => {
    const flat = flattenBatchEntry({
      type: 'delivery.delivered',
      createdAt: '2026-01-01T00:00:00Z',
      data: { messageId: '<a@b>', ts: '2026-12-31T23:59:59Z' },
    }) as Record<string, unknown>;
    expect(flat.ts).toBe('2026-12-31T23:59:59Z');
  });

  // M07-UNIT-008 (R-013) — pour delivery.failed, le SMTP `code` natif est
  // mirroré sur `errorCode` (lu par isHardBounce).
  it('mirrore code→errorCode pour delivery.failed', () => {
    const flat = flattenBatchEntry({
      type: 'delivery.failed',
      data: { messageId: '<a@b>', code: 550, reason: 'user unknown' },
    }) as Record<string, unknown>;
    expect(flat.errorCode).toBe(550);
  });

  // M07-UNIT-009 — pour delivery.delivered, le `code` de succès (250) n'est PAS
  // promu en errorCode (sinon faux positif de bounce en aval).
  it('ne promeut PAS un code de succès en errorCode (delivered)', () => {
    const flat = flattenBatchEntry({
      type: 'delivery.delivered',
      data: { messageId: '<a@b>', code: 250 },
    }) as Record<string, unknown>;
    expect(flat.errorCode).toBeUndefined();
  });

  // M07-UNIT-010 — un errorCode déjà présent dans data n'est pas écrasé par code.
  it('préserve un errorCode déjà présent', () => {
    const flat = flattenBatchEntry({
      type: 'delivery.failed',
      data: { messageId: '<a@b>', errorCode: 421, code: 550 },
    }) as Record<string, unknown>;
    expect(flat.errorCode).toBe(421);
  });
});

describe('stalwart-parser — normalizeStalwartPayload : batch natif (R-021)', () => {
  // M07-UNIT-011 — la fixture 008 (REJETÉE par le schéma plat) est ACCEPTÉE par
  // le normaliseur et produit N=3 événements à plat. C'est le cœur de R-021.
  it('accepte la fixture native 008 et produit 3 événements plats', () => {
    // garde-fou : le schéma plat seul REJETTE bien 008 (preuve du gap de contrat)
    expect(stalwartWebhookSchema.safeParse(fixture('008-batch-multi-events.json')).success).toBe(false);

    const r = normalizeStalwartPayload(fixture('008-batch-multi-events.json'));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.events).toHaveLength(3);
    expect(r.events.map((e) => e.event)).toEqual([
      'delivery.delivered',
      'delivery.failed',
      'queue.rescheduled',
    ]);
    // le 2e (failed, code 550) doit porter errorCode=550 après aplatissement.
    const failed = r.events[1] as Record<string, unknown>;
    expect(failed.errorCode).toBe(550);
    expect(failed.messageId).toBe('<batch-0002@femiglow-maroc.com>');
  });

  // M07-UNIT-012 — un batch d'UN seul événement est aussi accepté (N=1).
  it('accepte un batch mono-événement', () => {
    const r = normalizeStalwartPayload({
      events: [{ id: '1', type: 'delivery.delivered', data: { messageId: '<a@b>' } }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.event).toBe('delivery.delivered');
  });

  // M07-UNIT-013 — un batch VIDE {events:[]} parse en 0 événement (pas d'erreur).
  it('accepte un batch vide → 0 événement', () => {
    const r = normalizeStalwartPayload({ events: [] });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.events).toHaveLength(0);
  });

  // M07-UNIT-014 — lot PARTIELLEMENT invalide : une entrée sans `type` → le
  // batch entier échoue PROPREMENT (ok:false + issues), sans throw.
  it('rejette proprement un batch dont une entrée n\'a pas de type', () => {
    const r = normalizeStalwartPayload({
      events: [
        { id: '1', type: 'delivery.delivered', data: { messageId: '<a@b>' } },
        { id: '2', data: { messageId: '<c@d>' } }, // pas de `type`
      ],
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.issues.length).toBeGreaterThan(0);
  });

  // M07-UNIT-015 — entrée batch avec un type INCONNU (acme.*) reste parseable
  // (schéma plat unknownEventSchema) → l'événement est produit, ignoré en aval.
  it('produit l\'événement même pour un type inconnu dans le batch', () => {
    const r = normalizeStalwartPayload({
      events: [{ id: '1', type: 'acme.order-completed', data: { hostname: 'x' } }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.events[0]!.event).toBe('acme.order-completed');
    expect(isKnownEvent(r.events[0]!)).toBe(false);
  });
});

describe('stalwart-parser — normalizeStalwartPayload : enveloppe plate (rétro-compat)', () => {
  // M07-UNIT-016 — l'enveloppe plate historique produit exactement 1 événement.
  it('accepte l\'enveloppe plate et renvoie 1 événement', () => {
    const r = normalizeStalwartPayload({
      event: 'delivery.delivered',
      messageId: '<a@b>',
      ts: '2026-01-01T00:00:00Z',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.event).toBe('delivery.delivered');
  });

  // M07-UNIT-017 — payload plat invalide (event manquant) → ok:false propre.
  it('rejette proprement un plat sans champ event', () => {
    const r = normalizeStalwartPayload({ messageId: '<a@b>' });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.issues.length).toBeGreaterThan(0);
  });

  // M07-UNIT-018 — toutes les fixtures PLATES de référence parsent en N=1.
  it.each([
    '001-delivered.json',
    '002-bounce-hard.json',
    '003-bounce-soft.json',
    '004-complaint-abuse.json',
    '005-deferred.json',
    '006-rejected.json',
    '007-queued-authenticated.json',
    '009-missing-message-id.json',
    '010-unexpected-type.json',
    '011-auth-failed.json',
    '012-large-payload.json',
  ])('parse la fixture plate %s en exactement 1 événement', (file) => {
    const r = normalizeStalwartPayload(fixture(file));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(`fixture ${file} should parse`);
    expect(r.events).toHaveLength(1);
  });
});

describe('stalwart-parser — mapping hard/soft bounce (R-013)', () => {
  // M07-UNIT-019 — isHardBounce : 5xx ⇒ hard, 4xx ⇒ soft, absent ⇒ soft.
  it('distingue 5xx (hard) de 4xx (soft) et tolère l\'absence de code', () => {
    expect(isHardBounce(550)).toBe(true);
    expect(isHardBounce(554)).toBe(true);
    expect(isHardBounce(500)).toBe(true);
    expect(isHardBounce(599)).toBe(true);
    expect(isHardBounce(451)).toBe(false);
    expect(isHardBounce(421)).toBe(false);
    expect(isHardBounce(452)).toBe(false);
    expect(isHardBounce(undefined)).toBe(false);
    // hors plage SMTP : 600+ n'est pas un 5xx → non hard.
    expect(isHardBounce(600)).toBe(false);
    expect(isHardBounce(499)).toBe(false);
  });

  // M07-UNIT-020 — mapStalwartEventToInternal : delivery.failed → bounced_hard
  // (raffiné en soft via isHardBounce au call site), pas l'inverse.
  it('mappe les events vers l\'enum interne sans confondre hard/soft', () => {
    expect(mapStalwartEventToInternal('delivery.delivered')).toBe('delivered');
    expect(mapStalwartEventToInternal('delivery.failed')).toBe('bounced_hard');
    expect(mapStalwartEventToInternal('queue.rescheduled')).toBe('retried');
    expect(mapStalwartEventToInternal('queue.message-queued')).toBe('queued');
    expect(mapStalwartEventToInternal('queue.authenticated-message-queued')).toBe('queued');
    expect(mapStalwartEventToInternal('auth.failed')).toBeNull();
    expect(mapStalwartEventToInternal('acme.order-completed')).toBeNull();
  });

  // M07-UNIT-021 — la fixture bounce-hard (002, errorCode 550) ⇒ hard ;
  //               la fixture bounce-soft (003, errorCode 451) ⇒ soft.
  it('classe les fixtures bounce-hard/soft conformément aux oracles README', () => {
    const hard = normalizeStalwartPayload(fixture('002-bounce-hard.json'));
    const soft = normalizeStalwartPayload(fixture('003-bounce-soft.json'));
    expect(hard.ok && soft.ok).toBe(true);
    if (!hard.ok || !soft.ok) throw new Error('unreachable');
    expect(isHardBounce((hard.events[0] as Record<string, unknown>).errorCode as number)).toBe(true);
    expect(isHardBounce((soft.events[0] as Record<string, unknown>).errorCode as number)).toBe(false);
  });
});

describe('stalwart-parser — isKnownEvent / auth.failed', () => {
  // M07-UNIT-022 — les 6 events métier sont "known" ; acme.* ne l'est pas.
  it('reconnaît les events métier et ignore le reste', () => {
    for (const e of [
      'queue.message-queued',
      'queue.authenticated-message-queued',
      'delivery.delivered',
      'delivery.failed',
      'queue.rescheduled',
      'auth.failed',
    ]) {
      expect(isKnownEvent({ event: e } as never)).toBe(true);
    }
    expect(isKnownEvent({ event: 'acme.order-completed' } as never)).toBe(false);
    expect(isKnownEvent({ event: 'imap.connection' } as never)).toBe(false);
  });
});

describe('stalwart-parser — batch envelope schema', () => {
  // M07-UNIT-023 — stalwartBatchEnvelopeSchema valide la fixture 008.
  it('valide la fixture native 008 via stalwartBatchEnvelopeSchema', () => {
    expect(stalwartBatchEnvelopeSchema.safeParse(fixture('008-batch-multi-events.json')).success).toBe(true);
  });
});

/**
 * MÉTA-TEST de sensibilité (anti-oracle-mou). On mute un champ CLÉ d'une fixture
 * et on vérifie qu'au moins un oracle bascule. Si une mutation passait sans
 * rien casser, c'est que l'oracle correspondant ne teste rien.
 */
describe('stalwart-parser — méta-test de sensibilité des oracles', () => {
  // M07-UNIT-024 — muter `event` → un type inconnu fait perdre le statut "known".
  it('muter l\'event en valeur inconnue casse l\'oracle isKnownEvent', () => {
    const original = fixture('001-delivered.json') as Record<string, unknown>;
    // baseline : known
    const base = normalizeStalwartPayload(original);
    expect(base.ok).toBe(true);
    if (!base.ok) throw new Error('unreachable');
    expect(isKnownEvent(base.events[0]!)).toBe(true);
    // mutation
    const mutated = { ...original, event: 'totally.bogus' };
    const r = normalizeStalwartPayload(mutated);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(isKnownEvent(r.events[0]!)).toBe(false); // l'oracle a bien basculé
  });

  // M07-UNIT-025 — muter le errorCode de bounce-hard (550→451) bascule hard→soft.
  it('muter errorCode 550→451 bascule l\'oracle hard→soft', () => {
    const hard = fixture('002-bounce-hard.json') as Record<string, unknown>;
    expect(isHardBounce(hard.errorCode as number)).toBe(true); // baseline hard
    const mutated = { ...hard, errorCode: 451 };
    expect(isHardBounce(mutated.errorCode as number)).toBe(false); // a basculé
  });

  // M07-UNIT-026 — retirer `messageId` d'une entrée batch failed → le batch parse
  // toujours (passthrough), mais l'aplatissement n'a plus de messageId : l'oracle
  // "messageId présent" bascule.
  it('retirer messageId d\'une entrée batch fait disparaître l\'identifiant', () => {
    const batch = fixture('008-batch-multi-events.json') as {
      events: Array<{ data: Record<string, unknown>; type: string }>;
    };
    const base = normalizeStalwartPayload(batch);
    expect(base.ok).toBe(true);
    if (!base.ok) throw new Error('unreachable');
    expect((base.events[0] as Record<string, unknown>).messageId).toBeTruthy();

    // mutation : on retire messageId de la 1re entrée
    const clone = structuredClone(batch);
    delete clone.events[0]!.data.messageId;
    const r = normalizeStalwartPayload(clone);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect((r.events[0] as Record<string, unknown>).messageId).toBeUndefined(); // a basculé
  });

  // M07-UNIT-027 — corrompre l'enveloppe batch (events → objet, pas tableau)
  // fait basculer le parse de ok:true à ok:false.
  it('corrompre la structure events casse le parse', () => {
    const batch = fixture('008-batch-multi-events.json') as Record<string, unknown>;
    expect(normalizeStalwartPayload(batch).ok).toBe(true); // baseline
    const mutated = { ...batch, events: { not: 'an-array' } };
    // isBatchEnvelope est false (events pas un tableau) → tombe sur le chemin
    // plat → pas de champ `event` → ok:false.
    expect(normalizeStalwartPayload(mutated).ok).toBe(false); // a basculé
  });
});

/**
 * Fix bracket-mismatch : Stalwart rapporte le Message-ID SANS chevrons alors que
 * l'app stocke `smtp_message_id` AVEC (nodemailer `info.messageId`). Sans
 * normalisation, le match outbox échouait toujours → `delivered`/`bounced` jamais
 * peuplé (cause racine du « webhook silencieux »).
 */
describe('stalwart-parser — normalisation Message-ID', () => {
  it('stripMessageIdBrackets retire les chevrons, idempotent', () => {
    expect(stripMessageIdBrackets('<abc@d>')).toBe('abc@d');
    expect(stripMessageIdBrackets('abc@d')).toBe('abc@d');
    expect(stripMessageIdBrackets('<<abc@d>>')).toBe('abc@d');
    expect(stripMessageIdBrackets('')).toBe('');
  });

  it('messageIdMatchForms produit la forme bracketée ET nue', () => {
    // Cas réel : Stalwart envoie `abc@…` (nu), l'app a stocké `<abc@…>`.
    expect(messageIdMatchForms('23bf4dc6@femiglow-maroc.com')).toEqual([
      '<23bf4dc6@femiglow-maroc.com>',
      '23bf4dc6@femiglow-maroc.com',
    ]);
    expect(messageIdMatchForms('<x@y>')).toEqual(['<x@y>', 'x@y']);
  });
});

describe('stalwart-parser — events DSN (couverture bounce)', () => {
  it('reconnaît delivery.dsn-perm-fail / dsn-temp-fail comme known', () => {
    expect(isKnownEvent({ event: 'delivery.dsn-perm-fail' } as never)).toBe(true);
    expect(isKnownEvent({ event: 'delivery.dsn-temp-fail' } as never)).toBe(true);
  });

  it('mappe les DSN vers hard/soft', () => {
    expect(mapStalwartEventToInternal('delivery.dsn-perm-fail')).toBe('bounced_hard');
    expect(mapStalwartEventToInternal('delivery.dsn-temp-fail')).toBe('bounced_soft');
  });

  it('parse un dsn-perm-fail SANS messageId (juste rcpt) — passthrough', () => {
    const r = normalizeStalwartPayload({
      event: 'delivery.dsn-perm-fail',
      rcpt: 'nobody@example.test',
      reason: 'DNS lookup failed: no MX record found.',
      ts: '2026-06-24T22:03:04Z',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.events[0]!.event).toBe('delivery.dsn-perm-fail');
    expect(isKnownEvent(r.events[0]!)).toBe(true);
  });
});

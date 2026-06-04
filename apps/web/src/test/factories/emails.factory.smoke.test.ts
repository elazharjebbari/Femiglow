// @vitest-environment node
/**
 * Smoke test — factories emailing (qa-campaign-2026-06, phase 0.2).
 *
 * Oracles :
 *  - déterminisme : 2 appels → structure stable, ids distincts ;
 *  - overrides respectés (shallow merge) ;
 *  - clés critiques présentes par factory ;
 *  - les payloads webhook PARSENT contre les vrais schemas Zod du repo
 *    (oracle fort : si le format dérive, le parser rejette → test rouge).
 *
 * Le typage `satisfies <table>.$inferInsert` dans la factory est l'oracle
 * statique (tsc) ; ce fichier couvre l'oracle runtime.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  makeOutboxRow,
  makeEmailEvent,
  makeEmailAutomation,
  makeAutomationRun,
  makeEmailAudience,
  makeAudienceSnapshot,
  makeSnapshotMember,
  makeCampaignLink,
  makeSubscriberLink,
  makeSuppression,
  makeTemplateCustom,
  makeTemplateCustomVersion,
  makeLeadTag,
  makeStalwartEvent,
  makeListmonkEvent,
  resetEmailFactories,
} from './emails.factory';
import {
  stalwartWebhookSchema,
  isKnownEvent,
  mapStalwartEventToInternal,
  isHardBounce,
} from '@/lib/mail/webhooks/stalwart-parser';
import {
  listmonkWebhookSchema,
  isKnownListmonkEvent,
} from '@/lib/mail/webhooks/listmonk-parser';

beforeEach(() => {
  resetEmailFactories();
});

describe('emails.factory — déterminisme & overrides', () => {
  // CKP-FACT-EMAIL-001 — 2 appels successifs : structure stable, ids distincts
  it('produit des ids distincts mais une structure stable entre 2 appels', () => {
    const a = makeOutboxRow();
    const b = makeOutboxRow();
    expect(a.id).not.toBe(b.id);
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
    expect(a.toEmail).not.toBe(b.toEmail);
    // structure stable : mêmes clés, mêmes types
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect(typeof a.subject).toBe('string');
    expect(a.status).toBe(b.status);
  });

  // CKP-FACT-EMAIL-002 — overrides respectés (shallow merge), defaults conservés
  it('respecte les overrides sans écraser les autres champs', () => {
    const row = makeOutboxRow({ status: 'delivered', toEmail: 'fixe@exemple.test' });
    expect(row.status).toBe('delivered');
    expect(row.toEmail).toBe('fixe@exemple.test');
    // un champ non surchargé garde son défaut
    expect(row.fromEmail).toBe('bonjour@femiglow-maroc.com');
  });

  // CKP-FACT-EMAIL-003 — reset du compteur → ids reproductibles d'un run à l'autre
  it('resetEmailFactories remet le compteur à zéro', () => {
    const first = makeSubscriberLink();
    resetEmailFactories();
    const afterReset = makeSubscriberLink();
    expect(afterReset.email).toBe(first.email);
  });
});

describe('emails.factory — clés critiques par factory (lignes DB)', () => {
  // CKP-FACT-EMAIL-010 — makeOutboxRow
  it('makeOutboxRow : clés NOT NULL et payload MAD réaliste', () => {
    const row = makeOutboxRow();
    expect(row.id).toBeTruthy();
    expect(row.idempotencyKey).toBeTruthy();
    expect(row.template).toBeTruthy();
    expect(row.templateVersion).toBe(1);
    expect(row.toEmail).toMatch(/@exemple\.test$/);
    expect(row.subject).toBeTruthy();
    expect(row.status).toBe('pending');
    expect(row.payloadJson).toMatchObject({ montantMad: 490 });
  });

  // CKP-FACT-EMAIL-011 — makeEmailEvent (bigserial id omis par défaut)
  it('makeEmailEvent : type/source valides, id auto omis', () => {
    const evt = makeEmailEvent();
    expect(evt).not.toHaveProperty('id');
    expect(evt.type).toBe('delivered');
    expect(evt.source).toBe('stalwart');
    expect(evt.outboxId).toBeTruthy();
    const withId = makeEmailEvent({ id: 42 });
    expect(withId.id).toBe(42);
  });

  // CKP-FACT-EMAIL-012 — makeEmailAutomation
  it('makeEmailAutomation : trigger + steps + quiet hours Casablanca', () => {
    const auto = makeEmailAutomation();
    expect(auto.id).toBeTruthy();
    expect(auto.slug).toMatch(/^welcome-series-/);
    expect(auto.triggerType).toBe('event');
    expect(Array.isArray(auto.steps)).toBe(true);
    expect(auto.quietHoursTz).toBe('Africa/Casablanca');
    expect(auto.active).toBe(false);
  });

  // CKP-FACT-EMAIL-013 — makeAutomationRun
  it('makeAutomationRun : recipient @exemple.test, status running, outboxIds[]', () => {
    const run = makeAutomationRun();
    expect(run.id).toBeTruthy();
    expect(run.automationId).toBeTruthy();
    expect(run.recipientEmail).toMatch(/@exemple\.test$/);
    expect(run.status).toBe('running');
    expect(run.currentStep).toBe(0);
    expect(run.outboxIds).toEqual([]);
  });

  // CKP-FACT-EMAIL-014 — makeEmailAudience (uuid id omis)
  it('makeEmailAudience : règles + exclusionFlags, id uuid omis', () => {
    const aud = makeEmailAudience();
    expect(aud).not.toHaveProperty('id');
    expect(aud.slug).toMatch(/^acheteuses-recentes-/);
    expect(aud.evaluationMode).toBe('dynamic');
    expect(aud.exclusionFlags).toMatchObject({ hard_bounce: true, unsubscribe: true });
    expect(aud.createdBy).toBe('admin_test');
  });

  // CKP-FACT-EMAIL-015 — makeAudienceSnapshot
  it('makeAudienceSnapshot : status done, purgeableAfter NOT NULL', () => {
    const snap = makeAudienceSnapshot();
    expect(snap).not.toHaveProperty('id');
    expect(snap.audienceId).toBeTruthy();
    expect(snap.status).toBe('done');
    expect(snap.purgeableAfter).toBeInstanceOf(Date);
    expect(snap.size).toBe(3);
  });

  // CKP-FACT-EMAIL-016 — makeSnapshotMember
  it('makeSnapshotMember : snapshotId + email + payload téléphone +212', () => {
    const m = makeSnapshotMember();
    expect(m.snapshotId).toBeTruthy();
    expect(m.email).toMatch(/@exemple\.test$/);
    expect(m.payload).toMatchObject({});
    expect((m.payload as { phoneE164: string }).phoneE164).toMatch(/^\+212/);
  });

  // CKP-FACT-EMAIL-017 — makeCampaignLink
  it('makeCampaignLink : status draft, compteurs à zéro', () => {
    const c = makeCampaignLink();
    expect(c.id).toBeTruthy();
    expect(c.status).toBe('draft');
    expect(c.name).toBeTruthy();
    expect(c.sentCount).toBe(0);
    expect(c.openCount).toBe(0);
    expect(typeof c.listmonkCampaignId).toBe('number');
  });

  // CKP-FACT-EMAIL-018 — makeSubscriberLink
  it('makeSubscriberLink : email PK, status enabled, prénom MA', () => {
    const s = makeSubscriberLink();
    expect(s.email).toMatch(/@exemple\.test$/);
    expect(s.status).toBe('enabled');
    expect(s.firstName).toBeTruthy();
    expect(typeof s.listmonkSubscriberId).toBe('number');
  });

  // CKP-FACT-EMAIL-019 — makeSuppression
  it('makeSuppression : reason + source valides', () => {
    const sup = makeSuppression();
    expect(sup.email).toMatch(/@exemple\.test$/);
    expect(sup.reason).toBe('hard_bounce');
    expect(sup.source).toBe('listmonk');
  });

  // CKP-FACT-EMAIL-020 — makeTemplateCustom
  it('makeTemplateCustom : subjectTmpl + htmlSource NOT NULL, vars MAD', () => {
    const t = makeTemplateCustom();
    expect(t).not.toHaveProperty('id');
    expect(t.slug).toMatch(/^promo-printemps-/);
    expect(t.subjectTmpl).toContain('MAD');
    expect(t.htmlSource).toContain('<html>');
    expect(t.createdBy).toBe('admin_test');
  });

  // CKP-FACT-EMAIL-021 — makeTemplateCustomVersion
  it('makeTemplateCustomVersion : templateId + versionNumber', () => {
    const v = makeTemplateCustomVersion();
    expect(v).not.toHaveProperty('id');
    expect(v.templateId).toBeTruthy();
    expect(v.versionNumber).toBe(1);
    expect(v.htmlSource).toBeTruthy();
  });

  // CKP-FACT-EMAIL-022 — makeLeadTag (bonus audiences has_tag)
  it('makeLeadTag : leadId + tag + source automation', () => {
    const tag = makeLeadTag();
    expect(tag.id).toBeTruthy();
    expect(tag.leadId).toBeTruthy();
    expect(tag.tag).toBe('acheteuse');
    expect(tag.source).toBe('automation');
  });
});

describe('emails.factory — payloads webhook Stalwart (parse contre le vrai schema)', () => {
  // CKP-FACT-EMAIL-030 — delivery.delivered parse + mappe vers 'delivered'
  it('delivery.delivered : parse + map interne', () => {
    const payload = makeStalwartEvent();
    const parsed = stalwartWebhookSchema.parse(payload);
    expect(parsed.event).toBe('delivery.delivered');
    expect(isKnownEvent(parsed)).toBe(true);
    expect(mapStalwartEventToInternal(parsed.event)).toBe('delivered');
  });

  // CKP-FACT-EMAIL-031 — delivery.failed avec errorCode 5xx = hard bounce
  it('delivery.failed : errorCode 550 → hard bounce', () => {
    const payload = makeStalwartEvent({ event: 'delivery.failed' });
    const parsed = stalwartWebhookSchema.parse(payload);
    expect(parsed.event).toBe('delivery.failed');
    expect((payload as { errorCode: number }).errorCode).toBe(550);
    expect(isHardBounce(550)).toBe(true);
    expect(mapStalwartEventToInternal(parsed.event)).toBe('bounced_hard');
  });

  // CKP-FACT-EMAIL-032 — queue.rescheduled → retried + nextRetry présent
  it('queue.rescheduled : nextRetry présent, map → retried', () => {
    const payload = makeStalwartEvent({ event: 'queue.rescheduled' });
    const parsed = stalwartWebhookSchema.parse(payload);
    expect((payload as { nextRetry?: string }).nextRetry).toBeTruthy();
    expect(mapStalwartEventToInternal(parsed.event)).toBe('retried');
  });

  // CKP-FACT-EMAIL-033 — auth.failed : pas de queueId, user/ip présents
  it('auth.failed : user + ip, sans queueId', () => {
    const payload = makeStalwartEvent({ event: 'auth.failed' });
    const parsed = stalwartWebhookSchema.parse(payload);
    expect(parsed.event).toBe('auth.failed');
    expect(payload).not.toHaveProperty('queueId');
    expect((payload as { user: string }).user).toBeTruthy();
    expect(mapStalwartEventToInternal(parsed.event)).toBeNull();
  });

  // CKP-FACT-EMAIL-034 — override champ libre (passthrough)
  it('accepte un override de champ arbitraire (passthrough)', () => {
    const payload = makeStalwartEvent({ event: 'delivery.delivered', customField: 'x' });
    const parsed = stalwartWebhookSchema.parse(payload);
    expect((parsed as Record<string, unknown>).customField).toBe('x');
  });
});

describe('emails.factory — payloads webhook Listmonk (parse contre le vrai schema)', () => {
  // CKP-FACT-EMAIL-040 — subscriber.unsubscribed : shape {event,source,ts,data}
  it('subscriber.unsubscribed : shape complète + subscriber.email', () => {
    const payload = makeListmonkEvent();
    const parsed = listmonkWebhookSchema.parse(payload);
    expect(parsed.event).toBe('subscriber.unsubscribed');
    expect((payload as { source: string }).source).toBe('listmonk');
    expect(isKnownListmonkEvent(parsed)).toBe(true);
    const data = (parsed as unknown as { data: { subscriber: { email: string } } }).data;
    expect(data.subscriber.email).toMatch(/@exemple\.test$/);
  });

  // CKP-FACT-EMAIL-041 — subscriber.bounced : bounce_type hard
  it('subscriber.bounced : data.bounce_type=hard', () => {
    const payload = makeListmonkEvent({ event: 'subscriber.bounced' });
    const parsed = listmonkWebhookSchema.parse(payload);
    const data = (parsed as { data: Record<string, unknown> }).data;
    expect(data.bounce_type).toBe('hard');
    expect((data.subscriber as { email: string }).email).toBeTruthy();
  });

  // CKP-FACT-EMAIL-042 — campaign.completed : compteurs présents
  it('campaign.completed : id + compteurs (sent/views/clicks/bounces)', () => {
    const payload = makeListmonkEvent({ event: 'campaign.completed', campaignId: 777 });
    const parsed = listmonkWebhookSchema.parse(payload);
    const data = (parsed as { data: Record<string, unknown> }).data;
    expect(data.id).toBe(777);
    expect(data.sent).toBe(100);
    expect(data.views).toBe(42);
  });

  // CKP-FACT-EMAIL-043 — subscriber.created : email + id directement dans data
  it('subscriber.created : data.email + data.id (lu directement)', () => {
    const payload = makeListmonkEvent({ event: 'subscriber.created' });
    const parsed = listmonkWebhookSchema.parse(payload);
    const data = (parsed as { data: Record<string, unknown> }).data;
    expect(data.email).toMatch(/@exemple\.test$/);
    expect(typeof data.id).toBe('number');
  });

  // CKP-FACT-EMAIL-044 — override data complet
  it('respecte un override complet du champ data', () => {
    const payload = makeListmonkEvent({
      event: 'campaign.started',
      data: { id: 999, name: 'override' },
    });
    const parsed = listmonkWebhookSchema.parse(payload);
    const data = (parsed as { data: Record<string, unknown> }).data;
    expect(data).toEqual({ id: 999, name: 'override' });
  });
});

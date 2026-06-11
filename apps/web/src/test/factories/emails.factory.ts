/**
 * Factories de test — domaine emailing (phase 0.2 du plan QA).
 *
 * Référence schema : `apps/web/src/lib/db/schema-emails.ts` (10 tables + matviews)
 *                     `apps/web/src/lib/db/schema.ts` (table lead_tag, M5.5)
 *                     `apps/web/src/lib/mail/webhooks/**` (payloads Stalwart/Listmonk)
 *
 * Conventions :
 *  - Déterministes : compteur scoped → ids stables/uniques par appel.
 *  - Overrides `Partial<...>` shallow-merged (defaults toujours valides).
 *  - Données réalistes Maroc : prénoms (Kaoutar/Loutfi/Yassine…), montants MAD,
 *    téléphones +212, emails @exemple.test.
 *  - Typage = oracle : chaque factory de ligne DB satisfait le type d'insert
 *    drizzle (`typeof table.$inferInsert` via `satisfies`) → tsc attrape tout
 *    drift de champ schema/factory.
 *
 * IMPORTANT : `satisfies` est appliqué à l'objet *avant* spread des overrides,
 * de sorte que le retour reste assignable au type d'insert tout en autorisant
 * des overrides typés.
 */
import { randomUUID } from 'node:crypto';

import { createId } from '@/lib/ids';
import type {
  emailOutbox,
  emailEvent,
  emailAutomation,
  emailAutomationRun,
  emailAudience,
  emailAudienceSnapshot,
  emailAudienceSnapshotMember,
  emailCampaignLink,
  emailSubscriberLink,
  emailSuppression,
  emailTemplateCustom,
  emailTemplateCustomVersion,
} from '@/lib/db/schema-emails';
import type { leadTag } from '@/lib/db/schema';

// — Insert types (oracle de typage) — — — — — — — — — — — — — — — — — — — —

type OutboxInsert = typeof emailOutbox.$inferInsert;
type EmailEventInsert = typeof emailEvent.$inferInsert;
type AutomationInsert = typeof emailAutomation.$inferInsert;
type AutomationRunInsert = typeof emailAutomationRun.$inferInsert;
type AudienceInsert = typeof emailAudience.$inferInsert;
type SnapshotInsert = typeof emailAudienceSnapshot.$inferInsert;
type SnapshotMemberInsert = typeof emailAudienceSnapshotMember.$inferInsert;
type CampaignLinkInsert = typeof emailCampaignLink.$inferInsert;
type SubscriberLinkInsert = typeof emailSubscriberLink.$inferInsert;
type SuppressionInsert = typeof emailSuppression.$inferInsert;
type TemplateCustomInsert = typeof emailTemplateCustom.$inferInsert;
type TemplateCustomVersionInsert = typeof emailTemplateCustomVersion.$inferInsert;
type LeadTagInsert = typeof leadTag.$inferInsert;

// — Données réalistes Maroc — — — — — — — — — — — — — — — — — — — — — — — —

const FIRST_NAMES_MA = ['Kaoutar', 'Loutfi', 'Yassine', 'Salma', 'Imane', 'Mehdi'] as const;
const LAST_NAMES_MA = ['Benani', 'El Idrissi', 'Tazi', 'Cherkaoui', 'Alaoui'] as const;

// — Compteur déterministe — — — — — — — — — — — — — — — — — — — — — — — — —
// Scoped au module : reset via resetEmailFactories() (utile en afterEach).

let seq = 0;

/** Avance le compteur et retourne sa valeur. */
function next(): number {
  seq += 1;
  return seq;
}

/** Réinitialise le compteur déterministe (à appeler dans afterEach si besoin). */
export function resetEmailFactories(): void {
  seq = 0;
}

/** Prénom MA pseudo-déterministe (dépend du compteur). */
function firstName(n: number): string {
  return FIRST_NAMES_MA[n % FIRST_NAMES_MA.length] as string;
}

/** Nom MA pseudo-déterministe (dépend du compteur). */
function fullName(n: number): string {
  return `${firstName(n)} ${LAST_NAMES_MA[n % LAST_NAMES_MA.length]}`;
}

/** Email @exemple.test stable et unique par compteur. */
function email(n: number, label = 'cliente'): string {
  return `${label}${n}@exemple.test`;
}

/** Téléphone marocain +212 (format E.164) déterministe par compteur. */
function phoneE164(n: number): string {
  const suffix = String(600000000 + (n % 99999999)).padStart(9, '0');
  return `+212${suffix.slice(0, 9)}`;
}

/** Date d'ancrage stable pour les tests (déterminisme avec/sans fake timers). */
const ANCHOR = new Date('2026-06-04T10:00:00.000Z');

// — email_outbox — — — — — — — — — — — — — — — — — — — — — — — — — — — — —

export function makeOutboxRow(overrides: Partial<OutboxInsert> = {}): OutboxInsert {
  const n = next();
  const base = {
    id: createId('out'),
    idempotencyKey: `idem_${n}_${createId()}`,
    template: 'welcome-rituel',
    templateVersion: 1,
    toEmail: email(n),
    toName: fullName(n),
    fromEmail: 'bonjour@femiglow-maroc.com',
    replyTo: 'support@femiglow-maroc.com',
    subject: 'Bienvenue dans votre rituel FemiGlow',
    payloadJson: { firstName: firstName(n), montantMad: 490 },
    htmlSnapshot: '<p>Bonjour, votre rituel vous attend.</p>',
    textSnapshot: 'Bonjour, votre rituel vous attend.',
    status: 'pending',
    attempts: 0,
    maxAttempts: 5,
    nextRetry: null,
    lastError: null,
    smtpMessageId: null,
    smtpResponse: null,
    queueId: null,
    scheduledFor: null,
    deliveredAt: null,
    bouncedAt: null,
    bounceReason: null,
    bounceType: null,
    source: 'transactional',
    createdByUserId: null,
    createdAt: ANCHOR,
    updatedAt: ANCHOR,
  } satisfies OutboxInsert;
  return { ...base, ...overrides };
}

// — email_event — — — — — — — — — — — — — — — — — — — — — — — — — — — — —

export function makeEmailEvent(overrides: Partial<EmailEventInsert> = {}): EmailEventInsert {
  const n = next();
  const base = {
    // id = bigserial (auto) → omis par défaut, surchargeable.
    outboxId: createId('out'),
    campaignId: null,
    subscriberId: null,
    type: 'delivered',
    ts: ANCHOR,
    source: 'stalwart',
    rawJson: { event: 'delivery.delivered', queueId: `q_${n}` },
    ip: null,
    userAgent: null,
    linkUrl: null,
  } satisfies EmailEventInsert;
  return { ...base, ...overrides };
}

// — email_automation — — — — — — — — — — — — — — — — — — — — — — — — — — —

export function makeEmailAutomation(
  overrides: Partial<AutomationInsert> = {},
): AutomationInsert {
  const n = next();
  const base = {
    id: createId('auto'),
    slug: `welcome-series-${n}`,
    name: 'Série de bienvenue rituel',
    triggerType: 'event',
    triggerConfig: { eventName: 'lead.created' },
    steps: [
      { kind: 'send', template: 'welcome-rituel', delaySeconds: 0 },
      { kind: 'wait', delaySeconds: 86400 },
      { kind: 'send', template: 'rituel-jour-2', delaySeconds: 0 },
    ],
    active: false,
    cooldownSeconds: 0,
    quietHoursEnabled: true,
    quietHoursStart: '08:00',
    quietHoursEnd: '22:00',
    quietHoursTz: 'Africa/Casablanca',
    dailyCap: null,
    triggerConditions: null,
    createdAt: ANCHOR,
    updatedAt: ANCHOR,
  } satisfies AutomationInsert;
  return { ...base, ...overrides };
}

// — email_automation_run — — — — — — — — — — — — — — — — — — — — — — — — —

export function makeAutomationRun(
  overrides: Partial<AutomationRunInsert> = {},
): AutomationRunInsert {
  const n = next();
  const base = {
    id: createId('run'),
    automationId: createId('auto'),
    recipientEmail: email(n),
    triggeredAt: ANCHOR,
    currentStep: 0,
    status: 'running',
    contextJson: { firstName: firstName(n), leadId: createId('l') },
    nextActionAt: null,
    finishedAt: null,
    outboxIds: [],
    awaitingEventName: null,
    awaitingUntil: null,
    erroredAt: null,
    erroredReason: null,
  } satisfies AutomationRunInsert;
  return { ...base, ...overrides };
}

// — email_audience — — — — — — — — — — — — — — — — — — — — — — — — — — — —

export function makeEmailAudience(overrides: Partial<AudienceInsert> = {}): AudienceInsert {
  const n = next();
  const base = {
    // id = uuid DEFAULT gen_random_uuid() → omis (généré DB), surchargeable.
    slug: `acheteuses-recentes-${n}`,
    name: 'Acheteuses récentes',
    description: 'Clientes ayant commandé le rituel dans les 30 derniers jours',
    rules: {
      op: 'and',
      conditions: [{ field: 'has_tag', value: 'acheteuse' }],
    },
    exclusionFlags: {
      hard_bounce: true,
      unsubscribe: true,
      manual_suppression: true,
      marketing_optout: false,
    },
    evaluationMode: 'dynamic',
    createdBy: 'admin_test',
    createdAt: ANCHOR,
    updatedAt: ANCHOR,
    deletedAt: null,
  } satisfies AudienceInsert;
  return { ...base, ...overrides };
}

// — email_audience_snapshot — — — — — — — — — — — — — — — — — — — — — — —

export function makeAudienceSnapshot(
  overrides: Partial<SnapshotInsert> = {},
): SnapshotInsert {
  const n = next();
  const purgeableAfter = new Date(ANCHOR.getTime() + 30 * 24 * 60 * 60 * 1000);
  const base = {
    // id = uuid DEFAULT → omis, surchargeable.
    audienceId: overrides.audienceId ?? createId('aud'),
    snapshotKey: `snap_${n}`,
    status: 'done',
    size: 3,
    rulesSnapshot: { op: 'and', conditions: [{ field: 'has_tag', value: 'acheteuse' }] },
    exclusionSnapshot: {
      hard_bounce: true,
      unsubscribe: true,
      manual_suppression: true,
      marketing_optout: false,
    },
    metadata: { builtBy: 'admin_test' },
    listmonkListId: 100 + n,
    listmonkListName: `Acheteuses récentes #${n}`,
    erroredAt: null,
    erroredReason: null,
    createdAt: ANCHOR,
    completedAt: ANCHOR,
    purgeableAfter,
  } satisfies SnapshotInsert;
  return { ...base, ...overrides };
}

// — email_audience_snapshot_member — — — — — — — — — — — — — — — — — — —

export function makeSnapshotMember(
  overrides: Partial<SnapshotMemberInsert> = {},
): SnapshotMemberInsert {
  const n = next();
  const base = {
    snapshotId: overrides.snapshotId ?? createId('snap'),
    email: email(n),
    payload: { firstName: firstName(n), phoneE164: phoneE164(n) },
  } satisfies SnapshotMemberInsert;
  return { ...base, ...overrides };
}

// — email_campaign_link — — — — — — — — — — — — — — — — — — — — — — — — —

export function makeCampaignLink(overrides: Partial<CampaignLinkInsert> = {}): CampaignLinkInsert {
  const n = next();
  const base = {
    id: createId('camp'),
    listmonkCampaignId: 200 + n,
    status: 'draft',
    name: `Newsletter rituel #${n}`,
    subject: 'Votre rituel beauté du mois',
    preheader: 'Des conseils pour une peau lumineuse',
    templateSlug: null,
    audienceLinkIds: [],
    payloadJson: { promoMad: 90 },
    scheduledFor: null,
    startedAt: null,
    finishedAt: null,
    sentCount: 0,
    deliveredCount: 0,
    openCount: 0,
    clickCount: 0,
    bounceCount: 0,
    unsubscribeCount: 0,
    abVariant: null,
    createdByUserId: 'admin_test',
    audienceId: null,
    snapshotId: null,
    snapshotListmonkListId: null,
    createdAt: ANCHOR,
    updatedAt: ANCHOR,
  } satisfies CampaignLinkInsert;
  return { ...base, ...overrides };
}

// — email_subscriber_link — — — — — — — — — — — — — — — — — — — — — — — —

export function makeSubscriberLink(
  overrides: Partial<SubscriberLinkInsert> = {},
): SubscriberLinkInsert {
  const n = next();
  const base = {
    email: email(n, 'abonnee'),
    listmonkSubscriberId: 300 + n,
    userId: null,
    firstName: firstName(n),
    consentAt: ANCHOR,
    consentSource: 'rituel-page',
    doubleOptinConfirmedAt: ANCHOR,
    unsubscribedAt: null,
    status: 'enabled',
    createdAt: ANCHOR,
    syncedAt: ANCHOR,
  } satisfies SubscriberLinkInsert;
  return { ...base, ...overrides };
}

// — email_suppression — — — — — — — — — — — — — — — — — — — — — — — — — —

export function makeSuppression(overrides: Partial<SuppressionInsert> = {}): SuppressionInsert {
  const n = next();
  const base = {
    email: email(n, 'supprimee'),
    reason: 'hard_bounce',
    detail: 'listmonk:permanent',
    since: ANCHOR,
    source: 'listmonk',
  } satisfies SuppressionInsert;
  return { ...base, ...overrides };
}

// — email_template_custom — — — — — — — — — — — — — — — — — — — — — — — —

export function makeTemplateCustom(
  overrides: Partial<TemplateCustomInsert> = {},
): TemplateCustomInsert {
  const n = next();
  const base = {
    // id = uuid DEFAULT → omis, surchargeable.
    slug: `promo-printemps-${n}`,
    name: 'Promo printemps',
    description: 'Template campagne saisonnière rituel',
    subjectTmpl: 'Bonjour {{ .firstName }}, -{{ .promoMad }} MAD sur votre rituel',
    preheaderTmpl: 'Offre limitée — profitez-en',
    htmlSource: '<html><body><p>Bonjour {{ .firstName }}</p></body></html>',
    customVars: { promoMad: '90', firstName: 'Kaoutar' },
    activeVersionId: null,
    createdBy: 'admin_test',
    createdAt: ANCHOR,
    updatedAt: ANCHOR,
    deletedAt: null,
  } satisfies TemplateCustomInsert;
  return { ...base, ...overrides };
}

// — email_template_custom_version — — — — — — — — — — — — — — — — — — — —

export function makeTemplateCustomVersion(
  overrides: Partial<TemplateCustomVersionInsert> = {},
): TemplateCustomVersionInsert {
  const n = next();
  const base = {
    // id = uuid DEFAULT → omis, surchargeable.
    templateId: overrides.templateId ?? createId('tpl'),
    versionNumber: 1,
    subjectTmpl: 'Bonjour {{ .firstName }}, -{{ .promoMad }} MAD sur votre rituel',
    preheaderTmpl: 'Offre limitée — profitez-en',
    htmlSource: '<html><body><p>Bonjour {{ .firstName }}</p></body></html>',
    customVars: { promoMad: '90', firstName: 'Kaoutar' },
    commitMessage: `Version initiale #${n}`,
    createdBy: 'admin_test',
    createdAt: ANCHOR,
  } satisfies TemplateCustomVersionInsert;
  return { ...base, ...overrides };
}

// — lead_tag (M5.5) — — — — — — — — — — — — — — — — — — — — — — — — — — —
// Bonus utile pour les audiences has_tag/not_has_tag.

export function makeLeadTag(overrides: Partial<LeadTagInsert> = {}): LeadTagInsert {
  const base = {
    // DRIFT FIX (chantier 1.1) — `lead_tag.id` est un `uuid` côté DB. On génère
    // un vrai uuid (et non `createId('tag')`) pour rester insertable en base.
    id: randomUUID(),
    leadId: overrides.leadId ?? createId('l'),
    tag: 'acheteuse',
    source: 'automation',
    sourceRef: createId('auto'),
    createdAt: ANCHOR,
  } satisfies LeadTagInsert;
  return { ...base, ...overrides };
}

// — Webhook payloads — — — — — — — — — — — — — — — — — — — — — — — — — — —
// Formats lus dans src/lib/mail/webhooks/** (Zod permissifs `.passthrough()`).

/**
 * Types de payloads webhook Stalwart supportés par le factory.
 * Correspond aux events que le parser consomme (cf. stalwart-parser.ts).
 */
export type StalwartEventKind =
  | 'queue.authenticated-message-queued'
  | 'queue.message-queued'
  | 'delivery.delivered'
  | 'delivery.failed'
  | 'queue.rescheduled'
  | 'auth.failed';

export interface StalwartEventOptions {
  event?: StalwartEventKind;
  queueId?: string;
  messageId?: string;
  /** Pour delivery.* : destinataire(s). */
  rcpt?: string | string[];
  /** Pour delivery.failed : code SMTP (>=500 = hard bounce). */
  errorCode?: number;
  reason?: string;
  /** Pour queue.rescheduled : prochain essai. */
  nextRetry?: string;
  /** Pour auth.failed. */
  user?: string;
  ip?: string;
  ts?: string;
  /** Champs additionnels libres (passthrough). */
  [extra: string]: unknown;
}

/**
 * Construit un payload webhook Stalwart réaliste.
 * Par défaut : `delivery.delivered`. Les champs non pertinents pour l'event
 * choisi sont laissés tels quels (les schemas Zod sont `.passthrough()`).
 */
export function makeStalwartEvent(
  overrides: StalwartEventOptions = {},
): Record<string, unknown> {
  const n = next();
  const { event = 'delivery.delivered', ...rest } = overrides;
  const base: Record<string, unknown> = {
    event,
    queueId: `q_${n}`,
    messageId: `<msg-${n}@femiglow-maroc.com>`,
    ts: ANCHOR.toISOString(),
  };

  switch (event) {
    case 'delivery.delivered':
      base.rcpt = email(n);
      break;
    case 'delivery.failed':
      base.rcpt = email(n);
      base.errorCode = 550;
      base.reason = 'Mailbox does not exist';
      break;
    case 'queue.rescheduled':
      base.nextRetry = new Date(ANCHOR.getTime() + 15 * 60 * 1000).toISOString();
      break;
    case 'auth.failed':
      delete base.queueId;
      delete base.messageId;
      base.user = 'bonjour@femiglow-maroc.com';
      base.ip = '41.249.0.1';
      break;
    case 'queue.authenticated-message-queued':
    case 'queue.message-queued':
    default:
      break;
  }

  return { ...base, ...rest };
}

/**
 * Types de payloads webhook Listmonk supportés par le factory.
 * Correspond aux events que le parser/dispatcher consomme.
 */
export type ListmonkEventKind =
  | 'subscriber.created'
  | 'subscriber.updated'
  | 'subscriber.unsubscribed'
  | 'subscriber.bounced'
  | 'subscriber.complained'
  | 'campaign.started'
  | 'campaign.completed';

export interface ListmonkEventOptions {
  event?: ListmonkEventKind;
  /** Override complet du champ `data`. */
  data?: Record<string, unknown>;
  /** Email du subscriber concerné (placé dans data). */
  subscriberEmail?: string;
  /** Id listmonk de la campagne (placé dans data pour campaign.*). */
  campaignId?: number;
  ts?: number;
  [extra: string]: unknown;
}

/**
 * Construit un payload webhook Listmonk réaliste.
 * Shape : `{ event, source: 'listmonk', ts: <unix>, data: {...} }`.
 * Par défaut : `subscriber.unsubscribed`.
 */
export function makeListmonkEvent(
  overrides: ListmonkEventOptions = {},
): Record<string, unknown> {
  const n = next();
  const {
    event = 'subscriber.unsubscribed',
    data: dataOverride,
    subscriberEmail,
    campaignId,
    ...rest
  } = overrides;
  const subEmail = subscriberEmail ?? email(n, 'abonnee');
  const lmCampaignId = campaignId ?? 200 + n;

  let data: Record<string, unknown>;
  switch (event) {
    case 'subscriber.created':
      data = { id: 300 + n, email: subEmail, name: fullName(n), status: 'enabled' };
      break;
    case 'subscriber.updated':
      data = { id: 300 + n, email: subEmail, name: fullName(n), status: 'enabled' };
      break;
    case 'subscriber.unsubscribed':
      data = { subscriber: { id: 300 + n, email: subEmail }, campaign_id: lmCampaignId };
      break;
    case 'subscriber.bounced':
      data = {
        subscriber: { id: 300 + n, email: subEmail },
        bounce_type: 'hard',
        source: 'listmonk',
      };
      break;
    case 'subscriber.complained':
      data = { subscriber: { id: 300 + n, email: subEmail } };
      break;
    case 'campaign.started':
      data = { id: lmCampaignId, name: `Newsletter rituel #${n}` };
      break;
    case 'campaign.completed':
      data = {
        id: lmCampaignId,
        name: `Newsletter rituel #${n}`,
        sent: 100,
        views: 42,
        clicks: 12,
        bounces: 3,
      };
      break;
    default:
      data = {};
  }

  return {
    event,
    source: 'listmonk',
    ts: Math.floor(ANCHOR.getTime() / 1000),
    data: dataOverride ?? data,
    ...rest,
  };
}

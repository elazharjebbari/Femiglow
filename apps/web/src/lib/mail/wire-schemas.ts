/**
 * Contrats de réponse « wire » (format JSON sérialisé) des endpoints emails
 * admin — P0.2 du programme emails-ux (gate G9 : conformité des contrats).
 *
 * UNE SEULE source de vérité de forme, consommée par TROIS couches :
 *   1. les routes (les types TS des libs restent maîtres — des assertions de
 *      compatibilité bidirectionnelles en bas de fichier cassent à la compile
 *      si un type de lib diverge de son schéma wire) ;
 *   2. les handlers MSW (`@/test/msw/emails-handlers`) — le test de conformité
 *      `src/test/msw/emails-contracts.conformity.test.ts` force chaque réponse
 *      mockée à parser ici : un mock qui dérive du réel casse en CI ;
 *   3. les futurs tests d'intégration (la réponse RÉELLE de la route doit
 *      parser avec le MÊME schéma — F02..F10).
 *
 * « Wire » ≠ types DB : les `Date` sont des chaînes ISO après JSON.stringify,
 * d'où `z.string()` sur createdAt/deliveredAt/since (+ garde datetime souple :
 * on valide la PRÉSENCE et le type, pas le calendrier).
 */
import { z } from 'zod';
import type { SearchResult } from '@/lib/mail/transactional/search';
import type { SummaryResult } from '@/lib/mail/transactional/summary';
import type { BulkRetryResult, BulkSuppressResult } from '@/lib/mail/transactional/bulk-actions';

// ── Statuts outbox (miroir de l'enum pgEnum email_outbox_status) ────────────
export const OUTBOX_STATUS_WIRE = [
  'pending',
  'sending',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'failed',
  'bounced_soft',
  'bounced_permanent',
  'suppressed',
  'dlq',
] as const;

// ── POST /api/admin/emails/transactional/search ────────────────────────────
export const OutboxSearchRowWire = z.object({
  id: z.string(),
  template: z.string(),
  toEmail: z.string(),
  toName: z.string().nullable(),
  subject: z.string(),
  status: z.enum(OUTBOX_STATUS_WIRE),
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  lastError: z.string().nullable(),
  source: z.string().nullable(),
  createdAt: z.string(),
  deliveredAt: z.string().nullable(),
  bounceType: z.enum(['soft', 'hard']).nullable(),
});

export const SearchResponseWire = z.object({
  rows: z.array(OutboxSearchRowWire),
  total: z.number().int().min(0),
  window: z.enum(['matched', 'truncated']),
});

// ── GET /api/admin/emails/transactional/summary ────────────────────────────
export const SummaryResponseWire = z.object({
  window: z.enum(['1h', '24h', '7d', '30d']),
  delivered: z.number().int().min(0),
  queued: z.number().int().min(0),
  failed: z.number().int().min(0),
  hardBounced: z.number().int().min(0),
  // F03 : base du tri-état livraison + pourcentage « des envoyés ».
  sent: z.number().int().min(0),
  // F03 : iso du dernier event delivered reçu (null = webhook jamais armé).
  webhookLastSuccessAt: z.string().datetime().nullable(),
  sparkline: z.array(z.object({ delivered: z.number(), failed: z.number() })),
  comparison: z
    .object({ deliveredPct: z.number(), failedPct: z.number() })
    .optional(),
});

// ── POST /api/admin/emails/transactional/bulk-retry ────────────────────────
export const BulkRetryResponseWire = z.object({
  retried: z.number().int().min(0),
  skipped: z.number().int().min(0),
  skippedIds: z.array(
    z.object({ id: z.string(), reason: z.enum(['not_found', 'wrong_status']) }),
  ),
});

// ── POST /api/admin/emails/transactional/bulk-retry-by-filter (F04 P2.3) ───
export const BulkRetryByFilterDryWire = z.object({
  /** Nombre d'emails ÉLIGIBLES (borné côté serveur — jamais de COUNT plein). */
  count: z.number().int().min(0),
});
export const BulkRetryByFilterExecWire = z.object({
  retried: z.number().int().min(0),
  skipped: z.array(
    z.object({ reason: z.enum(['wrong_status']), count: z.number().int().min(1) }),
  ),
});
export const BulkRetryByFilterCapWire = z.object({
  error: z.literal('cap_exceeded'),
  count: z.number().int().min(0),
  cap: z.number().int(),
});

// ── POST /api/admin/emails/transactional/bulk-suppress ─────────────────────
export const BulkSuppressResponseWire = z.object({
  suppressed: z.number().int().min(0),
  skipped: z.number().int().min(0),
});

// ── POST /api/admin/emails/transactional/reap-stuck ────────────────────────
export const ReapStuckResponseWire = z.object({
  reaped: z.number().int().min(0),
});

// ── GET /api/admin/emails/suppression ──────────────────────────────────────
export const SuppressionItemWire = z.object({
  email: z.string(),
  reason: z.enum([
    'hard_bounce',
    'soft_bounce_repeated',
    'complaint',
    'unsubscribe',
    'manual_admin',
    'cndp_request',
    'invalid_format',
  ]),
  detail: z.string().nullable(),
  since: z.string(),
  source: z.enum(['stalwart', 'listmonk', 'manual', 'cndp']),
});

export const SuppressionListResponseWire = z.object({
  rows: z.array(SuppressionItemWire),
  total: z.number().int().min(0),
  limit: z.number().int().min(1),
  offset: z.number().int().min(0),
});

// ── DELETE /api/admin/emails/suppression ───────────────────────────────────
export const SuppressionRemoveResponseWire = z.object({
  removed: z.boolean(),
});

// ── GET /api/admin/emails/nav-counters (route livrée en F02/P1.4) ───────────
// Compteurs des badges d'onglets. Noms ALIGNÉS sur la spec
// F02-navigation/02-spec-technique.yaml (qui supersède la première ébauche
// P0.2 : automationErrored→automationErrors, syncFailing→listmonkSyncFailed).
export const NavCountersResponseWire = z.object({
  /** Emails en DLQ (cockpit, statut dlq). */
  dlq: z.number().int().min(0),
  /** Runs d'automation en erreur. */
  automationErrors: z.number().int().min(0),
  /** Campagnes dont la dernière sync Listmonk est en échec (0 tant que F10 n'a pas livré les colonnes). */
  listmonkSyncFailed: z.number().int().min(0),
  /** Horodatage ISO du calcul (cache TTL 30 s côté serveur). */
  generatedAt: z.string().datetime(),
});

/** Alias nommé par la spec F02. */
export const navCountersSchema = NavCountersResponseWire;
export type NavCounters = z.infer<typeof navCountersSchema>;

// ── Assertions de compatibilité TS ↔ wire (compile-time, zéro runtime) ──────
// Si un type de lib évolue sans son schéma wire (ou inversement), tsc casse
// ICI, avant tout test. NB : les champs Date (wire string) sont exclus des
// assertions directes — ils divergent PAR CONSTRUCTION (sérialisation JSON).
type AssertExtends<A extends B, B> = true;

type _BulkRetryOk = AssertExtends<BulkRetryResult, z.infer<typeof BulkRetryResponseWire>>;
type _BulkRetryBack = AssertExtends<z.infer<typeof BulkRetryResponseWire>, BulkRetryResult>;
type _BulkSuppressOk = AssertExtends<BulkSuppressResult, z.infer<typeof BulkSuppressResponseWire>>;
type _SummaryOk = AssertExtends<SummaryResult, z.infer<typeof SummaryResponseWire>>;
type _SearchTotalOk = AssertExtends<SearchResult['total'], number>;
type _SearchWindowOk = AssertExtends<
  SearchResult['window'],
  z.infer<typeof SearchResponseWire>['window']
>;

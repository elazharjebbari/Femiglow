import { z } from 'zod';

/**
 * Schemas Zod pour le système GTM Poka-Yoke.
 * cf. docs/gtm-poka-yoke/20-data/01-data-model.md
 */

export const BUNDLE_ID_PATTERN = /^[a-f0-9]{12}$/;
export const GTM_CONTAINER_PATTERN = /^GTM-[A-Z0-9]{4,}$/;

export const SentinelPingInputSchema = z
  .object({
    bundleId: z.string().regex(BUNDLE_ID_PATTERN, 'invalid bundleId format'),
    mappingVersion: z.string().min(1).max(64),
    configVersion: z.string().min(1).max(64),
    containerId: z.string().regex(GTM_CONTAINER_PATTERN, 'invalid GTM container id'),
    gtmId: z.string().regex(GTM_CONTAINER_PATTERN).optional(),
    sentAt: z.string().datetime({ offset: true }),
    manifestMismatch: z.boolean().optional().default(false),
    manifestMismatchDetails: z.string().max(512).nullish(),
  })
  .strict();

export type SentinelPingInput = z.infer<typeof SentinelPingInputSchema>;

export const DriftStatusSchema = z.enum(['ok', 'warning', 'critical']);
export type DriftStatusEnum = z.infer<typeof DriftStatusSchema>;

export const DriftReasonSchema = z.discriminatedUnion('code', [
  z.object({
    code: z.literal('bundle_mismatch'),
    expected: z.string(),
    got: z.string(),
  }),
  z.object({
    code: z.literal('mapping_version_drift'),
    expected: z.string(),
    got: z.string(),
  }),
  z.object({
    code: z.literal('config_version_drift'),
    expected: z.string(),
    got: z.string(),
  }),
  z.object({
    code: z.literal('container_id_mismatch'),
    expected: z.string(),
    got: z.string(),
  }),
  z.object({
    code: z.literal('silence_excess'),
    lastPingAt: z.string().datetime().nullable(),
    thresholdHours: z.number(),
  }),
  z.object({
    code: z.literal('manifest_flag_mismatch'),
    details: z.string(),
  }),
]);

export type DriftReason = z.infer<typeof DriftReasonSchema>;

export const ValidatePairInputSchema = z
  .object({
    configJson: z.unknown().refine((v) => v !== undefined, 'configJson is required'),
    mappingJson: z.unknown().refine((v) => v !== undefined, 'mappingJson is required'),
  })
  .strict();

export type ValidatePairInput = z.infer<typeof ValidatePairInputSchema>;

export const ValidationIssueSchema = z.object({
  code: z.string(),
  severity: z.enum(['error', 'warning']),
  message: z.string(),
  fix: z.string(),
  reference: z
    .object({
      path: z.string(),
      line: z.number().optional(),
    })
    .optional(),
});

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const RecommendationSchema = z.object({
  order: z.number(),
  action: z.string(),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

export const PairValidationResultSchema = z.object({
  ok: z.boolean(),
  bundleId: z.object({
    config: z.string().nullable(),
    mapping: z.string().nullable(),
    match: z.boolean(),
  }),
  errors: z.array(ValidationIssueSchema),
  warnings: z.array(ValidationIssueSchema),
  recommendations: z.array(RecommendationSchema),
});

export type PairValidationResult = z.infer<typeof PairValidationResultSchema>;

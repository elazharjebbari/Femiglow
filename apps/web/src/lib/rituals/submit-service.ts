import type { RitualTestimonialSubmit } from '@/lib/schemas/rituals';
import {
  insertRitual,
  insertAuditEvent,
  insertPhoto,
} from '@/lib/db/queries/rituals';
import { sanitizeBody } from './sanitize-body';
import { detectAutoFlags } from './auto-flags';
import { decodeEmailToken } from './email-tokens';
import { duplicateFlags, findSimilar } from './duplicate-detection';
import { memoryStore, db, schema } from '@/lib/db/client';
import type { RitualSource, RitualTestimonial } from '@/lib/db/types';
import { inArray } from 'drizzle-orm';

/**
 * Orchestration de la soumission d'un rituel.
 * Cf. docs/reviews-wall/execution/04-backend-plan-action.md § 7.2-7.3
 */

export interface SubmitContext {
  ip?: string;
  source?: RitualSource;
}

export interface SubmitResult {
  publicSlug: string;
  status: RitualTestimonial['status'];
  estimatedPublishHours: number;
}

/**
 * Compare le body contre les rituels APPROVED/PENDING de ce produit
 * et retourne les flags de doublon à appliquer (`duplicate_strict`,
 * `duplicate_loose`).
 *
 * Limité aux 500 rituels les plus récents pour éviter un O(n) catastrophique.
 */
async function detectDuplicateFlags(body: string, productKey: string): Promise<string[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = (await drizzle
      .select({ id: schema.ritualTestimonials.id, body: schema.ritualTestimonials.body })
      .from(schema.ritualTestimonials)
      .where(inArray(schema.ritualTestimonials.status, ['APPROVED', 'PENDING']))
      .limit(500)) as Array<{ id: string; body: string }>;
    const matches = findSimilar(
      body,
      rows.filter((r) => r.body && r.body.length > 0),
      0.7,
    );
    return duplicateFlags(matches);
  }
  const store = memoryStore();
  const candidates = Array.from(store.ritualTestimonials.values())
    .filter(
      (r) =>
        r.productKey === productKey &&
        (r.status === 'APPROVED' || r.status === 'PENDING'),
    )
    .map((r) => ({ id: r.id, body: r.body }));
  return duplicateFlags(findSimilar(body, candidates, 0.7));
}

export async function submitRitual(
  input: RitualTestimonialSubmit,
  ctx: SubmitContext = {},
): Promise<SubmitResult> {
  // 1. Sanitization du body
  const { sanitized, flags: emojiFlags } = sanitizeBody(input.body);

  // 2. Auto-flags + détection doublons
  const otherFlags = detectAutoFlags(sanitized);
  const dupFlags = await detectDuplicateFlags(sanitized, input.productKey);
  const autoFlags = Array.from(
    new Set([...emojiFlags, ...otherFlags, ...dupFlags]),
  );

  // 3. Décodage email token (si présent)
  let customerHash: string | null = null;
  let orderId: string | null = null;
  let verifiedPurchase = false;
  if (input.emailToken) {
    try {
      const decoded = decodeEmailToken(input.emailToken);
      customerHash = decoded.customerHash;
      orderId = decoded.orderId;
      verifiedPurchase = true;
    } catch {
      // Token invalide ou expiré → on n'arrête pas, mais on ne marque pas verified
    }
  }

  // 4. Source : web par défaut, email_j45 si token valide, sinon param ctx
  const source: RitualSource = verifiedPurchase
    ? 'email_j45'
    : ctx.source ?? 'web';

  // 5. Insertion en PENDING
  const ritual = await insertRitual({
    productKey: input.productKey,
    body: sanitized,
    bodyOriginal: input.body,
    wouldRecommend: input.wouldRecommend,
    ritualTags: input.ritualTags,
    authorFirstName: input.authorFirstName,
    authorCity: input.authorCity,
    initiatedSince: input.initiatedSince,
    isAnonymous: input.isAnonymous,
    language: input.language,
    source,
    customerHash,
    orderId,
    verifiedPurchase,
    autoFlags,
    status: 'PENDING',
  });

  // 6. Photos : insertion en MANUAL_REVIEW pour modération humaine.
  //    Le pipeline upload a fait un check vision ML sync, mais on relit
  //    ici en sécurité : tout passe par la modération admin avant publish.
  for (let i = 0; i < input.photos.length; i++) {
    const p = input.photos[i]!;
    await insertPhoto({
      testimonialId: ritual.id,
      url: p.url ?? p.blobKey,
      thumbUrl: p.thumbUrl ?? p.blobKey,
      width: p.width,
      height: p.height,
      byteSize: p.byteSize,
      mime: p.mime,
      position: i,
      facesStatus: 'MANUAL_REVIEW',
    });
  }

  // 7. Audit log
  await insertAuditEvent({
    testimonialId: ritual.id,
    actorId: null,
    action: 'created',
    payload: {
      source,
      autoFlags,
      photoCount: input.photos.length,
      ip: ctx.ip ?? null,
      hasEmailToken: !!input.emailToken && verifiedPurchase,
    },
  });

  return {
    publicSlug: ritual.publicSlug,
    status: ritual.status,
    estimatedPublishHours: 48,
  };
}

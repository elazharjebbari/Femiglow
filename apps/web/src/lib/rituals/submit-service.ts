import type { RitualTestimonialSubmit } from '@/lib/schemas/rituals';
import {
  insertRitual,
  insertAuditEvent,
  insertPhoto,
} from '@/lib/db/queries/rituals';
import { sanitizeBody } from './sanitize-body';
import { detectAutoFlags } from './auto-flags';
import { decodeEmailToken } from './email-tokens';
import type { RitualSource, RitualTestimonial } from '@/lib/db/types';

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

export async function submitRitual(
  input: RitualTestimonialSubmit,
  ctx: SubmitContext = {},
): Promise<SubmitResult> {
  // 1. Sanitization du body
  const { sanitized, flags: emojiFlags } = sanitizeBody(input.body);

  // 2. Auto-flags
  const otherFlags = detectAutoFlags(sanitized);
  const autoFlags = Array.from(new Set([...emojiFlags, ...otherFlags]));

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

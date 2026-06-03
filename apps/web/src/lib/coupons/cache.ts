/**
 * Tags de cache pour les coupons.
 *
 * La DÉFINITION des coupons est cachée (tag `coupons`) et invalidée par
 * `revalidateTag(COUPONS_TAG)` à chaque mutation admin. La DÉCISION de
 * bucket (dépend du cookie visiteur) n'est JAMAIS cachée — elle est
 * recalculée à chaque requête par une fonction pure après lecture.
 *
 * La validité (fenêtre startsAt/endsAt) est ré-évaluée avec `ctx.now` à
 * chaque résolution → un coupon expiré n'est jamais servi par un cache figé.
 *
 * cf. docs/coupons-qa-2026-06-02/18-cache-invalidation/.
 */
export const COUPONS_TAG = 'coupons';

export const couponTag = (id: string): string => `coupon:${id}`;

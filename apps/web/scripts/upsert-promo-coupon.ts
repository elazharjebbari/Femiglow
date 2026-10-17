/**
 * Upsert idempotent d'un CODE PROMO marketing (`coupons.mode='code'`).
 *
 * Ex. campagne Meta « PROMO99 » : 199 → 99 MAD avec le code GLOW99.
 *
 *   pnpm seed:promo-coupon -- --code GLOW99 --amount 10000 \
 *     --label "Promo Meta — 99 MAD" --ends 2026-09-30T23:59:59+01:00 --cap 500
 *
 * Options :
 *   --code    (requis)  code affiché dans la publicité, stocké en MAJUSCULES
 *   --amount  (requis)  remise en CENTIMES sur le prix produit (10000 = 100 MAD)
 *   --label             libellé admin (défaut « Code promo <CODE> »)
 *   --starts            ISO 8601, début de validité (défaut : immédiat)
 *   --ends              ISO 8601, fin de validité (défaut : illimité)
 *   --cap               plafond global d'utilisations (défaut : illimité)
 *   --status            active | paused | draft (défaut active)
 *   --dry               n'écrit rien, affiche le payload
 *
 * Idempotent par code : s'il existe, met à jour montant / fenêtre / plafond /
 * statut / libellé. Le compteur d'usage n'est jamais remis à zéro.
 * Le code se cumule avec le geste d'accueil (289 → 199 → 199 − remise).
 */
/* eslint-disable no-console -- script CLI : la sortie console est l'interface */
import { createCoupon, findCouponByCode, updateCoupon } from '@/lib/db/queries/coupon-repo';
import { couponInputSchema } from '@/lib/coupons/schemas';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : 'true';
}

async function main(): Promise<void> {
  const code = (arg('code') ?? '').trim().toUpperCase();
  const amount = Number(arg('amount'));
  if (!code || !Number.isInteger(amount) || amount <= 0) {
    console.error('Usage : --code GLOW99 --amount 10000 [--label …] [--starts ISO] [--ends ISO] [--cap N] [--status active|paused|draft] [--dry]');
    process.exit(1);
  }
  const label = arg('label') ?? `Code promo ${code}`;
  // Dates : on accepte tout ISO 8601 (avec fuseau, ex. +01:00) et on passe des
  // `Date` au schéma (z.string().datetime() n'accepte que le suffixe Z).
  const toDate = (v: string | undefined, name: string): Date | null => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      console.error(`--${name} : date invalide « ${v} » (attendu ISO 8601, ex. 2026-09-30T23:59:59+01:00)`);
      process.exit(1);
    }
    return d;
  };
  const starts = toDate(arg('starts'), 'starts');
  const ends = toDate(arg('ends'), 'ends');
  const cap = arg('cap') ? Number(arg('cap')) : null;
  const status = (arg('status') ?? 'active') as 'active' | 'paused' | 'draft';
  const dry = arg('dry') === 'true';

  const input = couponInputSchema.parse({
    label,
    code,
    type: 'manual_code',
    mode: 'code',
    status,
    valueKind: 'fixed_amount',
    valueAmount: amount,
    target: 'product_price',
    currency: 'MAD',
    eligibility: {},
    startsAt: starts,
    endsAt: ends,
    // Le code promo se cumule avec le geste d'accueil (circuit « crédit »).
    stackable: true,
    usageScope: cap ? 'global_cap' : 'unlimited',
    usageCap: cap,
    holdoutPct: 0,
    priority: 10,
  });

  console.log(JSON.stringify({ ...input, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null }, null, 2));
  if (dry) return;

  const existing = await findCouponByCode(code);
  if (existing) {
    const updated = await updateCoupon(existing.id, {
      label: input.label,
      status: input.status,
      valueKind: input.valueKind,
      valueAmount: input.valueAmount,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      usageScope: input.usageScope,
      usageCap: input.usageCap ?? null,
      stackable: input.stackable,
      priority: input.priority,
    });
    console.log(`Mis à jour : ${updated?.id} (${code}) — usages : ${updated?.usageCount ?? 0}`);
    return;
  }
  const created = await createCoupon(input, null);
  console.log(`Créé : ${created.id} (${code})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

/**
 * Seed déterministe pour les E2E fidélité (W5 du dossier coupon-loyalty-qa-ui).
 *
 * Garantit :
 *   1. un template `post_purchase` ACTIF (valeur 2000c) → l'émission de code
 *      fonctionne à la création de commande (F17) ;
 *   2. un grant PRÉ-ACTIVÉ à code FIXE `FG-E2E-0001` (activatesAt = hier,
 *      expiresAt = +59j) sur un téléphone de test → la redemption (F18) voit
 *      un code valide tout de suite (contourne le délai d'activation).
 *
 * Idempotent (upsert par code). Usage :
 *   cd apps/web && node --env-file=.env --import tsx scripts/seed-e2e-loyalty.ts
 */
/* eslint-disable no-console -- script ops/CI : sortie console volontaire. */
import postgres from 'postgres';
import { listCoupons, createCoupon, setCouponStatus } from '@/lib/db/queries/coupon-repo';
import {
  E2E_LOYALTY_CODE,
  E2E_LOYALTY_PHONE,
  E2E_LOYALTY_VALUE_CENTS,
} from './loyalty-e2e-fixtures';

async function ensureActiveTemplate(): Promise<void> {
  const existing = await listCoupons({ type: 'post_purchase' });
  let tpl = existing[0];
  if (!tpl) {
    tpl = await createCoupon({
      label: 'Crédit fidélité (E2E)', type: 'post_purchase', mode: 'auto', status: 'active',
      valueKind: 'fixed_amount', valueAmount: E2E_LOYALTY_VALUE_CENTS,
      target: 'future_credit', currency: 'MAD',
    } as never);
  }
  if (tpl.status !== 'active') {
    await setCouponStatus(tpl.id, 'active');
  }
  console.log(`TEMPLATE ${tpl.code ?? tpl.id} status=active value=${tpl.valueAmount}`);
}

async function upsertActivatedGrant(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('NO_DATABASE_URL — grant fixe non semé (mode mémoire).');
    return;
  }
  const sql = postgres(url);
  const now = Date.now();
  const activatesAt = new Date(now - 24 * 3600 * 1000); // hier → actif
  const expiresAt = new Date(activatesAt.getTime() + 60 * 24 * 3600 * 1000);
  const id = `grt_e2e_fixed`;
  await sql`
    insert into coupon_grants
      (id, template_coupon_id, code, lead_id, source_order_id, status, value_cents,
       currency, redeemed_order_id, phone_e164, activates_at, expires_at, created_at, redeemed_at)
    values
      (${id}, null, ${E2E_LOYALTY_CODE}, null, null, 'issued', ${E2E_LOYALTY_VALUE_CENTS},
       'MAD', null, ${E2E_LOYALTY_PHONE}, ${activatesAt}, ${expiresAt}, now(), null)
    on conflict (code) do update set
      status = 'issued', redeemed_order_id = null, redeemed_at = null,
      activates_at = ${activatesAt}, expires_at = ${expiresAt}`;
  console.log(`GRANT ${E2E_LOYALTY_CODE} status=issued activatesAt=${activatesAt.toISOString().slice(0, 10)} (actif)`);
  await sql.end();
}

/**
 * Garde-fou PROD : ce seed insère un grant de TEST (FG-E2E-0001). Il ne doit
 * JAMAIS tourner en production. Bloqué si NODE_ENV=production (override explicite
 * `ALLOW_E2E_SEED=true` pour les rares cas légitimes). En CI, NODE_ENV n'est pas
 * `production` → le seed E2E reste autorisé.
 */
function assertNotProduction(): void {
  const env = process.env.NODE_ENV ?? 'development';
  const allow = process.env.ALLOW_E2E_SEED === 'true';
  if (env === 'production' && !allow) {
    console.error(
      '[seed-e2e-loyalty] ❌ Interdit en production (NODE_ENV=production). ' +
        'Ce seed est réservé aux tests E2E. Pose ALLOW_E2E_SEED=true pour forcer (déconseillé).',
    );
    process.exit(1);
  }
}

async function main() {
  assertNotProduction();
  await ensureActiveTemplate();
  await upsertActivatedGrant();
  console.log('SEED_E2E_LOYALTY_OK');
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1); });

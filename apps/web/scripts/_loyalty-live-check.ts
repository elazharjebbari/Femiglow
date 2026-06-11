/** Vérif live de la boucle code de fidélité contre la vraie DB. Usage ops. */
import postgres from 'postgres';
import { listCoupons } from '@/lib/db/queries/coupon-repo';
import { issueGrant, validateGrant } from '@/lib/db/queries/coupon-grant-repo';
import { computeActivatesAt } from '@/lib/coupons/delivery-delay';

async function main() {
  const phone = '+212612345699'; // numéro de test dédié
  const sql = postgres(process.env.DATABASE_URL!);

  // Nettoyage d'un éventuel grant de test précédent sur ce téléphone.
  await sql`delete from coupon_grants where phone_e164 = ${phone}`;

  // 1) Template post_purchase actif
  const tpl = (await listCoupons({ type: 'post_purchase', status: 'active' }))[0];
  if (!tpl) { console.log('NO_TEMPLATE'); await sql.end(); return; }
  console.log(`TEMPLATE=${tpl.code} value=${tpl.valueAmount}`);

  // 2) Deux vraies commandes existantes SANS grant (FK satisfaite)
  const orders = await sql<{ id: string }[]>`
    select o.id from orders o
    left join coupon_grants g on g.source_order_id = o.id
    where g.id is null
    order by o.created_at desc limit 2`;
  if (orders.length < 2) { console.log('NOT_ENOUGH_ORDERS', orders.length); await sql.end(); return; }
  const [orderA, orderB] = orders;
  console.log(`ORDER_A=${orderA.id} ORDER_B=${orderB.id}`);

  const now = new Date();
  const activatesAt = computeActivatesAt(now, '48 à 72 h'); // Casablanca ~3j + buffer

  // 3) Émission code mémorable sur commande A
  const g1 = await issueGrant({
    templateCouponId: tpl.id, leadId: null, sourceOrderId: orderA.id,
    valueCents: tpl.valueAmount, phoneE164: phone, activatesAt,
  });
  console.log(`CODE=${g1?.code}`);
  console.log(`MEMORABLE=${/^FG-[A-Z]+-\d{4}$/.test(g1?.code ?? '')}`);
  console.log(`ACTIVATES_AT=${g1?.activatesAt?.toISOString().slice(0, 10)} (commande ${now.toISOString().slice(0, 10)})`);
  console.log(`EXPIRES_AT=${g1?.expiresAt?.toISOString().slice(0, 10)}`);

  // 4) Unicité téléphone : 2e commande, même téléphone => même code réutilisé
  const g2 = await issueGrant({
    templateCouponId: tpl.id, leadId: null, sourceOrderId: orderB.id,
    valueCents: tpl.valueAmount, phoneE164: phone, activatesAt,
  });
  console.log(`UNICITE_PHONE=${g2?.code === g1?.code} (g2=${g2?.code})`);

  // 5) Validation avant activation => not_yet_active ; après => valid
  const before = await validateGrant(g1!.code, now);
  console.log(`VALIDATE_BEFORE valid=${before.valid} reason=${(before as any).reason ?? '-'}`);
  const after = await validateGrant(g1!.code, new Date(activatesAt.getTime() + 24 * 3600 * 1000));
  console.log(`VALIDATE_AFTER valid=${after.valid}`);

  console.log(`LIVE_CODE=${g1!.code}`);
  await sql.end();
}
main().then(() => process.exit(0)).catch((e) => {
  console.error('ERR', e.message);
  console.error('CAUSE', e.cause?.message);
  console.error('DETAIL', e.cause?.detail);
  process.exit(1);
});

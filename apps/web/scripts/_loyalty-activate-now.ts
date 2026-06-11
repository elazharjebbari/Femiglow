import postgres from 'postgres';
async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  const past = new Date(Date.now() - 24 * 3600 * 1000);
  const r = await sql`update coupon_grants set activates_at = ${past} where code = ${process.argv[2] ?? 'FG-SAUGE-7212'} returning code, activates_at`;
  console.log('UPDATED', JSON.stringify(r[0]));
  await sql.end();
}
main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1); });

import './_load-env.mjs';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('no DATABASE_URL');
  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 5`;
    console.log('Last 5 migrations applied:');
    rows.forEach((r) => console.log(' ', String(r.hash).slice(0, 24), new Date(Number(r.created_at)).toISOString()));
    const count = await sql`SELECT count(*) AS n FROM drizzle.__drizzle_migrations`;
    console.log('Total applied:', count[0]!.n);
  } finally {
    await sql.end();
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

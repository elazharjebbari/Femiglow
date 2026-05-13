import './_load-env.mjs';
import { sql } from 'drizzle-orm';
import { db as dbFn } from '../src/lib/db/client';

async function main() {
  const db = dbFn();
  if (!db) throw new Error('no db');
  const ids = ['me_4arvcdnelzb0i8ns', 'me_r4ktmilj45xwkwdl', 'me_bocuehbv1marxgrm', 'me_l2coi1hw12x1qbue', 'me_l0qmzk85hzaznfd2'];
  const rows = await db.execute(
    sql`SELECT id, slug, status FROM media WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`
  );
  console.log('DB matches for 404 IDs:', rows);
  console.log('Looked up:', ids.length, 'Found:', Array.isArray(rows) ? rows.length : (rows as { rows?: unknown[] }).rows?.length);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

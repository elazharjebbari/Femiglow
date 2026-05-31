import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const url = process.env.DATABASE_URL;
console.log('URL:', url);
const sql = postgres(url, { max: 1 });
const db = drizzle(sql);
try {
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log('OK');
} catch (e) {
  console.error('FAIL:', e.message, 'code=', e.code, 'detail=', e.detail || '', 'position=', e.position || '');
  console.error('SQL state:', e.sqlState || '');
  console.error('Where:', e.where || '');
  if (e.stack) console.error(e.stack.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
} finally {
  await sql.end();
}

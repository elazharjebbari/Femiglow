import './_load-env.mjs';
import { readdir, access } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { db as dbFn } from '../src/lib/db/client';

async function main() {
  const db = dbFn();
  if (!db) throw new Error('no db');
  const counts = await db.execute(sql`SELECT count(*) as media_total FROM media`);
  const without = await db.execute(sql`SELECT count(*) as without_variants FROM media WHERE id NOT IN (SELECT media_id FROM media_variants)`);
  const byStatus = await db.execute(sql`SELECT status, count(*) FROM media GROUP BY status`);
  const sample = await db.execute(sql`SELECT m.id, m.slug, m.status, count(v.id) as v_count FROM media m LEFT JOIN media_variants v ON v.media_id = m.id GROUP BY m.id, m.slug, m.status ORDER BY v_count ASC, m.created_at DESC LIMIT 10`);
  const jobs = await db.execute(sql`SELECT status, count(*) FROM media_jobs GROUP BY status`);
  console.log('media_total:', counts[0]);
  console.log('without_variants:', without[0]);
  console.log('by_status:', byStatus);
  console.log('media_jobs by_status:', jobs);
  console.log('sample (variants ASC):');
  for (const r of sample as any[]) console.log('  ', JSON.stringify(r));

  const refReviewsWall = await db.execute(sql`
    SELECT m.id, m.slug, m.status, count(v.id) as v_count
    FROM media m
    LEFT JOIN media_variants v ON v.media_id = m.id
    WHERE m.id IN ('me_4arvcdnelzb0i8ns','me_r4ktmilj45xwkwdl')
    GROUP BY m.id, m.slug, m.status
  `);
  console.log('refs 404 from log:', refReviewsWall);

  const pendingList = await db.execute(sql`
    SELECT m.id, m.slug FROM media m WHERE m.status = 'pending' ORDER BY m.slug
  `);
  console.log('pending list:');
  for (const r of pendingList as any[]) console.log('  ', JSON.stringify(r));

  const readyList = await db.execute(sql`
    SELECT m.id FROM media m WHERE m.status = 'ready'
  `) as any[];
  const fsDirs = new Set(await readdir(process.cwd() + '/.media-storage/media'));
  let dbReadyOnDisk = 0;
  let dbReadyMissing = 0;
  const missing: string[] = [];
  for (const r of readyList) {
    if (fsDirs.has(r.id)) dbReadyOnDisk += 1;
    else { dbReadyMissing += 1; missing.push(r.id); }
  }
  console.log('DB ready: ' + readyList.length + ' / on disk: ' + dbReadyOnDisk + ' / missing dir: ' + dbReadyMissing);
  if (missing.length) console.log('  missing ids sample:', missing.slice(0, 5));
  const orphanFsDirs = [...fsDirs].filter((d) => !readyList.find((r: any) => r.id === d));
  console.log('FS orphans (dirs not in DB ready):', orphanFsDirs.length);
  if (orphanFsDirs.length) console.log('  orphan sample:', orphanFsDirs.slice(0, 5));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

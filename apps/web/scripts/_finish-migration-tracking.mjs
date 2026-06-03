/**
 * Finalise le tracking des migrations en attente SANS verrou destructif :
 *  - 0078 (chat intent) : effet déjà présent (colonnes IF NOT EXISTS) — on
 *    vérifie les 3 colonnes + l'index puis on enregistre le hash (l'ALTER
 *    attendrait un ACCESS EXCLUSIVE sur chat_message, tenu par un autre
 *    serveur applicatif tournant sur la même base).
 *  - 0079 (lead_event_outbox) : table genuinely absente — on la crée
 *    (idempotent, aucun verrou sur chat_message), puis hash.
 *  - 0080 (coupons) : tables déjà créées — on enregistre le hash.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import postgres from 'postgres';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle/migrations');
const hashOf = (c) => createHash('sha256').update(c).digest('hex');
const read = (tag) => readFileSync(resolve(DIR, `${tag}.sql`), 'utf8');
const split = (sql) =>
  sql.split('--> statement-breakpoint').map((s) => s.trim()).filter((s) => s && !/^(--[^\n]*\s*)*$/.test(s));

const journal = JSON.parse(readFileSync(resolve(DIR, 'meta/_journal.json'), 'utf8'));
const whenOf = (tag) => journal.entries.find((e) => e.tag === tag)?.when ?? 0;

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

async function record(tag) {
  const h = hashOf(read(tag));
  const exists = await sql`SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash=${h} LIMIT 1`;
  if (exists.length) return console.log(`= ${tag} déjà enregistré`);
  await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${h}, ${whenOf(tag)})`;
  console.log(`✓ ${tag} hash enregistré`);
}

try {
  // 1) 0078 — vérifier l'effet présent avant d'enregistrer le hash.
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='chat_message' AND column_name IN ('intent_tag','intent_method','intent_confidence')`;
  const idx = await sql`SELECT 1 FROM pg_indexes WHERE tablename='chat_message' AND indexname='chat_message_intent_idx'`;
  if (cols.length === 3 && idx.length === 1) {
    await record('0078_chat_intent_tagging');
  } else {
    console.log(`! 0078 effet incomplet (cols=${cols.length}/3, idx=${idx.length}/1) → NON enregistré`);
  }

  // 2) 0079 — créer lead_event_outbox (idempotent, sans verrou chat_message).
  for (const s of split(read('0079_owbs_lead_event_outbox'))) await sql.unsafe(s);
  const outbox = await sql`SELECT to_regclass('public.lead_event_outbox') t`;
  if (outbox[0].t) await record('0079_owbs_lead_event_outbox');
  else console.log('! lead_event_outbox absente après création → NON enregistré');

  // 3) 0080 — coupons déjà créées.
  const cp = await sql`SELECT to_regclass('public.coupons') t`;
  const ce = await sql`SELECT to_regclass('public.coupon_events') t`;
  if (cp[0].t && ce[0].t) await record('0080_coupons');
  else console.log('! tables coupons absentes → NON enregistré');

  const pend = await sql`SELECT count(*)::int c FROM drizzle.__drizzle_migrations`;
  console.log(`\n__drizzle_migrations: ${pend[0].c} hashes enregistrés`);
  await sql.end();
} catch (e) {
  console.error('FATAL', e.message);
  await sql.end().catch(() => {});
  process.exit(1);
}

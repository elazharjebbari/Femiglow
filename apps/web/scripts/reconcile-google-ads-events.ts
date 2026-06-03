/**
 * Reconcile le plan tracking ACTIF avec le câblage Google Ads corrigé
 * (audit google-ads-2026-06-03) :
 *   - ajoute `googleAds` aux 8 events conversion non câblés ;
 *   - retire `googleAds` de `lead_capture` (anti-double-comptage : la conversion
 *     `lead` est portée uniquement par `generate_lead`, method-gaté à l'export).
 *
 * Idempotent. Dry-run par défaut ; passer `--apply` pour écrire.
 * Lancer : node --env-file=.env --import tsx scripts/reconcile-google-ads-events.ts [--apply]
 */
import postgres from 'postgres';

const ADD_GOOGLE_ADS = new Set([
  'contact_submit',
  'chat_message_sent',
  'sign_up',
  'newsletter_submit',
  'video_complete',
  'file_download',
  'fg_journal_read_100',
  'chat_widget_open',
]);
const REMOVE_GOOGLE_ADS = new Set(['lead_capture']);

const apply = process.argv.includes('--apply');

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

interface PlanEvent {
  key: string;
  providers?: Record<string, boolean>;
  [k: string]: unknown;
}

const rows = await sql<{ id: string; version: number; events: PlanEvent[] }[]>`
  SELECT id, version, events FROM tracking_plans WHERE status = 'active' LIMIT 1`;
if (rows.length === 0) {
  console.error('Aucun plan actif.');
  process.exit(1);
}
const plan = rows[0]!;
const changes: string[] = [];
const nextEvents = plan.events.map((ev) => {
  const providers = { ...(ev.providers ?? {}) };
  if (ADD_GOOGLE_ADS.has(ev.key) && providers.googleAds !== true) {
    providers.googleAds = true;
    changes.push(`+ ${ev.key} → googleAds:true`);
  }
  if (REMOVE_GOOGLE_ADS.has(ev.key) && providers.googleAds === true) {
    providers.googleAds = false;
    changes.push(`- ${ev.key} → googleAds:false`);
  }
  return { ...ev, providers };
});

console.log(`Plan actif ${plan.id} (v${plan.version}) — ${changes.length} changement(s) :`);
for (const c of changes) console.log('  ', c);

if (changes.length === 0) {
  console.log('Déjà aligné — rien à faire.');
  await sql.end();
  process.exit(0);
}

if (!apply) {
  console.log('\n(dry-run) — relancer avec --apply pour écrire.');
  await sql.end();
  process.exit(0);
}

await sql`
  UPDATE tracking_plans
  SET events = ${sql.json(nextEvents)}, version = ${plan.version + 1}, updated_at = now()
  WHERE id = ${plan.id} AND status = 'active'`;
console.log(`\n✓ Appliqué — plan v${plan.version + 1}.`);
await sql.end();

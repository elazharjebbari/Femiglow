/**
 * CHA-LEAD-V2-01 — Backfill chat_session.kind.
 *
 * Pour les rows historiques qui ont un id préfixe `s_` (wizard pivot) mais
 * qui ont `kind='chat'` (default après migration), on les passe en
 * `kind='wizard_pivot'`.
 *
 * Note : la migration SQL 0074_chat_session_kind.sql contient déjà ce
 * backfill. Ce script est une alternative TypeScript pour environnements
 * où on ne peut pas exécuter la migration brute (ex. debug local).
 *
 * Usage :
 *   pnpm tsx scripts/backfill-chat-session-kind.ts --dry-run
 *   pnpm tsx scripts/backfill-chat-session-kind.ts --execute
 */
import './_load-env.mjs';
import { sql } from 'drizzle-orm';

import { requireChatDb } from '@/lib/chat/db/client';
import { chatSession } from '@/lib/chat/db/schema';

interface Args {
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: true };
  for (const a of argv) {
    if (a === '--execute') args.dryRun = false;
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const db = requireChatDb();

  console.log(`\n🔧 Backfill chat_session.kind — ${args.dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  const beforeRows = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(chatSession)
    .where(sql`id LIKE 's\\_%' ESCAPE '\\' AND kind = 'chat'`);
  const before = Number(beforeRows[0]?.value ?? 0);

  console.log(`Candidates (id préfixe s_ + kind='chat') : ${before}`);

  if (before === 0) {
    console.log('\n✅ Nothing to backfill — already up to date.\n');
    process.exit(0);
  }

  if (args.dryRun) {
    console.log('\n💡 Use --execute to apply the update.\n');
    process.exit(0);
  }

  const updated = await db
    .update(chatSession)
    .set({ kind: 'wizard_pivot', updatedAt: new Date() })
    .where(sql`id LIKE 's\\_%' ESCAPE '\\' AND kind = 'chat'`)
    .returning({ id: chatSession.id });

  console.log(`✅ Updated ${updated.length} rows to kind='wizard_pivot'`);

  // Vérification post-update
  const afterRows = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(chatSession)
    .where(sql`id LIKE 's\\_%' ESCAPE '\\' AND kind = 'chat'`);
  const after = Number(afterRows[0]?.value ?? 0);

  if (after !== 0) {
    console.error(`\n⚠️  Remaining mismatched rows: ${after}\n`);
    process.exit(1);
  }

  console.log('\n📊 Backfill complete. 0 rows remaining mismatched.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});

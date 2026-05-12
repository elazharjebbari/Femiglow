/**
 * CHA-162 — Seed instruction `default` v2 (FR + AR + AR-MA).
 *
 * Crée une **nouvelle version** de l'instruction `default` (immuable côté
 * `chat_instruction_version`) et l'active. La version v1 reste consultable
 * dans l'admin pour audit.
 *
 * Idempotent : si une version dont le body == DEFAULT_INSTRUCTION_FR_V2
 * existe déjà, le script ne crée pas de doublon (et active simplement
 * cette version si elle ne l'est pas).
 *
 * Voir `docs/chat-assistant/18-instructions-knowledge-strategy.md` §4.
 *
 * Usage : `pnpm tsx scripts/seed-chat-instructions-v2.ts`
 *
 * Exporte aussi `runChatInstructionsV2Seed()` pour réutilisation côté
 * Seeders Runner.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Lecture .env minimale (pas de dépendance dotenv).
try {
  const envPath = resolve(process.cwd(), '.env');
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i.exec(line);
    if (!m) continue;
    const key = m[1];
    const rawValue = m[2];
    if (!key || rawValue === undefined) continue;
    if (key.startsWith('#')) continue;
    if (process.env[key] === undefined) {
      let v = rawValue;
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[key] = v;
    }
  }
} catch {
  // .env optionnel
}

import { eq } from 'drizzle-orm';

import { env } from '@/lib/env';
import { requireChatDb } from '@/lib/chat/db/client';
import { chatProviderConfig } from '@/lib/chat/db/schema';
import {
  DEFAULT_INSTRUCTION_AR_MA_V2,
  DEFAULT_INSTRUCTION_AR_V2,
  DEFAULT_INSTRUCTION_FR_V2,
  DEFAULT_INSTRUCTION_NOTES_V2,
} from '@/lib/chat/instruction-defaults';
import { instructionRepo } from '@/lib/chat/repos/instruction';
import { providerRepo } from '@/lib/chat/repos/provider';

export interface ChatV2SeedReport {
  instructionCreated: boolean;
  instructionId: string | null;
  instructionVersion: number;
  providersUpdated: number;
  providersTotal: number;
  message: string;
}

async function seedInstructionV2(): Promise<{
  created: boolean;
  id: string;
  version: number;
}> {
  // Idempotence : on cherche d'abord une version existante avec le même body.
  const all = await instructionRepo.listByScope('default');
  const existing = all.find((v) => v.body === DEFAULT_INSTRUCTION_FR_V2);
  if (existing) {
    if (!existing.enabled) {
      await instructionRepo.activate(existing.id);
    }
    return { created: false, id: existing.id, version: existing.version };
  }

  const created = await instructionRepo.create({
    scope: 'default',
    body: DEFAULT_INSTRUCTION_FR_V2,
    bodyAr: DEFAULT_INSTRUCTION_AR_V2,
    bodyArMa: DEFAULT_INSTRUCTION_AR_MA_V2,
    notes: DEFAULT_INSTRUCTION_NOTES_V2,
    createdBy: 'system',
  });
  await instructionRepo.activate(created.id);
  return { created: true, id: created.id, version: created.version };
}

/**
 * Upsert idempotent des paramètres v2 sur les providers `role=chat` existants.
 * On ne crée pas de provider — on fusionne (`maxTokens`/`temperature`/`topP`/
 * `timeoutMs`) dans `chat_provider_config.parameters` pour les providers déjà
 * en base. Si les valeurs sont déjà identiques, on skip.
 *
 * Cf. doc 18 §4.6.
 */
async function upsertProviderDefaultsV2(): Promise<{
  updated: number;
  total: number;
}> {
  const CHAT_DEFAULTS_V2 = {
    maxTokens: 220, // ≈ 140 mots (cap doux ; cible 80 mots)
    temperature: 0.6,
    topP: 0.9,
    timeoutMs: 30_000,
  } as const;

  const db = requireChatDb();
  const rows = await db
    .select()
    .from(chatProviderConfig)
    .where(eq(chatProviderConfig.role, 'chat'));

  if (rows.length === 0) {
    return { updated: 0, total: 0 };
  }

  let updated = 0;
  for (const row of rows) {
    const current = (row.parameters ?? {}) as Record<string, unknown>;
    const merged = { ...current, ...CHAT_DEFAULTS_V2 };
    const equal = JSON.stringify(current) === JSON.stringify(merged);
    if (equal) continue;
    await providerRepo.update(row.id, { parameters: merged });
    updated += 1;
  }
  return { updated, total: rows.length };
}

export async function runChatInstructionsV2Seed(): Promise<ChatV2SeedReport> {
  const instr = await seedInstructionV2();
  const providers = await upsertProviderDefaultsV2();
  const messages: string[] = [];
  messages.push(
    instr.created
      ? `instruction v2 créée (v${instr.version})`
      : `instruction v2 déjà présente (v${instr.version})`,
  );
  messages.push(
    providers.total === 0
      ? 'aucun provider à mettre à jour'
      : `${providers.updated}/${providers.total} provider(s) mis à jour`,
  );
  return {
    instructionCreated: instr.created,
    instructionId: instr.id,
    instructionVersion: instr.version,
    providersUpdated: providers.updated,
    providersTotal: providers.total,
    message: messages.join(' · '),
  };
}

async function main(): Promise<void> {
  if (!env.DATABASE_URL) {
    console.error('[seed-chat-v2] DATABASE_URL est requis');
    process.exit(1);
  }
  const report = await runChatInstructionsV2Seed();
  console.log(`[seed-chat-v2] ${report.message}`);
  console.log('[seed-chat-v2] terminé');
}

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMainModule) {
  main().catch((err) => {
    console.error('[seed-chat-v2] erreur', err);
    process.exit(1);
  });
}

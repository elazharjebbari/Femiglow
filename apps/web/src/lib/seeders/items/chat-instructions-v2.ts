/**
 * Seeder chat-instructions-v2 — réutilise `runChatInstructionsV2Seed()` du
 * script CLI. Crée la **version v2** de l'instruction default (immuable,
 * audit-trail conservée) et synchronise les paramètres providers (cf.
 * doc 18 §4.6).
 */
import { runChatInstructionsV2Seed } from '../../../../scripts/seed-chat-instructions-v2';
import type { SeederContext, SeederResult } from '../types';

export async function chatInstructionsV2Seeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  ctx.onProgress?.('Création instruction v2', 0.3);
  const report = await runChatInstructionsV2Seed();
  ctx.onProgress?.('Synchronisation provider params', 0.8);
  return {
    stats: {
      instructionCreated: report.instructionCreated ? 1 : 0,
      version: report.instructionVersion,
      providersUpdated: report.providersUpdated,
      providersTotal: report.providersTotal,
    },
    summary: report.message,
  };
}

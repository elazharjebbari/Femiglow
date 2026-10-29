/* eslint-disable no-console */
/**
 * Publie les consignes par défaut du code (`instruction-defaults.ts`) comme
 * NOUVELLE version active du scope `default`, sans toucher aux providers
 * (contrairement à seed-chat-instructions-v2.ts). Idempotent : si la version
 * active porte déjà ces trois corps, ne fait rien.
 *
 * Usage : pnpm tsx --env-file=.env scripts/chat-publish-instruction.ts [--dry-run]
 */
import {
  DEFAULT_INSTRUCTION_AR_MA_V2,
  DEFAULT_INSTRUCTION_AR_V2,
  DEFAULT_INSTRUCTION_FR_V2,
  DEFAULT_INSTRUCTION_NOTES_V2,
} from '@/lib/chat/instruction-defaults';
import { instructionRepo } from '@/lib/chat/repos/instruction';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const active = await instructionRepo.active('default');
  if (
    active &&
    active.body === DEFAULT_INSTRUCTION_FR_V2 &&
    active.bodyAr === DEFAULT_INSTRUCTION_AR_V2 &&
    active.bodyArMa === DEFAULT_INSTRUCTION_AR_MA_V2
  ) {
    console.log(`déjà active : v${active.version} (${active.id})`);
    return;
  }
  console.log(`active actuelle : ${active ? `v${active.version} (${active.id})` : 'aucune'}`);
  if (dryRun) {
    console.log('dry-run : une nouvelle version serait créée puis activée.');
    return;
  }
  const created = await instructionRepo.create({
    scope: 'default',
    body: DEFAULT_INSTRUCTION_FR_V2,
    bodyAr: DEFAULT_INSTRUCTION_AR_V2,
    bodyArMa: DEFAULT_INSTRUCTION_AR_MA_V2,
    notes: DEFAULT_INSTRUCTION_NOTES_V2,
    createdBy: active?.createdBy ?? 'system',
  });
  await instructionRepo.activate(created.id);
  console.log(`publiée et activée : v${created.version} (${created.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

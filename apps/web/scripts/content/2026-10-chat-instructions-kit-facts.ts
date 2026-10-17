/**
 * Cohérence produit (17/10/2026) — publie les instructions du chat IA
 * alignées sur la fiche de référence (`src/lib/products/kit-facts.ts`).
 *
 * Crée une nouvelle version de l'instruction `default` à partir de
 * `instruction-defaults.ts` et l'active ; les versions précédentes restent
 * consultables dans l'admin. Contrairement à `seed-chat-instructions-v2.ts`,
 * ne touche pas aux paramètres des fournisseurs.
 *
 * Idempotent. Usage (depuis apps/web) :
 *   pnpm tsx scripts/content/2026-10-chat-instructions-kit-facts.ts
 */
import '../_load-env.mjs';

import {
  DEFAULT_INSTRUCTION_AR_MA_V2,
  DEFAULT_INSTRUCTION_AR_V2,
  DEFAULT_INSTRUCTION_FR_V2,
  DEFAULT_INSTRUCTION_NOTES_V2,
} from '@/lib/chat/instruction-defaults';
import { instructionRepo } from '@/lib/chat/repos/instruction';

async function main(): Promise<void> {
  const all = await instructionRepo.listByScope('default');
  const existing = all.find((v) => v.body === DEFAULT_INSTRUCTION_FR_V2);
  if (existing) {
    if (!existing.enabled) await instructionRepo.activate(existing.id);
    console.log(`instruction déjà présente (v${existing.version}), active`);
    return;
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
  console.log(`instruction créée et activée (v${created.version})`);
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(err);
    process.exit(1);
  },
);

/**
 * Factory `chatInstructionFactory` — entité `chat_instruction_version`.
 *
 * Référence schema : `apps/web/src/lib/chat/db/schema.ts:30`
 *
 * Traits :
 *  - `enabled()` — version active (par défaut)
 *  - `disabled()` — version archivée / draft
 *  - `withVersion(n)` — numéro version explicite
 */
import { defineFactory, testId } from './base';

export interface ChatInstructionLike {
  id: string;
  version: number;
  scope: string;
  body: string;
  bodyAr: string | null;
  bodyArMa: string | null;
  notes: string | null;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
}

const baseChatInstructionFactory = defineFactory<ChatInstructionLike>(() => ({
  id: testId('ci'),
  version: 1,
  scope: 'default',
  body: 'Tu es l\'assistante FemiGlow. Tu réponds avec chaleur et expertise. Tu connais nos produits...',
  bodyAr: 'أنت مساعدة FemiGlow. تجيبين بدفء وخبرة.',
  bodyArMa: 'Nta FemiGlow assistant, kanjawb b chala wa khibra.',
  notes: 'Default instruction v1',
  enabled: true,
  createdBy: 'admin_test',
  createdAt: new Date(),
}));

export const chatInstructionFactory = {
  ...baseChatInstructionFactory,
  enabled: (overrides: Partial<ChatInstructionLike> = {}) =>
    baseChatInstructionFactory.build({ enabled: true, ...overrides }),
  disabled: (overrides: Partial<ChatInstructionLike> = {}) =>
    baseChatInstructionFactory.build({ enabled: false, ...overrides }),
  withVersion: (version: number, overrides: Partial<ChatInstructionLike> = {}) =>
    baseChatInstructionFactory.build({ version, ...overrides }),
};

/**
 * Pilotage runtime du module chat (toggle DB).
 *
 * - Le kill switch ultime reste `env.CHAT_ENABLED` ; quand l'env est
 *   `false`, ce module renvoie systématiquement `false`.
 * - Quand l'env est `true`, on consulte la table `chat_runtime_setting`
 *   (clé `enabled`) ; absent ou `null` → considéré actif.
 *
 * Cache via `unstable_cache(['chat-config'])` : invalidé par
 * `revalidateTag('chat-config')` après chaque toggle (cohérent avec
 * les autres flux config admin → public).
 */
import { eq } from 'drizzle-orm';
import { revalidateTag, unstable_cache } from 'next/cache';

import { env } from '@/lib/env';

import { requireChatDb } from './db/client';
import { chatRuntimeSetting } from './db/schema';

const SETTING_TAG = 'chat-config';

const readEnabledRaw = unstable_cache(
  async (): Promise<boolean> => {
    if (env.CHAT_ENABLED !== 'true') return false;
    try {
      const db = requireChatDb();
      const rows = await db
        .select()
        .from(chatRuntimeSetting)
        .where(eq(chatRuntimeSetting.key, 'enabled'))
        .limit(1);
      const row = rows[0];
      // absent ou nul = actif (env true → actif par défaut)
      return row?.valueBool ?? true;
    } catch {
      // En cas d'erreur DB (ex. CI sans DB), on fait confiance à l'env.
      return env.CHAT_ENABLED === 'true';
    }
  },
  ['chat-runtime-enabled'],
  { tags: [SETTING_TAG], revalidate: 60 },
);

/**
 * Renvoie `true` si le chat est actif (env + DB toggle).
 * Async — préférer aux endroits server-side qui peuvent attendre.
 */
export async function isChatActive(): Promise<boolean> {
  return readEnabledRaw();
}

/**
 * Modifie le toggle DB. N'active PAS le chat si l'env est désactivé.
 */
export async function setChatActive(value: boolean, updatedBy: string): Promise<void> {
  const db = requireChatDb();
  await db
    .insert(chatRuntimeSetting)
    .values({
      key: 'enabled',
      valueBool: value,
      updatedBy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: chatRuntimeSetting.key,
      set: {
        valueBool: value,
        updatedBy,
        updatedAt: new Date(),
      },
    });
  revalidateTag(SETTING_TAG);
}

/**
 * Lit un toggle bool générique. Renvoie `fallback` si la clé n'existe pas
 * ou si la DB n'est pas joignable.
 */
const readBoolRaw = unstable_cache(
  async (key: string, fallback: boolean): Promise<boolean> => {
    try {
      const db = requireChatDb();
      const rows = await db
        .select()
        .from(chatRuntimeSetting)
        .where(eq(chatRuntimeSetting.key, key))
        .limit(1);
      return rows[0]?.valueBool ?? fallback;
    } catch {
      return fallback;
    }
  },
  ['chat-runtime-bool'],
  { tags: [SETTING_TAG], revalidate: 60 },
);

export async function getRuntimeBool(key: string, fallback = false): Promise<boolean> {
  return readBoolRaw(key, fallback);
}

export async function setRuntimeBool(
  key: string,
  value: boolean,
  updatedBy: string,
): Promise<void> {
  const db = requireChatDb();
  await db
    .insert(chatRuntimeSetting)
    .values({ key, valueBool: value, updatedBy, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: chatRuntimeSetting.key,
      set: { valueBool: value, updatedBy, updatedAt: new Date() },
    });
  revalidateTag(SETTING_TAG);
}

/**
 * CHA-018 — Repository chat_provider_config.
 *
 * Garde la clé toujours chiffrée en base ; expose une méthode
 * `decryptedConfig` qui hydrate la clé pour instanciation.
 */
import { and, asc, eq, sql } from 'drizzle-orm';

import { createId } from '@/lib/ids';

import { decryptSecret, encryptSecret } from '../secrets';
import { requireChatDb } from '../db/client';
import {
  chatProviderConfig,
  type ChatProviderConfigInsert,
  type ChatProviderConfigRow,
} from '../db/schema';
import type { ChatProviderConfig as ChatProviderConfigDecoded } from '../providers/types';

export const providerRepo = {
  async listByRole(
    role: ChatProviderConfigRow['role'],
    onlyEnabled = true,
  ): Promise<ChatProviderConfigRow[]> {
    const db = requireChatDb();
    return db
      .select()
      .from(chatProviderConfig)
      .where(
        onlyEnabled
          ? and(eq(chatProviderConfig.role, role), eq(chatProviderConfig.enabled, true))
          : eq(chatProviderConfig.role, role),
      )
      .orderBy(asc(chatProviderConfig.priority));
  },

  async getById(id: string): Promise<ChatProviderConfigRow | null> {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatProviderConfig)
      .where(eq(chatProviderConfig.id, id))
      .limit(1);
    return rows[0] ?? null;
  },

  async create(
    insert: Omit<ChatProviderConfigInsert, 'id' | 'apiKeyEncrypted' | 'apiKeyIv'> & {
      apiKey?: string;
    },
  ): Promise<ChatProviderConfigRow> {
    const db = requireChatDb();
    const id = createId('cp');
    const enc = insert.apiKey ? encryptSecret(insert.apiKey) : null;
    const { apiKey, ...rest } = insert;
    const rows = await db
      .insert(chatProviderConfig)
      .values({
        ...rest,
        id,
        apiKeyEncrypted: enc?.ciphertext ?? null,
        apiKeyIv: enc?.iv ?? null,
      })
      .returning();
    return rows[0]!;
  },

  async update(
    id: string,
    partial: Partial<Omit<ChatProviderConfigInsert, 'apiKeyEncrypted' | 'apiKeyIv'>> & {
      apiKey?: string;
    },
  ): Promise<ChatProviderConfigRow | null> {
    const db = requireChatDb();
    const { apiKey, ...rest } = partial;
    const update: Partial<ChatProviderConfigInsert> = { ...rest, updatedAt: new Date() };
    if (apiKey !== undefined) {
      if (apiKey === '') {
        update.apiKeyEncrypted = null;
        update.apiKeyIv = null;
      } else {
        const enc = encryptSecret(apiKey);
        update.apiKeyEncrypted = enc.ciphertext;
        update.apiKeyIv = enc.iv;
      }
    }
    const rows = await db
      .update(chatProviderConfig)
      .set(update)
      .where(eq(chatProviderConfig.id, id))
      .returning();
    return rows[0] ?? null;
  },

  /** Renvoie la config avec apiKey déchiffrée, prête pour la fabrique. */
  decode(row: ChatProviderConfigRow): ChatProviderConfigDecoded {
    let apiKey: string | undefined;
    if (row.apiKeyEncrypted && row.apiKeyIv) {
      apiKey = decryptSecret({ ciphertext: row.apiKeyEncrypted, iv: row.apiKeyIv });
    }
    return {
      id: row.id,
      kind: row.kind,
      label: row.label,
      apiKey,
      apiBase: row.apiBase ?? undefined,
      chatModel: row.chatModel ?? undefined,
      embeddingModel: row.embeddingModel ?? undefined,
      moderationModel: row.moderationModel ?? undefined,
      headers: row.headers ?? undefined,
      parameters: row.parameters ?? undefined,
    };
  },

  async incrementConsumed(id: string, costEur: number): Promise<void> {
    if (!Number.isFinite(costEur) || costEur <= 0) return;
    const db = requireChatDb();
    await db.execute(sql`
      UPDATE chat_provider_config
         SET consumed_month_eur = consumed_month_eur + ${costEur},
             updated_at = NOW()
       WHERE id = ${id}
    `);
  },
};

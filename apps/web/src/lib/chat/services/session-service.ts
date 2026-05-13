/**
 * CHA-029 — Service `sessionService`.
 *
 * Couche métier au-dessus de `sessionRepo` :
 * - `getOrCreate` : récupère la session active ou en crée une.
 * - `snapshot` : assemble le DTO `ChatSessionSnapshot` envoyé au widget.
 * - `attributeConversion` : lie une session à une commande.
 * - `forget` : déclenche le droit à l'oubli.
 *
 * cf. docs/chat-assistant/03-backend.md §3.1
 */
import { logger } from '@/lib/logging/logger';

import type {
  ChatLanguage,
  ChatMessageDto,
  ChatSessionSnapshot,
  ChatSuggestionPill,
} from '../contracts';
import { cannedPairRepo } from '../repos/canned-pair';
import { eventRepo } from '../repos/event';
import { instructionRepo } from '../repos/instruction';
import { messageRepo } from '../repos/message';
import { sessionRepo } from '../repos/session';
import type { ChatMessageRow, ChatSessionRow } from '../db/schema';

import { assignChatVariants, encodeVariantsForSession } from './ab-engine';
import { getVisitorId } from './visitor-cookie';

interface GetOrCreateOptions {
  language?: ChatLanguage;
  page?: string;
  referrer?: string;
}

export const sessionService = {
  async getOrCreate(opts: GetOrCreateOptions = {}): Promise<ChatSessionRow> {
    const visitorId = getVisitorId();
    const existing = await sessionRepo.getActiveByVisitor(visitorId);
    if (existing) {
      await sessionRepo.touch(existing.id);
      return existing;
    }
    const instruction = await instructionRepo.active('default');
    if (!instruction) {
      throw new Error(
        'No active chat instruction. Click "⚙ Seed par défaut" on /admin/chat/instructions or POST /api/admin/chat/seed-defaults.',
      );
    }
    // CHAT-058 — Assignation A/B déterministe par visitorId. Si aucune
    // expérience n'est activée, on stocke 'default' pour rester lisible
    // côté analytics SQL.
    const variants = assignChatVariants(visitorId);
    const experimentVariantId = encodeVariantsForSession(variants);
    const created = await sessionRepo.create({
      visitorId,
      language: opts.language ?? 'fr',
      page: opts.page ?? null,
      referrer: opts.referrer ?? null,
      instructionVersionId: instruction.id,
      status: 'open',
      experimentVariantId,
    });
    await eventRepo.append(created.id, 'session_open', {
      visitorId,
      page: opts.page ?? null,
    });
    logger.info('chat.session.create', { sessionId: created.id });
    return created;
  },

  async snapshot(id: string): Promise<ChatSessionSnapshot | null> {
    const session = await sessionRepo.getById(id);
    if (!session) return null;
    const messages = await messageRepo.listBySession(id, 200);
    const language = (session.language as ChatLanguage) ?? 'fr';
    // CHA-300 — Pills page-aware servies via `chat_canned_pair`. Le filtre
    // `published + enabled + audience + pagePattern` est appliqué côté repo.
    // On limite à 4 pour rester aérien dans le widget mobile (cf. UX V5/V6).
    const suggestions: ChatSuggestionPill[] = await loadSuggestions(
      session.page,
      language,
    );
    return {
      sessionId: session.id,
      language,
      status: session.status,
      greeting: '', // peuplé par themeService côté caller
      suggestions,
      messages: messages.map(toMessageDto),
      themeVariantId: session.themePresetId ?? 'default',
      variantOpaqueId: session.experimentVariantId ?? 'default',
    };
  },

  async attributeConversion(sessionId: string, orderId: string): Promise<void> {
    await sessionRepo.update(sessionId, {
      convertedOrderId: orderId,
      convertedAt: new Date(),
    });
    await eventRepo.append(sessionId, 'conversion_attributed', { orderId });
  },

  async forget(id: string): Promise<void> {
    await messageRepo.deleteBySession(id);
    await sessionRepo.forget(id);
    logger.info('chat.session.forget', { sessionId: id });
  },
};

async function loadSuggestions(
  page: string | null,
  language: ChatLanguage,
): Promise<ChatSuggestionPill[]> {
  try {
    const rows = await cannedPairRepo.listForPage({
      page: page ?? '/',
      audience: 'all',
      language,
      limit: 4,
    });
    return rows.map((r) => ({
      key: r.key,
      label: r.label,
      ctaLabel: r.ctaLabel,
      ctaUrl: r.ctaUrl,
    }));
  } catch (err) {
    // Table absente / DB indisponible : on dégrade en pills vides plutôt
    // que de faire planter le `GET /api/chat/session` (le widget reste
    // utilisable, juste sans pills).
    logger.warn('chat.snapshot.suggestions.failed', {
      page,
      error: (err as Error).message,
    });
    return [];
  }
}

export function toMessageDto(row: ChatMessageRow): ChatMessageDto {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    language: (row.language as ChatLanguage | null) ?? null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    sources: row.ragHits?.map((h) => ({
      chunkId: h.chunkId,
      title: '',
      score: h.score,
    })),
  };
}

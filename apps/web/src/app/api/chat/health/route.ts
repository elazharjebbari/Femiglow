/**
 * GET /api/chat/health
 *
 * Endpoint public utilisé par les smoke tests post-deploy et le
 * monitoring externe (UptimeRobot, Vercel checks). Toujours 200 sauf
 * panne du process Next ; les dégradations sont remontées via
 * `serviceLevel`.
 *
 * Niveaux (cf. docs/dossier-chat-v2/11-runbook/runbook.md §service-levels) :
 *  - 1 NOMINAL       : tout vert (DB + ≥1 provider chat enabled + chat actif)
 *  - 2 DEGRADED      : DB OK + ≥1 provider chat mais < provider configurés (au moins un down)
 *  - 3 RAG_OFF       : DB OK + chat enabled mais aucun provider embedding actif
 *  - 4 KEYWORD_ONLY  : DB OK mais aucun provider chat actif
 *  - 5 STATIC        : chat killswitch off OU DB indisponible
 *
 * Pas d'auth requise : l'endpoint ne révèle aucune donnée sensible
 * (uniquement statuts agrégés et noms de kinds).
 */
import { NextResponse } from 'next/server';

import { isChatEnabled } from '@/lib/chat/feature-flag';
import { isChatActive } from '@/lib/chat/runtime-setting';
import { chatDb } from '@/lib/chat/db/client';
import { chatProviderConfig } from '@/lib/chat/db/schema';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProviderRole = 'chat' | 'embedding' | 'moderation' | 'rerank';
type ProviderStatus = 'ok' | 'disabled' | 'absent';

interface HealthResponse {
  serviceLevel: 1 | 2 | 3 | 4 | 5;
  chatEnabled: boolean;
  chatActive: boolean;
  db: 'ok' | 'unavailable';
  providers: {
    chat: Record<string, ProviderStatus>;
    embedding: Record<string, ProviderStatus>;
  };
  uptimeSec: number;
  timestamp: string;
}

export async function GET(): Promise<Response> {
  const chatEnabled = isChatEnabled();

  // Killswitch env : STATIC immédiat, on ne touche pas la DB.
  if (!chatEnabled) {
    return NextResponse.json<HealthResponse>(
      {
        serviceLevel: 5,
        chatEnabled: false,
        chatActive: false,
        db: 'unavailable',
        providers: { chat: {}, embedding: {} },
        uptimeSec: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  }

  const db = chatDb();
  if (!db) {
    return NextResponse.json<HealthResponse>(
      {
        serviceLevel: 5,
        chatEnabled: true,
        chatActive: false,
        db: 'unavailable',
        providers: { chat: {}, embedding: {} },
        uptimeSec: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  }

  try {
    const [chatActive, providerRows] = await Promise.all([
      isChatActive(),
      db
        .select({
          kind: chatProviderConfig.kind,
          role: chatProviderConfig.role,
          enabled: chatProviderConfig.enabled,
        })
        .from(chatProviderConfig),
    ]);

    const grouped: Record<ProviderRole, Record<string, ProviderStatus>> = {
      chat: {},
      embedding: {},
      moderation: {},
      rerank: {},
    };

    for (const row of providerRows) {
      const bucket = grouped[row.role as ProviderRole];
      if (!bucket) continue;
      const current = bucket[row.kind];
      const next: ProviderStatus = row.enabled ? 'ok' : 'disabled';
      if (current !== 'ok') bucket[row.kind] = next;
    }

    const chatProviders = grouped.chat;
    const embeddingProviders = grouped.embedding;
    const chatOk = Object.values(chatProviders).filter((s) => s === 'ok').length;
    const chatConfigured = Object.keys(chatProviders).length;
    const embeddingOk = Object.values(embeddingProviders).filter((s) => s === 'ok').length;

    let serviceLevel: HealthResponse['serviceLevel'];
    if (!chatActive) {
      serviceLevel = 5;
    } else if (chatOk === 0) {
      serviceLevel = 4;
    } else if (embeddingOk === 0) {
      serviceLevel = 3;
    } else if (chatOk < chatConfigured) {
      serviceLevel = 2;
    } else {
      serviceLevel = 1;
    }

    return NextResponse.json<HealthResponse>(
      {
        serviceLevel,
        chatEnabled: true,
        chatActive,
        db: 'ok',
        providers: { chat: chatProviders, embedding: embeddingProviders },
        uptimeSec: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (err) {
    logger.error('chat.health.failed', { error: (err as Error).message });
    return NextResponse.json<HealthResponse>(
      {
        serviceLevel: 5,
        chatEnabled: true,
        chatActive: false,
        db: 'unavailable',
        providers: { chat: {}, embedding: {} },
        uptimeSec: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    );
  }
}

/**
 * CHA-048 — Route GET /api/chat/theme.
 *
 * Retourne le preset de thème par défaut (tokens, layout, motion,
 * salutations contextuelles). Cache `revalidateTag('chat-config')`
 * pour permettre un hot reload depuis l'admin.
 */
import { eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

import {
  ChatDisabledError,
  assertChatEnabled,
} from '@/lib/chat/feature-flag';
import { requireChatDb } from '@/lib/chat/db/client';
import { chatThemePreset, type ChatThemePresetRow } from '@/lib/chat/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const getDefaultTheme = unstable_cache(
  async (): Promise<ChatThemePresetRow | null> => {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatThemePreset)
      .where(eq(chatThemePreset.isDefault, true))
      .limit(1);
    return rows[0] ?? null;
  },
  ['chat-theme-default'],
  { tags: ['chat-config'], revalidate: 300 },
);

export async function GET(_req: NextRequest): Promise<Response> {
  try {
    assertChatEnabled();
  } catch (err) {
    if (err instanceof ChatDisabledError) {
      return new NextResponse('Not Found', { status: 404 });
    }
    throw err;
  }

  const theme = await getDefaultTheme();
  if (!theme) {
    // Pas de seed → on renvoie un thème minimal fallback.
    return NextResponse.json({
      id: 'fallback',
      name: 'fallback',
      tokens: {
        '--chat-bg': '#ffffff',
        '--chat-fg': '#1c1917',
        '--chat-accent': '#1c1917',
        '--chat-radius': 16,
      },
      layout: {
        position: 'bottom-right',
        panel: { width: 380, maxHeight: 560, radius: 16 },
        mobile: { fullscreen: true },
      },
      motion: {
        humanize: { jitterMinMs: 30, jitterMaxMs: 60, punctPauseMs: 120 },
        easings: { panel: 'ease-out', bubble: 'ease-out' },
      },
      pageSalutations: [],
    });
  }
  return NextResponse.json({
    id: theme.id,
    name: theme.name,
    tokens: theme.tokens,
    layout: theme.layout,
    motion: theme.motion,
    pageSalutations: theme.pageSalutations ?? [],
  });
}

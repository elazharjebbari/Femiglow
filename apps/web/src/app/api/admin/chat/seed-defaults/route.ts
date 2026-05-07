/**
 * Seed admin : crée et active l'instruction par défaut **v2** (kit + COD +
 * pas de redirection) + le thème « FemiGlow — discret » si absents.
 *
 * Idempotence par **contenu** (pas par "active oui/non") : si une version
 * dont le `body` correspond exactement à `DEFAULT_INSTRUCTION_FR_V2` existe
 * déjà, on l'active si elle ne l'est pas. Sinon, on crée une **nouvelle
 * version** (qui devient active) — la ou les anciennes versions (v1)
 * restent consultables dans la liste pour audit, et l'admin peut basculer
 * entre versions depuis l'UI.
 *
 * Form-encoded ou JSON. Redirige vers `/admin/chat/instructions` après
 * succès (303). Renvoie JSON pour les clients API.
 */
import { eq } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { requireChatDb } from '@/lib/chat/db/client';
import { chatThemePreset } from '@/lib/chat/db/schema';
import {
  DEFAULT_INSTRUCTION_AR_MA_V2,
  DEFAULT_INSTRUCTION_AR_V2,
  DEFAULT_INSTRUCTION_FR_V2,
  DEFAULT_INSTRUCTION_NOTES_V2,
} from '@/lib/chat/instruction-defaults';
import { instructionRepo } from '@/lib/chat/repos/instruction';
import { createId } from '@/lib/ids';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_THEME_TOKENS: Record<string, string | number> = {
  '--chat-bg': '#ffffff',
  '--chat-fg': '#1c1917',
  '--chat-accent': '#1c1917',
  '--chat-radius': 16,
  '--chat-shadow': '0 12px 32px rgb(28 25 23 / 0.10)',
};

type SeedAction = 'created' | 'activated' | 'noop';

/**
 * Idempotence par contenu :
 *   - Si une version existe avec body === DEFAULT_INSTRUCTION_FR_V2 :
 *       - active déjà ? `noop` (rien à faire).
 *       - sinon : `activate` (l'admin pourra ensuite éditer).
 *   - Sinon : on crée une nouvelle version (v_n+1) avec le contenu v2,
 *     puis on l'active. La ou les versions précédentes (v1) restent
 *     dans la liste pour rollback / audit.
 */
async function seedInstruction(
  by: string,
): Promise<{ action: SeedAction; id: string; version: number }> {
  const all = await instructionRepo.listByScope('default');
  const matching = all.find((v) => v.body === DEFAULT_INSTRUCTION_FR_V2);
  if (matching) {
    if (matching.enabled) {
      return { action: 'noop', id: matching.id, version: matching.version };
    }
    await instructionRepo.activate(matching.id);
    return { action: 'activated', id: matching.id, version: matching.version };
  }
  const created = await instructionRepo.create({
    scope: 'default',
    body: DEFAULT_INSTRUCTION_FR_V2,
    bodyAr: DEFAULT_INSTRUCTION_AR_V2,
    bodyArMa: DEFAULT_INSTRUCTION_AR_MA_V2,
    notes: DEFAULT_INSTRUCTION_NOTES_V2,
    createdBy: by,
  });
  await instructionRepo.activate(created.id);
  return { action: 'created', id: created.id, version: created.version };
}

async function seedTheme(): Promise<{ created: boolean; id: string }> {
  const db = requireChatDb();
  const existing = await db
    .select()
    .from(chatThemePreset)
    .where(eq(chatThemePreset.isDefault, true))
    .limit(1);
  if (existing[0]) return { created: false, id: existing[0].id };
  const id = createId('ct');
  await db.insert(chatThemePreset).values({
    id,
    name: 'FemiGlow — discret',
    isDefault: true,
    tokens: DEFAULT_THEME_TOKENS,
    layout: {
      position: 'bottom-right',
      panel: { width: 380, maxHeight: 560, radius: 16 },
      mobile: { fullscreen: true },
    },
    motion: {
      humanize: { jitterMinMs: 30, jitterMaxMs: 60, punctPauseMs: 120 },
      easings: { panel: 'ease-out', bubble: 'ease-out' },
    },
    pageSalutations: [
      {
        pathPattern: '/',
        fr: "Bonjour, posez-moi votre question — je connais bien FemiGlow.",
        ar: 'أهلاً، اسأليني عمّا تشائين عن فيمي‌غلو.',
        arMa: 'salam ! 9Olili chno bghiti tsewlini 3la FemiGlow.',
      },
      {
        pathPattern: '/kit',
        fr: 'Une question sur le rituel ? Je suis là.',
        ar: 'أي سؤال عن الطقوس ؟ أنا هنا.',
        arMa: 'wach 3andek soual 3la l-kit ? ana hna.',
      },
    ],
    enabled: true,
  });
  return { created: true, id };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let instruction: { action: SeedAction; id: string; version: number };
  let theme: { created: boolean; id: string };
  try {
    instruction = await seedInstruction(auth.email);
    theme = await seedTheme();
  } catch (err) {
    logger.error('chat.admin.seed_defaults_failed', {
      error: (err as Error).message,
      by: auth.email,
    });
    return NextResponse.json(
      { error: 'seed-failed', message: (err as Error).message },
      { status: 500 },
    );
  }

  revalidateTag('chat-config');
  logger.info('chat.admin.seed_defaults', {
    by: auth.email,
    instruction,
    theme,
  });

  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    return NextResponse.json({ ok: true, instruction, theme });
  }
  // Redirige vers la fiche de la version qui vient d'être créée/activée
  // pour que l'admin puisse l'éditer immédiatement.
  const flashCode =
    instruction.action === 'created'
      ? 'seeded'
      : instruction.action === 'activated'
        ? 'seed-activated'
        : 'seed-noop';
  const target =
    instruction.action === 'noop'
      ? `/admin/chat/instructions?ok=${flashCode}`
      : `/admin/chat/instructions/${instruction.id}?ok=${flashCode}`;
  return NextResponse.redirect(new URL(target, req.url), 303);
}

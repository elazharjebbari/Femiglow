/**
 * CHA-004 / CHA-016 — Seed du module chat.
 *
 * Crée :
 * - 1 instruction par défaut (FR + AR + AR-MA)
 * - 1 theme preset par défaut
 * - les providers configurés via .env (CHAT_OPENAI_API_KEY, etc.)
 *
 * Idempotent : un nouveau lancement n'écrase pas ce qui existe.
 *
 * Usage : `pnpm tsx scripts/seed-chat.ts`
 *
 * Exporte aussi `runChatInstructionsSeed()`, `runChatThemeSeed()` et
 * `runChatProvidersSeed()` pour réutilisation côté Seeders Runner.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';

// Lecture .env minimale (pas de dépendance dotenv).
try {
  const envPath = resolve(process.cwd(), '.env');
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i.exec(line);
    if (!m) continue;
    const key = m[1];
    const rawValue = m[2];
    if (!key || rawValue === undefined) continue;
    if (key.startsWith('#')) continue;
    if (process.env[key] === undefined) {
      let v = rawValue;
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[key] = v;
    }
  }
} catch {
  // .env optionnel
}

import { env } from '@/lib/env';
import { requireChatDb } from '@/lib/chat/db/client';
import {
  chatProviderConfig,
  chatThemePreset,
} from '@/lib/chat/db/schema';
import { instructionRepo } from '@/lib/chat/repos/instruction';
import { providerRepo } from '@/lib/chat/repos/provider';
import { createId } from '@/lib/ids';

const DEFAULT_INSTRUCTION_FR = `Tu es l'assistante de la maison FemiGlow, marque marocaine de soin pour les ongles. Ta voix est sobre, élégante, sensorielle ; jamais médicale, toujours bienveillante. Tu réponds en 2-4 phrases courtes. Tu ne donnes jamais de conseils médicaux. Tu cites les sources fournies dans le contexte si elles sont pertinentes. Tu redirige vers /kit pour les achats.`;

const DEFAULT_INSTRUCTION_AR = `أنت المساعدة الافتراضية لدار FemiGlow، علامة مغربية للعناية بالأظافر. صوتك راقٍ، حسي، ودي. ترد بإيجاز في 2-4 جمل. لا تقدمي أي نصيحة طبية.`;

const DEFAULT_INSTRUCTION_AR_MA = `nta l-assistante dyal FemiGlow, marque maghribiya li 3inaya b ladafer. tkellem b sahla, b lhna w b raqya. jaweb f 2-4 jumel sghar. ma t3tisch nasiha tibbiya. l shra2 dakhil /kit.`;

const DEFAULT_THEME_TOKENS: Record<string, string | number> = {
  '--chat-bg': '#ffffff',
  '--chat-fg': '#1c1917',
  '--chat-accent': '#1c1917',
  '--chat-radius': 16,
  '--chat-shadow': '0 12px 32px rgb(28 25 23 / 0.10)',
};

export interface ChatSeedReport {
  created: boolean;
  id: string | null;
  message: string;
}

export async function runChatInstructionsSeed(): Promise<ChatSeedReport> {
  const existing = await instructionRepo.active('default');
  if (existing) {
    return {
      created: false,
      id: existing.id,
      message: `Instruction active déjà présente (${existing.id})`,
    };
  }
  const created = await instructionRepo.create({
    scope: 'default',
    body: DEFAULT_INSTRUCTION_FR,
    bodyAr: DEFAULT_INSTRUCTION_AR,
    bodyArMa: DEFAULT_INSTRUCTION_AR_MA,
    notes: 'seed-chat: instruction initiale',
    createdBy: 'system',
  });
  await instructionRepo.activate(created.id);
  return {
    created: true,
    id: created.id,
    message: `Instruction créée + activée (${created.id})`,
  };
}

export async function runChatThemeSeed(): Promise<ChatSeedReport> {
  const db = requireChatDb();
  const existing = await db
    .select()
    .from(chatThemePreset)
    .where(eq(chatThemePreset.isDefault, true))
    .limit(1);
  if (existing[0]) {
    return {
      created: false,
      id: existing[0].id,
      message: `Theme par défaut déjà présent (${existing[0].id})`,
    };
  }
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
  return {
    created: true,
    id,
    message: `Theme par défaut créé (${id})`,
  };
}

export interface ChatProvidersReport {
  created: number;
  skipped: boolean;
  message: string;
}

export async function runChatProvidersSeed(): Promise<ChatProvidersReport> {
  const db = requireChatDb();
  const existing = await db.select().from(chatProviderConfig).limit(1);
  if (existing[0]) {
    return {
      created: 0,
      skipped: true,
      message: 'Providers déjà présents → skip',
    };
  }
  // Cf. doc 18 §4.6 — plafonds explicites pour la cible v2.
  const CHAT_DEFAULTS = {
    maxTokens: 220, // ≈ 140 mots (cap doux ; cible 80 mots)
    temperature: 0.6, // chaleur sans extravagance
    topP: 0.9,
    timeoutMs: 30_000,
  } as const;
  const todo: Array<{ env: string | undefined; kind: 'openai' | 'gemini' | 'anthropic' | 'mistral' | 'ollama'; label: string }> = [
    { env: env.CHAT_OPENAI_API_KEY, kind: 'openai', label: 'OpenAI gpt-4o-mini' },
    { env: env.CHAT_GEMINI_API_KEY, kind: 'gemini', label: 'Gemini 1.5 Flash' },
    { env: env.CHAT_ANTHROPIC_API_KEY, kind: 'anthropic', label: 'Claude 3.5 Haiku' },
    { env: env.CHAT_MISTRAL_API_KEY, kind: 'mistral', label: 'Mistral Small' },
  ];
  let priority = 100;
  let created = 0;
  for (const p of todo) {
    if (!p.env) continue;
    await providerRepo.create({
      kind: p.kind,
      label: p.label,
      role: 'chat',
      priority,
      enabled: true,
      apiKey: p.env,
      egressAllowed: false,
      parameters: CHAT_DEFAULTS,
    });
    created += 1;
    priority += 10;

    // M5+ : créer aussi le rôle 'embedding' associé pour les providers qui
    // supportent les embeddings (OpenAI, Gemini, Mistral). Sans ça, le seeder
    // FAQ + intents skipe car aucun provider avec role='embedding' n'est
    // enabled. Le bouton "Seed défauts" devient inutile en prod.
    if (p.kind === 'openai' || p.kind === 'gemini' || p.kind === 'mistral') {
      await providerRepo.create({
        kind: p.kind,
        label: `${p.label} (embedding)`,
        role: 'embedding',
        priority,
        enabled: true,
        apiKey: p.env,
        egressAllowed: false,
        parameters: CHAT_DEFAULTS,
      });
      created += 1;
      priority += 10;
    }
  }
  if (env.CHAT_OLLAMA_BASE_URL) {
    await providerRepo.create({
      kind: 'ollama',
      label: 'Ollama local',
      role: 'chat',
      priority: priority,
      enabled: true,
      apiBase: env.CHAT_OLLAMA_BASE_URL,
      egressAllowed: false,
      parameters: CHAT_DEFAULTS,
    });
    created += 1;
  }
  return {
    created,
    skipped: false,
    message: `${created} provider(s) créé(s)`,
  };
}

async function main(): Promise<void> {
  if (!env.DATABASE_URL) {
    console.error('[seed-chat] DATABASE_URL est requis');
    process.exit(1);
  }
  if (!env.CHAT_PROVIDER_KEY) {
    console.error('[seed-chat] CHAT_PROVIDER_KEY est requis pour chiffrer les clés providers');
    process.exit(1);
  }
  const instr = await runChatInstructionsSeed();
  console.log(`[seed-chat] instruction : ${instr.message}`);
  const theme = await runChatThemeSeed();
  console.log(`[seed-chat] theme : ${theme.message}`);
  const providers = await runChatProvidersSeed();
  console.log(`[seed-chat] providers : ${providers.message}`);
  console.log('[seed-chat] terminé');
}

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMainModule) {
  main().catch((err) => {
    console.error('[seed-chat] erreur', err);
    process.exit(1);
  });
}

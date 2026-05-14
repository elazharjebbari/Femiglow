/**
 * Boot seed — exécute une seule fois par process Node :
 *   - Settings + overrides SEO (13 pages connues + JSON-LD)
 *   - Produits seed (Le Kit + variantes + override produit)
 *   - Delivery cities (~430 villes)
 *   - Chat : instructions v2 + thème + FAQ + pastilles (suggestions)
 *
 * Activé en mode mémoire (pas de DATABASE_URL) ou avec AUTO_SEED=1.
 *
 * À appeler depuis le root layout (RSC) pour que le hook tourne au premier
 * rendu serveur. Le flag global rend l'opération idempotente sur la durée
 * de vie du process.
 */
import { runSeoSeed } from '../../../scripts/seed-seo';
import { runProductsSeed } from '../../../scripts/seed-products';
import { runDeliveryCitiesSeed } from '../../../scripts/seed-delivery-cities';
import { runChatInstructionsV2Seed } from '../../../scripts/seed-chat-instructions-v2';
import { runChatThemeSeed } from '../../../scripts/seed-chat';
import { runChatFaqSeed } from '../../../scripts/seed-chat-faq';
import { runChatCannedPairsSeed } from '../../../scripts/seed-chat-canned-pairs';

declare global {
  // eslint-disable-next-line no-var
  var __femiglowBootSeedDone: boolean | undefined;
}

let seedingPromise: Promise<void> | null = null;

async function doSeed(): Promise<void> {
  try {
    const seoResult = await runSeoSeed(null);
    console.warn(
      `[boot-seed] SEO settings + ${seoResult.overrides} overrides`,
    );
  } catch (err) {
    console.warn('[boot-seed] SEO seed failed:', err);
  }

  try {
    const prodResult = await runProductsSeed(null);
    console.warn(
      `[boot-seed] ${prodResult.products} products + ${prodResult.variants} variants`,
    );
  } catch (err) {
    console.warn('[boot-seed] products seed failed:', err);
  }

  try {
    const citiesResult = await runDeliveryCitiesSeed();
    console.warn(
      `[boot-seed] delivery cities: ${citiesResult.database.inserted} new + ` +
        `${citiesResult.database.updated} updated + ` +
        `${citiesResult.database.skipped} preserved (admin edits)`,
    );
  } catch (err) {
    console.warn('[boot-seed] delivery cities seed failed:', err);
  }

  try {
    const chatV2 = await runChatInstructionsV2Seed();
    console.warn(`[boot-seed] chat instructions v2: ${chatV2.message}`);
  } catch (err) {
    console.warn('[boot-seed] chat instructions v2 seed failed:', err);
  }

  try {
    const chatTheme = await runChatThemeSeed();
    console.warn(`[boot-seed] chat theme: ${chatTheme.message}`);
  } catch (err) {
    console.warn('[boot-seed] chat theme seed failed:', err);
  }

  try {
    const cannedPairs = await runChatCannedPairsSeed({ actorId: 'boot-seed' });
    console.warn(
      `[boot-seed] chat pastilles: ${cannedPairs.inserted} new + ` +
        `${cannedPairs.updated} updated + ${cannedPairs.versioned} versioned ` +
        `(${cannedPairs.skipped} skipped)`,
    );
  } catch (err) {
    console.warn('[boot-seed] chat canned-pairs seed failed:', err);
  }

  try {
    const faq = await runChatFaqSeed();
    if (faq.embeddingModel === null) {
      console.warn(
        `[boot-seed] chat FAQ: ${faq.parsed} parsed, skipped — no embedding provider (set OPENAI_API_KEY to enable)`,
      );
    } else {
      console.warn(
        `[boot-seed] chat FAQ: ${faq.inserted} new + ${faq.updated} updated ` +
          `(model=${faq.embeddingModel})`,
      );
    }
  } catch (err) {
    console.warn('[boot-seed] chat FAQ seed failed:', err);
  }
}

/**
 * Garantit qu'un seul boot-seed s'exécute par process. Idempotent.
 * Renvoie immédiatement si déjà exécuté.
 */
export async function ensureSeedOnce(): Promise<void> {
  if (globalThis.__femiglowBootSeedDone) return;

  const dbUrl = process.env.DATABASE_URL;
  const memoryMode = !dbUrl;
  const explicit = process.env.AUTO_SEED === '1';
  if (!memoryMode && !explicit) {
    globalThis.__femiglowBootSeedDone = true;
    return;
  }

  if (!seedingPromise) {
    seedingPromise = doSeed().then(() => {
      globalThis.__femiglowBootSeedDone = true;
    });
  }
  await seedingPromise;
}

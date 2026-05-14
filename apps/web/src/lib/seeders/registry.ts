/**
 * Registry — source de vérité des 16 seeders disponibles.
 *
 * L'ordre du tableau == l'ordre d'exécution séquentielle. On commence par les
 * sections `app_config` (nav/flags/rbac/branding) qui débloquent l'UI admin
 * dès le premier seeder, puis on déroule les sections lourdes en aval.
 *
 * Convention ETA (cf. `.claude/RUNBOOK-seeders-runner.md`) :
 * - core sections : ~600ms (1 upsert + 2 revalidate)
 * - form-config : ~1.2s (2 upserts + 2 revalidate)
 * - products : ~2s (1 produit + 3 variantes + 1 publish + 1 SEO override)
 * - delivery-cities : ~6s (~430 villes)
 * - seo : ~1.5s (settings + 13 overrides)
 * - components : ~25s (scan docs/, sync registry, optimize media)
 * - media : ~15s (scan docs/, upload, enqueue jobs)
 * - chat-instructions / v2 / theme / providers : ~700ms chacun
 * - tracking : ~4s (scan + upserts events + components + pages)
 * - rituals : ~3s (~50 témoignages avec photos)
 */
import type { SeederDescriptor } from './types';
import {
  brandingSeeder,
  flagsSeeder,
  navigationSeeder,
  rbacSeeder,
} from './items/app-config';
import { formConfigSeeder } from './items/form-config';
import { productsSeeder } from './items/products';
import { deliveryCitiesSeeder } from './items/delivery-cities';
import { seoSeeder } from './items/seo';
import { componentsSeeder } from './items/components';
import { mediaSeeder } from './items/media';
import { chatInstructionsSeeder } from './items/chat-instructions';
import { chatInstructionsV2Seeder } from './items/chat-instructions-v2';
import { chatThemeSeeder } from './items/chat-theme';
import { chatProvidersSeeder } from './items/chat-providers';
import { chatCannedPairsSeeder } from './items/chat-canned-pairs';
import { chatFaqSeeder } from './items/chat-faq';
import { chatIntentsSeeder } from './items/chat-intents';
import { trackingSeeder } from './items/tracking';
import { ritualsSeeder } from './items/rituals';
import { legalSeeder } from './items/legal';
import { eventMappingsSeeder } from './items/event-mappings';

export const SEEDERS_REGISTRY: readonly SeederDescriptor[] = [
  // ── Core ─────────────────────────────────────────────────────────────
  {
    id: 'app-config-navigation',
    group: 'core',
    label: 'Menu (navigation)',
    description:
      'Réinitialise la structure du menu admin et public (sections + items).',
    estimatedDurationMs: 600,
    idempotent: true,
    run: navigationSeeder,
  },
  {
    id: 'app-config-flags',
    group: 'core',
    label: 'Feature flags',
    description:
      'Restaure les flags par défaut (chat enabled, tracking enabled, etc.).',
    estimatedDurationMs: 600,
    idempotent: true,
    run: flagsSeeder,
  },
  {
    id: 'app-config-rbac',
    group: 'core',
    label: 'Rôles & permissions (RBAC)',
    description:
      "Restaure la matrice rôles ↔ permissions (admin, manager, viewer).",
    estimatedDurationMs: 600,
    idempotent: true,
    run: rbacSeeder,
  },
  {
    id: 'app-config-branding',
    group: 'core',
    label: 'Branding (couleurs, typo, voix)',
    description:
      'Réinitialise les paramètres de marque : palette, typo, ton éditorial.',
    estimatedDurationMs: 600,
    idempotent: true,
    run: brandingSeeder,
  },

  // ── Commerce ─────────────────────────────────────────────────────────
  {
    id: 'form-config',
    group: 'commerce',
    label: 'Configs wizard (kit + commander)',
    description:
      'Réamorce wizard_kit et wizard_commander vers leur version de référence.',
    estimatedDurationMs: 1_200,
    idempotent: true,
    run: formConfigSeeder,
  },
  {
    id: 'products',
    group: 'commerce',
    label: 'Produits & variantes',
    description:
      'Crée/met à jour Le Kit FemiGlow + 3 variantes + SEO override produit.',
    estimatedDurationMs: 2_000,
    idempotent: true,
    run: productsSeeder,
  },
  {
    id: 'delivery-cities',
    group: 'commerce',
    label: 'Villes de livraison (~430)',
    description:
      "Importe les villes Sendit. Préserve toute édition admin (source !== 'sendit' jamais écrasé).",
    estimatedDurationMs: 6_000,
    idempotent: true,
    run: deliveryCitiesSeeder,
  },

  // ── Content ──────────────────────────────────────────────────────────
  {
    id: 'seo',
    group: 'content',
    label: 'SEO (settings + 13 overrides)',
    description:
      'Restaure les settings SEO globaux et les 13 overrides éditoriaux.',
    estimatedDurationMs: 1_500,
    idempotent: true,
    run: seoSeeder,
  },
  {
    id: 'components',
    group: 'content',
    label: 'Composants & médias éditoriaux',
    description:
      'Sync du registre composants + animations + médias depuis docs/images/values/.',
    estimatedDurationMs: 25_000,
    idempotent: true,
    run: componentsSeeder,
  },
  {
    id: 'media',
    group: 'content',
    label: 'Médias (originaux + jobs)',
    description:
      "Crée les médias depuis docs/images/values/ et enqueue les jobs d'optimisation.",
    estimatedDurationMs: 15_000,
    idempotent: true,
    run: mediaSeeder,
  },

  // ── Chat ─────────────────────────────────────────────────────────────
  {
    id: 'chat-instructions',
    group: 'chat',
    label: 'Instructions chat (v1, par défaut)',
    description:
      "Crée l'instruction par défaut FR + AR + AR-MA si aucune n'est active.",
    estimatedDurationMs: 700,
    idempotent: true,
    run: chatInstructionsSeeder,
  },
  {
    id: 'chat-instructions-v2',
    group: 'chat',
    label: 'Instructions chat (v2)',
    description:
      "Crée la version v2 de l'instruction default et synchronise les paramètres providers (cf. doc 18).",
    estimatedDurationMs: 800,
    idempotent: true,
    run: chatInstructionsV2Seeder,
  },
  {
    id: 'chat-theme',
    group: 'chat',
    label: 'Theme chat (preset par défaut)',
    description:
      'Crée le preset de theme par défaut (tokens, layout, motion, salutations).',
    estimatedDurationMs: 700,
    idempotent: true,
    run: chatThemeSeeder,
  },
  {
    id: 'chat-providers',
    group: 'chat',
    label: 'Providers chat (.env)',
    description:
      'Crée les providers depuis les clés présentes en .env (OpenAI, Gemini, Anthropic, Mistral, Ollama).',
    estimatedDurationMs: 700,
    idempotent: true,
    run: chatProvidersSeeder,
  },
  {
    id: 'chat-canned-pairs',
    group: 'chat',
    label: 'Pills SuggestionPills (canned pairs V5/V6)',
    description:
      'UPSERT des 12 paires question/réponse pré-écrites depuis docs/dossier-chat-v2 (FR + AR + AR-MA), avec versioning immutable.',
    estimatedDurationMs: 1_200,
    idempotent: true,
    run: chatCannedPairsSeeder,
  },
  {
    id: 'chat-faq',
    group: 'chat',
    label: 'FAQ entries (cascade L3, embeddings)',
    description:
      'UPSERT les entrées FAQ depuis docs/dossier-chat-v2 + calcule les embeddings questions via OpenAI (text-embedding-3-small). Requiert provider embedding.',
    estimatedDurationMs: 3_500,
    idempotent: true,
    run: chatFaqSeeder,
  },
  {
    id: 'chat-intents',
    group: 'chat',
    label: 'Intents centroids (cascade L1)',
    description:
      'INSERT le dataset annoté + calcule les centroids moyens L2-normalisés par intent (langue all, embedding multilingue).',
    estimatedDurationMs: 5_000,
    idempotent: true,
    run: chatIntentsSeeder,
  },

  // ── Tracking ─────────────────────────────────────────────────────────
  {
    id: 'tracking',
    group: 'tracking',
    label: 'Analytics & tracking (events + providers)',
    description:
      'Scan inventaire, upsert event definitions, pages, components, providers (Meta/TikTok/GA4/Ads/Snap/Pinterest).',
    estimatedDurationMs: 4_000,
    idempotent: true,
    run: trackingSeeder,
  },
  {
    id: 'event-mappings',
    group: 'tracking',
    label: 'Factory event mappings (70 events × 6 vendors)',
    description:
      'Charge le mapping factory FemiGlow depuis docs/event-mappings/20-data/default-mapping.json dans event_mapping_versions.__default__. Active __default__ si aucune autre version active.',
    estimatedDurationMs: 1_500,
    idempotent: true,
    run: eventMappingsSeeder,
  },
  {
    id: 'rituals',
    group: 'tracking',
    label: 'Témoignages rituels (wall)',
    description:
      'Insère les ~50 témoignages FemiGlow éditoriaux (idempotent : repérage par hash body).',
    estimatedDurationMs: 3_000,
    idempotent: true,
    run: ritualsSeeder,
  },
  // ── Legal ──────────────────────────────────────────────────────────────
  {
    id: 'legal-pages',
    group: 'content',
    label: 'Pages légales (mentions, CGV, confidentialité, …)',
    description:
      'Insère les 9 pages légales depuis docs/legal-pages/60-content + leurs placements. Préserve les éditions admin.',
    estimatedDurationMs: 2_000,
    idempotent: true,
    run: legalSeeder,
  },
] as const;

export function getSeedersByIds(
  ids: readonly string[],
): SeederDescriptor[] {
  const set = new Set(ids);
  return SEEDERS_REGISTRY.filter((s) => set.has(s.id));
}

export function getAllSeeders(): readonly SeederDescriptor[] {
  return SEEDERS_REGISTRY;
}

export function getSeederIds(): string[] {
  return SEEDERS_REGISTRY.map((s) => s.id);
}

export function getTotalEstimatedDurationMs(
  ids?: readonly string[],
): number {
  const list = ids ? getSeedersByIds(ids) : SEEDERS_REGISTRY;
  return list.reduce((sum, s) => sum + s.estimatedDurationMs, 0);
}

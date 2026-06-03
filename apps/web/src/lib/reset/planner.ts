/**
 * Planner — transforme une ResetConfig en ResetPlan (phases ordonnées, tables ciblées,
 * stratégie DB, liste de seeders à relancer).
 *
 * Cf. docs/reset-feature/03-design-backend.md § Planner
 */
import type {
  ResetConfig,
  ResetPlan,
  PhaseDescriptor,
  PreservableTable,
  DbStrategy,
} from './types';
import { SEEDERS_REGISTRY } from '../seeders/registry';

/** Tables groupées par domaine pour TRUNCATE custom/medium. */
const DOMAIN_TABLES: Record<string, string[]> = {
  commerce: [
    'products', 'product_variants', 'product_snapshots', 'product_stock',
    'form_config', 'form_config_history', 'form_variant_assignment',
    'checkout_idempotency', 'delivery_cities', 'coupons', 'coupon_events', 'coupon_grants',
  ],
  content: [
    'site_components', 'component_field_bindings', 'component_field_history',
    'component_media_bindings', 'component_animations', 'component_animation_bindings',
    'media', 'media_jobs', 'media_tags', 'media_to_tags', 'media_usages', 'media_variants',
    'seo_overrides', 'seo_settings', 'seo_audit_snapshots',
    'ritual_testimonials', 'ritual_testimonial_photos', 'ritual_audit_log', 'ritual_aggregate',
  ],
  tracking: [
    'tracking_components', 'tracking_component_events', 'tracking_consent_snapshots',
    'tracking_event_definitions', 'tracking_events_log', 'tracking_pages',
    'tracking_pages_components', 'tracking_providers', 'tracking_settings',
    'experiments', 'experiment_variants', 'experiment_assignments',
    'insights_event_daily', 'insights_page_daily', 'insights_component_daily',
    'insights_section_daily', 'insights_funnel_daily', 'insights_refresh_run',
  ],
  chat: [
    'chat_session', 'chat_message', 'chat_instruction_version', 'chat_theme_preset',
    'chat_provider_config', 'chat_runtime_setting', 'chat_knowledge_chunk',
    'chat_knowledge_embedding', 'chat_knowledge_source', 'chat_feedback',
    'chat_conversation_event', 'chat_rate_limit_bucket',
  ],
  system: [
    'app_config', 'app_config_snapshots',
  ],
};

/** Mapping seeder id → domaine (utilisé pour filtrer en custom). */
const SEEDER_DOMAIN: Record<string, string> = {
  'app-config-navigation': 'system',
  'app-config-flags': 'system',
  'app-config-rbac': 'system',
  'app-config-branding': 'system',
  'form-config': 'commerce',
  'products': 'commerce',
  'coupons': 'commerce',
  'delivery-cities': 'commerce',
  'seo': 'content',
  'components': 'content',
  'media': 'content',
  'rituals': 'content',
  'chat-instructions': 'chat',
  'chat-instructions-v2': 'chat',
  'chat-theme': 'chat',
  'chat-providers': 'chat',
  'tracking': 'tracking',
};

const PHASE_BASE: Record<string, Omit<PhaseDescriptor, 'name'>> = {
  preflight: {
    label: 'Préflight', critical: true, destructive: false,
    estimatedDurationMs: 1500,
  },
  backup: {
    label: 'Backup', critical: true, destructive: false,
    estimatedDurationMs: 18000,
  },
  'audit-counts': {
    label: 'Audit counts', critical: false, destructive: false,
    estimatedDurationMs: 800,
  },
  'wipe-db': {
    label: 'Wipe DB', critical: true, destructive: true,
    estimatedDurationMs: 4000,
  },
  'wipe-media': {
    label: 'Wipe média', critical: false, destructive: true,
    estimatedDurationMs: 8000,
  },
  'wipe-cache': {
    label: 'Wipe cache Next', critical: false, destructive: true,
    estimatedDurationMs: 1500,
  },
  migrate: {
    label: 'Migrate', critical: true, destructive: false,
    estimatedDurationMs: 4500,
  },
  'ensure-admin': {
    label: 'Ensure super-admin', critical: true, destructive: false,
    estimatedDurationMs: 800,
  },
  seed: {
    label: 'Seed (16 seeders)', critical: true, destructive: false,
    estimatedDurationMs: 62000,
  },
  'publish-components': {
    label: 'Publish components (auto-activate)', critical: false, destructive: false,
    estimatedDurationMs: 1500,
  },
  verify: {
    label: 'Verify post-reset', critical: false, destructive: false,
    estimatedDurationMs: 3000,
  },
  'cleanup-backups': {
    label: 'Cleanup vieux backups', critical: false, destructive: false,
    estimatedDurationMs: 500,
  },
};

export function makePlan(config: ResetConfig): ResetPlan {
  const phaseNames = phaseSequenceFor(config);
  const phases: PhaseDescriptor[] = phaseNames.map((name) => ({
    name,
    ...PHASE_BASE[name]!,
  }));

  const dbStrategy: DbStrategy =
    config.mode === 'hard' ? 'drop-schema'
    : config.mode === 'soft' ? 'none'
    : 'truncate';

  const truncateTables = computeTruncateTables(config);
  const preserveTables = uniquePreserved(config.preserve);
  const seederIds = computeSeederIds(config);
  const totalEtaMs = phases.reduce((s, p) => s + p.estimatedDurationMs, 0);

  return {
    mode: config.mode,
    phases,
    dbStrategy,
    truncateTables,
    preserveTables,
    seederIds,
    totalEtaMs,
  };
}

function phaseSequenceFor(config: ResetConfig): Array<PhaseDescriptor['name']> {
  if (config.mode === 'soft') {
    return ['preflight', 'audit-counts', 'ensure-admin', 'seed', 'publish-components', 'verify'];
  }
  if (config.mode === 'hard') {
    return [
      'preflight', 'backup', 'audit-counts',
      'wipe-db', 'wipe-media', 'wipe-cache',
      'migrate', 'ensure-admin', 'seed', 'publish-components', 'verify', 'cleanup-backups',
    ];
  }
  // medium / custom
  const seq: Array<PhaseDescriptor['name']> = [
    'preflight',
    ...(config.withBackup ? (['backup'] as Array<PhaseDescriptor['name']>) : []),
    'audit-counts',
    'wipe-db',
    ...(config.wipeMedia ? (['wipe-media'] as Array<PhaseDescriptor['name']>) : []),
    ...(config.wipeNextCache ? (['wipe-cache'] as Array<PhaseDescriptor['name']>) : []),
    'ensure-admin',
    'seed',
    'publish-components',
    'verify',
    ...(config.withBackup ? (['cleanup-backups'] as Array<PhaseDescriptor['name']>) : []),
  ];
  return seq;
}

function computeTruncateTables(config: ResetConfig): string[] {
  if (config.mode === 'hard' || config.mode === 'soft') return [];
  if (config.mode === 'medium') {
    const all: string[] = [
      ...(DOMAIN_TABLES.commerce ?? []),
      ...(DOMAIN_TABLES.content ?? []),
      ...(DOMAIN_TABLES.tracking ?? []),
      ...(DOMAIN_TABLES.chat ?? []),
      ...(DOMAIN_TABLES.system ?? []),
    ];
    return excludePreserved(all, config.preserve);
  }
  // custom
  const tables = (config.domains ?? []).flatMap((d) => DOMAIN_TABLES[d] ?? []);
  return excludePreserved(tables, config.preserve);
}

function excludePreserved(tables: string[], preserve: PreservableTable[]): string[] {
  const preserved = new Set<string>(preserve);
  return Array.from(new Set(tables)).filter((t) => !preserved.has(t));
}

function uniquePreserved(preserve: PreservableTable[]): PreservableTable[] {
  return Array.from(new Set(preserve));
}

function computeSeederIds(config: ResetConfig): string[] {
  if (config.mode === 'soft' || config.mode === 'hard' || config.mode === 'medium') {
    return SEEDERS_REGISTRY.map((s) => s.id);
  }
  // custom: filter seeders by selected domains
  const wanted = new Set(config.domains ?? []);
  return SEEDERS_REGISTRY
    .filter((s) => {
      const d = SEEDER_DOMAIN[s.id];
      return d ? wanted.has(d as never) : false;
    })
    .map((s) => s.id);
}

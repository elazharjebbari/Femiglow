#!/usr/bin/env tsx
/**
 * Migration legacy → TrackingPlan v2.
 *
 * Lit les tables legacy (`tracking_providers`, `tracking_event_definitions`,
 * `tracking_settings`) et produit un TrackingPlan v2 en statut `draft`.
 * Le plan résultant peut être inspecté dans l'UI puis activé manuellement
 * via `/admin/tracking/plans/[id]`.
 *
 * Usage :
 *   tsx scripts/migrate-tracking-to-plan.ts [--name "Migration legacy"] [--dry-run]
 *
 * Variables d'env :
 *   - `DATABASE_URL` requis pour cibler la DB ; sinon l'écriture passe par
 *     le MemoryStore (utile pour tests).
 */
import './_load-env.mjs';
import { listTrackingProviders } from '@/lib/db/queries/tracking/providers';
import { listEventDefinitions } from '@/lib/db/queries/tracking/event-definitions';
import { getTrackingSetting } from '@/lib/db/queries/tracking/settings';
import { getTrackingPlanService } from '@/lib/tracking/plan';
import type {
  EnvConfig,
  Provider,
  ProviderId,
  TrackingEvent,
  TrackingPlanInput,
} from '@/lib/tracking/plan/types';
import type {
  TrackingProvider as LegacyProvider,
  TrackingProviderKind,
} from '@/lib/db/types';

const KIND_TO_PLAN_ID: Partial<Record<TrackingProviderKind, ProviderId>> = {
  google_ga4: 'ga4',
  google_ads: 'googleAds',
  meta: 'meta',
  tiktok: 'tiktok',
  gtm: 'gtm',
};

interface MigrationReport {
  planId?: string;
  status: 'created' | 'dry-run';
  providersMapped: number;
  providersSkipped: string[];
  eventsMapped: number;
  envProfilesCreated: number;
  warnings: string[];
}

function mapProviders(legacy: LegacyProvider[]): {
  providers: Provider[];
  envConfig: EnvConfig;
  skipped: string[];
} {
  const providers: Provider[] = [];
  const envConfig: EnvConfig = {};
  const skipped: string[] = [];

  for (const lp of legacy) {
    const planId = KIND_TO_PLAN_ID[lp.kind];
    if (!planId) {
      skipped.push(`${lp.kind} (pas d'équivalent v2)`);
      continue;
    }
    providers.push({ id: planId, active: lp.status === 'enabled' });

    // Récupère l'ID depuis pixelId ou config.measurementId selon le provider.
    const cfg = lp.config ?? {};
    const cfgGet = (k: string): string | undefined => {
      const v = cfg[k];
      return typeof v === 'string' && v.length > 0 ? v : undefined;
    };
    switch (planId) {
      case 'ga4': {
        const id = cfgGet('measurementId') ?? lp.pixelId ?? undefined;
        if (id) envConfig.ga4MeasurementId = id;
        break;
      }
      case 'googleAds': {
        const conv = cfgGet('conversionId') ?? lp.pixelId ?? undefined;
        const label = cfgGet('conversionLabel');
        if (conv) envConfig.googleAdsConversionId = conv;
        if (label) envConfig.googleAdsConversionLabel = label;
        break;
      }
      case 'meta': {
        if (lp.pixelId) envConfig.metaPixelId = lp.pixelId;
        break;
      }
      case 'tiktok': {
        if (lp.pixelId) envConfig.tiktokPixelId = lp.pixelId;
        break;
      }
      case 'gtm': {
        const ctn = cfgGet('containerId') ?? lp.pixelId ?? undefined;
        if (ctn) envConfig.gtmContainerId = ctn;
        break;
      }
    }
  }
  return { providers, envConfig, skipped };
}

function mapEvents(
  defs: Array<{ name: string; defaultProviders: string[] }>,
  knownProviderIds: ReadonlyArray<ProviderId>,
): TrackingEvent[] {
  const set = new Set(knownProviderIds);
  return defs
    .filter((d) => /^[a-z][a-z0-9_]*$/.test(d.name))
    .map((d) => {
      const providers: Record<string, boolean> = {};
      for (const dp of d.defaultProviders) {
        const mapped = KIND_TO_PLAN_ID[dp as TrackingProviderKind];
        if (mapped && set.has(mapped)) providers[mapped] = true;
      }
      return { key: d.name, providers } as TrackingEvent;
    });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const nameFlag = args.indexOf('--name');
  const planName =
    nameFlag !== -1 && args[nameFlag + 1] ? (args[nameFlag + 1] as string) : 'Migration legacy';
  const actor = process.env.MIGRATION_ACTOR ?? 'migration@femiglow.local';

  console.log(`[migrate-tracking-to-plan] name="${planName}" dry-run=${dryRun}`);

  const [legacyProviders, eventDefs, consentModeValue] = await Promise.all([
    listTrackingProviders(),
    listEventDefinitions(),
    getTrackingSetting<string>('consentMode', 'v2'),
  ]);

  const { providers, envConfig, skipped } = mapProviders(legacyProviders);
  if (providers.length === 0) {
    throw new Error(
      'Aucun provider legacy mappable trouvé. Seed-tracking est-il exécuté ? Adapte ou abandonne.',
    );
  }
  const providerIds = providers.map((p) => p.id) as ProviderId[];
  const events = mapEvents(eventDefs, providerIds);

  const input: TrackingPlanInput = {
    name: planName,
    providers,
    envProfiles: [
      { env: 'production', config: envConfig },
      { env: 'staging', config: {} },
      { env: 'local', config: {} },
    ],
    events,
    settings: { consentMode: consentModeValue === 'v1' ? 'v1' : 'v2' },
  };

  const warnings: string[] = [];
  if (Object.keys(envConfig).length === 0) {
    warnings.push('envProfile.production.config vide — aucun ID legacy détecté.');
  }
  if (events.length === 0) {
    warnings.push('Aucun event mappable depuis tracking_event_definitions.');
  }

  const report: MigrationReport = {
    status: dryRun ? 'dry-run' : 'created',
    providersMapped: providers.length,
    providersSkipped: skipped,
    eventsMapped: events.length,
    envProfilesCreated: input.envProfiles.length,
    warnings,
  };

  if (dryRun) {
    console.log(JSON.stringify({ report, input }, null, 2));
    return;
  }

  const service = getTrackingPlanService();
  const plan = await service.create(input, actor);
  report.planId = plan.id;
  console.log('[migrate-tracking-to-plan] OK', report);
  console.log(`Inspectez le plan : /admin/tracking/plans/${plan.id}`);
}

const isMain =
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  main().catch((err) => {
    console.error('[migrate-tracking-to-plan] failed:', err);
    process.exit(1);
  });
}

export { mapProviders, mapEvents };

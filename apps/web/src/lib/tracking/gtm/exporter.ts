/**
 * Service exporter GTM — point d'entrée unique pour la couche admin
 * (route API et UI `/admin/tracking/gtm`) et le CLI
 * (`docs/gtm/scripts/gtm-generate.ts`).
 *
 * Cf. docs/gtm/14-admin-export.md §6.
 */

import { buildContainer, type BuildOptions, ENV_DEFAULTS } from './builders';
import { prettyPrint, minified } from './pretty';
import { computeStats, computeMeta } from './stats';
import type { GtmContainer, GtmEnvironment, GtmStats, GtmMeta } from './types';

export interface GtmExport {
  container: GtmContainer;
  pretty: string;
  minified: string;
  stats: GtmStats;
  meta: GtmMeta;
  env: GtmEnvironment;
}

export const gtmExporter = {
  build(opts: BuildOptions): GtmExport {
    const container = buildContainer(opts);
    const pretty = prettyPrint(container);
    const min = minified(container);
    const stats = computeStats(container);
    const meta = computeMeta(pretty);
    return { container, pretty, minified: min, stats, meta, env: opts.env };
  },

  envs(): GtmEnvironment[] {
    return Object.keys(ENV_DEFAULTS) as GtmEnvironment[];
  },
};

export type { GtmEnvironment, GtmStats, GtmMeta } from './types';

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
import { lintContainer, type LintReport } from './linter';
import type { GtmContainer, GtmEnvironment, GtmStats, GtmMeta } from './types';
import type { GtmEnvConfigDTO } from './config-schema';

export interface GtmExport {
  container: GtmContainer;
  pretty: string;
  minified: string;
  stats: GtmStats;
  meta: GtmMeta;
  env: GtmEnvironment;
  lintReport: LintReport;
}

export const gtmExporter = {
  build(opts: BuildOptions): GtmExport {
    const container = buildContainer(opts);
    const pretty = prettyPrint(container);
    const min = minified(container);
    const stats = computeStats(container);
    const meta = computeMeta(pretty);
    const lintReport = lintContainer({
      container,
      envConfig: (opts.config as GtmEnvConfigDTO | undefined) ?? undefined,
    });
    return { container, pretty, minified: min, stats, meta, env: opts.env, lintReport };
  },

  envs(): GtmEnvironment[] {
    return Object.keys(ENV_DEFAULTS) as GtmEnvironment[];
  },
};

export type { GtmEnvironment, GtmStats, GtmMeta } from './types';
export type { LintReport, LintIssue } from './linter';

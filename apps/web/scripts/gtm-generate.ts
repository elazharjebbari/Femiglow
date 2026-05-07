#!/usr/bin/env tsx
/**
 * Générateur CLI du `container.json` GTM.
 *
 * Usage :
 *   pnpm --filter @femiglow/web tsx scripts/gtm-generate.ts \
 *     [--env production|stage|preview|dev] \
 *     [--out infra/gtm/container.<env>.json] \
 *     [--minified]
 *
 * Le builder est partagé avec la route admin
 * `/api/admin/tracking/gtm/container` via `lib/tracking/gtm/exporter.ts`.
 *
 * Cf. docs/gtm/10-automatisation.md, docs/gtm/14-admin-export.md.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { gtmExporter, type GtmEnvironment } from '../src/lib/tracking/gtm/exporter';

interface Args {
  env: GtmEnvironment;
  out: string;
  minified: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> & Record<string, unknown> = { env: 'production', minified: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--minified') {
      out.minified = true;
      continue;
    }
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2);
      out[k] = v ?? argv[++i];
    }
  }
  const env = (out.env ?? 'production') as GtmEnvironment;
  const filename = `container.${env}.json`;
  return {
    env,
    out: (out.out as string) ?? path.join('infra', 'gtm', filename),
    minified: !!out.minified,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const exp = gtmExporter.build({ env: args.env });
  const body = args.minified ? exp.minified : exp.pretty;

  await fs.mkdir(path.dirname(args.out), { recursive: true });
  await fs.writeFile(args.out, body);

  // eslint-disable-next-line no-console
  console.log(
    [
      `✓ env=${exp.env}`,
      `  tags=${exp.stats.tags}`,
      `  triggers=${exp.stats.triggers}`,
      `  variables=${exp.stats.variables}`,
      `  size=${exp.meta.sizeBytes}B (${exp.meta.lineCount} lignes)`,
      `  sha256=${exp.meta.sha256.slice(0, 16)}…`,
      `  → ${args.out}`,
    ].join('\n'),
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('✗', err);
  process.exit(1);
});

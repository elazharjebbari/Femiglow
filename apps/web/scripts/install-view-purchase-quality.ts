#!/usr/bin/env tsx
/**
 * Installe (CREATE OR REPLACE) la vue SQL `v_purchase_quality` qui mesure
 * la qualité des events Purchase (value/currency) côté DB, en miroir de
 * la métrique Meta Events Manager.
 *
 * Usage:
 *   pnpm --filter @femiglow/web db:install-purchase-view
 *
 * Idempotent: peut être ré-exécuté sans risque (CREATE OR REPLACE).
 *
 * cf. docs/meta-quality-audit-2026-05/01-design-conception.md §4.2
 */
import './_load-env.mjs';

import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const sqlPath = path.resolve(
    process.cwd(),
    'drizzle/sql/views/purchase_quality.sql',
  );
  const sql = await fs.readFile(sqlPath, 'utf8');

  const client = postgres(url, { prepare: false, max: 1 });
  try {
    await client.unsafe(sql);
    // eslint-disable-next-line no-console
    console.log('✓ View v_purchase_quality installed');
    const rows = await client`SELECT count(*) FROM v_purchase_quality`;
    // eslint-disable-next-line no-console
    console.log(`  Currently aggregates ${rows[0]?.count ?? 0} day-event groups.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('install-view-purchase-quality failed:', err);
  process.exit(1);
});

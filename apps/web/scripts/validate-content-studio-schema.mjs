#!/usr/bin/env node
/**
 * Validates the staging DB contract needed by the AI Content Studio.
 *
 * This complements the generic migration-folder validator by checking the
 * live database shape that previously broke staging (`parentDraftId` vs
 * `parentId`). It prints only schema metadata and never prints secrets.
 */
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing. Run with: node --env-file=.env scripts/validate-content-studio-schema.mjs');
  process.exit(2);
}

const sql = postgres(url, { max: 1, idle_timeout: 5 });

const expectedColumns = [
  ['content_campaign', 'id'],
  ['content_campaign', 'name'],
  ['content_idea', 'campaign_id'],
  ['content_idea', 'rejectionReason'],
  ['content_draft', 'rejectionReason'],
  ['content_draft', 'parentDraftId'],
  ['content_post', 'cancelledBy'],
  ['content_post', 'cancelledAt'],
  ['content_post', 'cancelReason'],
  ['content_brand_review', 'reviewerId'],
  ['content_brand_review', 'reviewType'],
  ['content_idempotency_key', 'key'],
  ['content_idempotency_key', 'response_json'],
  ['content_idempotency_key', 'expires_at'],
];

const expectedIndexes = [
  'idx_content_draft_parent',
  'idx_content_post_status',
  'idx_content_idea_status',
  'content_idempotency_key_expires_idx',
];

const failures = [];

try {
  for (const [table, column] of expectedColumns) {
    const rows = await sql`
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${table}
        and column_name = ${column}
      limit 1
    `;
    if (rows.length === 0) failures.push(`missing column public.${table}."${column}"`);
  }

  for (const indexName of expectedIndexes) {
    const rows = await sql`
      select 1
      from pg_indexes
      where schemaname = 'public'
        and indexname = ${indexName}
      limit 1
    `;
    if (rows.length === 0) failures.push(`missing index public.${indexName}`);
  }

  if (failures.length > 0) {
    console.error('Content Studio schema validation failed:');
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    process.exit(2);
  }

  console.log(`✓ Content Studio schema validation passed (${expectedColumns.length} columns, ${expectedIndexes.length} indexes).`);
} finally {
  await sql.end().catch(() => {});
}

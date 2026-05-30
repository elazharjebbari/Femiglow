#!/usr/bin/env node
/**
 * Bundle size check — bloque CI si bundle widget chat > 80 KB gzip.
 *
 * Référence : `docs/chat-test-strategy-2026-05/04-execution-plan/05-phase-5-perf-load.md` §J42
 *
 * Usage :
 *   pnpm build
 *   node scripts/perf/check-bundle-size.mjs
 *
 * En CI : ajouter step `- run: node scripts/perf/check-bundle-size.mjs`
 */
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const BUDGETS = {
  'chat-widget': 80 * 1024,    // 80 KB gzip
  'route-kit':    250 * 1024,   // 250 KB gzip pour route entière /kit
};

const NEXT_DIR = resolve(process.cwd(), '.next');

function findChunks(dir, predicate) {
  const out = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = resolve(dir, e.name);
      if (e.isDirectory()) out.push(...findChunks(full, predicate));
      else if (predicate(e.name)) out.push(full);
    }
  } catch {
    /* ignore */
  }
  return out;
}

const chatChunks = findChunks(
  resolve(NEXT_DIR, 'static/chunks'),
  (name) => /Chat|chat|widget/i.test(name) && name.endsWith('.js'),
);

let totalGzip = 0;
for (const f of chatChunks) {
  const buf = readFileSync(f);
  const gz = gzipSync(buf).length;
  totalGzip += gz;
}

console.log(`[bundle-size] Widget chat (gzip total) : ${(totalGzip / 1024).toFixed(1)} KB`);
console.log(`[bundle-size] Budget                     : ${(BUDGETS['chat-widget'] / 1024).toFixed(0)} KB`);

if (totalGzip > BUDGETS['chat-widget']) {
  console.error(`❌ Bundle widget chat dépasse le budget de ${((totalGzip - BUDGETS['chat-widget']) / 1024).toFixed(1)} KB`);
  process.exit(1);
}

console.log('✅ Bundle size OK');

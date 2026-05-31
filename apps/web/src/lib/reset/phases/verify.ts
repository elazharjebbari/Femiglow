/**
 * Phase verify — checks post-reset.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { PhaseContext, PhaseResult, VerificationCheck } from '../types';
import { db } from '@/lib/db/client';
import { rowsOf } from '@/lib/db/exec';
import { sql } from 'drizzle-orm';

export async function runVerify(ctx: PhaseContext): Promise<PhaseResult> {
  const checks: VerificationCheck[] = [];
  const conn = db();
  if (!conn) {
    return {
      stats: { skipped: true },
      summary: 'no DB (memory mode)',
    };
  }

  // 1. drizzle migrations applied
  try {
    const r = await conn.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`);
    const row = rowsOf<{ n: number }>(r)[0];
    checks.push({
      id: 'migrations_applied',
      label: 'Migrations appliquées',
      status: (row?.n ?? 0) >= 1 ? 'pass' : 'fail',
      critical: true,
      message: `__drizzle_migrations count = ${row?.n ?? 0}`,
    });
  } catch (e) {
    checks.push({
      id: 'migrations_applied', label: 'Migrations appliquées',
      status: 'fail', critical: true, message: errMsg(e),
    });
  }

  // 2. admin_users present
  try {
    const r = await conn.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM admin_users`);
    const n = rowsOf<{ n: number }>(r)[0]?.n ?? 0;
    checks.push({
      id: 'admin_users_present', label: 'Admin user présent',
      status: n >= 1 ? 'pass' : 'fail', critical: true,
      message: `admin_users count = ${n}`,
    });
  } catch (e) {
    checks.push({ id: 'admin_users_present', label: 'Admin user présent', status: 'fail', critical: true, message: errMsg(e) });
  }

  // 3. kit product present
  try {
    const r = await conn.execute<{ id: string; slug: string }>(sql`SELECT id, slug FROM products WHERE slug IN ('kit','le-kit') LIMIT 1`);
    const row = rowsOf<{ id: string; slug: string }>(r)[0];
    checks.push({
      id: 'kit_product_present', label: 'Produit Pack FemiGlow',
      status: row ? 'pass' : 'fail', critical: true,
      message: row ? `slug=${row.slug}` : 'pas de produit kit',
    });
  } catch (e) {
    checks.push({ id: 'kit_product_present', label: 'Produit Pack FemiGlow', status: 'fail', critical: true, message: errMsg(e) });
  }

  // 4. FEMI-KIT-100 price = 199 dh
  try {
    const r = await conn.execute<{ sku: string; price_cents: number; promo_price_cents: number | null }>(sql`
      SELECT sku, price_cents, promo_price_cents
      FROM product_variants WHERE sku = 'FEMI-KIT-100' LIMIT 1
    `);
    const row = rowsOf<{ sku: string; price_cents: number; promo_price_cents: number | null }>(r)[0];
    const ok = row?.promo_price_cents === 19900;
    checks.push({
      id: 'kit_variant_price', label: 'FEMI-KIT-100 = 199 dh',
      status: ok ? 'pass' : 'fail', critical: true,
      message: row ? `promo=${row.promo_price_cents} cents` : 'variante absente',
    });
  } catch (e) {
    checks.push({ id: 'kit_variant_price', label: 'FEMI-KIT-100 = 199 dh', status: 'fail', critical: true, message: errMsg(e) });
  }

  // 5. stale FEMI-KIT-30 absent
  try {
    const r = await conn.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM product_variants WHERE sku = 'FEMI-KIT-30'`);
    const n = rowsOf<{ n: number }>(r)[0]?.n ?? 0;
    checks.push({
      id: 'stale_kit_30_absent', label: 'Variante stale FEMI-KIT-30 absente',
      status: n === 0 ? 'pass' : 'warn',
      critical: false,
      message: `count = ${n}`,
    });
  } catch (e) {
    checks.push({ id: 'stale_kit_30_absent', label: 'Variante stale FEMI-KIT-30 absente', status: 'warn', critical: false, message: errMsg(e) });
  }

  // 6. delivery_cities seeded
  try {
    const r = await conn.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM delivery_cities`);
    const n = rowsOf<{ n: number }>(r)[0]?.n ?? 0;
    checks.push({
      id: 'delivery_cities_seeded', label: 'Villes de livraison seedées',
      status: n >= 100 ? 'pass' : n > 0 ? 'warn' : 'fail',
      critical: false,
      message: `count = ${n}`,
    });
  } catch (e) {
    checks.push({ id: 'delivery_cities_seeded', label: 'Villes de livraison seedées', status: 'warn', critical: false, message: errMsg(e) });
  }

  // 7. media row + file on disk for kit hero
  try {
    const r = await conn.execute<{ id: string }>(sql`SELECT id FROM media WHERE slug = 'kit-kit-principale' LIMIT 1`);
    const row = rowsOf<{ id: string }>(r)[0];
    if (!row) {
      checks.push({
        id: 'kit_hero_media', label: 'Média kit-principale existant',
        status: 'warn', critical: false, message: 'pas trouvé en DB',
      });
    } else {
      const mediaDir = process.env.MEDIA_LOCAL_DIR || '/var/www/femiglow/.media-storage';
      const filePath = path.join(mediaDir, 'media', row.id, 'jpeg', 'lg.jpeg');
      const exists = existsSync(filePath);
      checks.push({
        id: 'kit_hero_media', label: 'Média kit-principale fichier disque',
        status: exists ? 'pass' : 'warn', critical: false,
        message: exists ? row.id : `file missing: ${filePath}`,
      });
    }
  } catch (e) {
    checks.push({ id: 'kit_hero_media', label: 'Média kit-principale', status: 'warn', critical: false, message: errMsg(e) });
  }

  // 8. HTTP /kit (best-effort via fetch interne)
  try {
    const port = process.env.PORT || '8011';
    const url = `http://127.0.0.1:${port}/kit`;
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
    const body = await res.text();
    const has199 = /199[,.\s]?(MAD|dh)/i.test(body) || /199 MAD/i.test(body);
    checks.push({
      id: 'http_kit_200', label: `${url} renvoie 200 avec 199`,
      status: res.status === 200 && has199 ? 'pass' : 'warn', critical: false,
      message: `HTTP ${res.status}${has199 ? ' · 199 trouvé' : ' · 199 absent'}`,
    });
  } catch (e) {
    checks.push({ id: 'http_kit_200', label: 'HTTP /kit', status: 'warn', critical: false, message: errMsg(e) });
  }

  // 9. HTTP /admin/login
  try {
    const port = process.env.PORT || '8011';
    const url = `http://127.0.0.1:${port}/admin/login`;
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3000) });
    checks.push({
      id: 'http_admin_login_200', label: '/admin/login renvoie 200',
      status: res.status === 200 ? 'pass' : 'warn', critical: false,
      message: `HTTP ${res.status}`,
    });
  } catch (e) {
    checks.push({ id: 'http_admin_login_200', label: '/admin/login', status: 'warn', critical: false, message: errMsg(e) });
  }

  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const warnings = checks.filter((c) => c.status === 'warn').length;

  ctx.onProgress?.('verify done', 1);

  return {
    stats: { passed, failed, warnings, checks: checks as unknown as never },
    summary: `${passed} ok · ${warnings} warn · ${failed} fail`,
    warnings: failed > 0
      ? checks.filter((c) => c.status === 'fail').map((c) => `${c.id}: ${c.message ?? ''}`)
      : undefined,
  };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

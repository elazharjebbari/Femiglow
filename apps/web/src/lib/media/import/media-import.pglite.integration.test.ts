// @vitest-environment node
/**
 * Test d'intégration — vrai chemin SQL (PGlite, Postgres in-process) de la
 * PR 3 : requêtes `findMediaBySourceChecksum` (JSONB `overrides`) et
 * `listImageMediaWithoutBlur` (curseur), backfill du flou, et import complet
 * (ingestion + brouillons transactionnels + publication) avec idempotence.
 *
 * Socle : mêmes tables minimales que `component-media-sets.pglite.integration.test.ts`
 * + migration 0087 appliquée telle quelle.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import { __resetTestDb, __setTestDb, schema } from '@/lib/db/client';
import { upsertSiteComponentFromSeed } from '@/lib/db/queries/site-components';
import {
  createMedia,
  findMediaById,
  findMediaBySourceChecksum,
  listImageMediaWithoutBlur,
  softDeleteMedia,
  updateMedia,
} from '@/lib/db/queries/media';
import { listPublishedSetsWithMedia, listSetsByComponent } from '@/lib/db/queries/component-media-sets';
import { findComponentSeed } from '@/lib/components/registry';
import type { StorageAdapter } from '@/lib/media/storage';
import { backfillMediaBlur } from '@/lib/media/blur-backfill';
import { runComponentMediaImport } from './run-component-media-import';

const MIGRATION = path.resolve(__dirname, '../../../../drizzle/migrations/0087_component_media_sets.sql');
const KIT = 'kit-hero-produit';

const BASE_DDL = `
CREATE TYPE field_binding_status AS ENUM ('draft','published','scheduled','archived');
CREATE TYPE field_history_action AS ENUM ('create','update','publish','unpublish','restore','archive','schedule','unschedule');
CREATE TYPE media_object_position AS ENUM ('center','top','bottom','left','right','top left','top right','bottom left','bottom right');
CREATE TABLE admin_users (id text PRIMARY KEY);
CREATE TABLE site_components (
  id text PRIMARY KEY, key text NOT NULL UNIQUE, name text NOT NULL, description text,
  category text NOT NULL, page_group text NOT NULL, file_path text,
  slots jsonb NOT NULL DEFAULT '[]', fields jsonb NOT NULL DEFAULT '[]',
  default_svg_fallback text, default_loading_strategy text NOT NULL DEFAULT 'viewport',
  default_fetch_priority text NOT NULL DEFAULT 'auto', supports_animation boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE media (
  id text PRIMARY KEY, kind text NOT NULL, source text NOT NULL, slug text NOT NULL,
  original_url text, original_filename text, original_size_bytes bigint, original_mime text,
  original_width integer, original_height integer, original_duration_ms integer, phash text,
  blurhash text, palette jsonb NOT NULL DEFAULT '[]', alt text NOT NULL, caption text, credit text,
  status text NOT NULL DEFAULT 'pending', failure_reason text,
  quality_profile text NOT NULL DEFAULT 'inline', loading_strategy text NOT NULL DEFAULT 'viewport',
  is_hero boolean NOT NULL DEFAULT false, overrides jsonb NOT NULL DEFAULT '{}',
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE UNIQUE INDEX media_slug_unique ON media (slug) WHERE deleted_at IS NULL;
CREATE TABLE media_variants (
  id text PRIMARY KEY, media_id text NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  format text NOT NULL, breakpoint text, width integer, height integer, bitrate_kbps integer,
  quality integer, size_bytes bigint NOT NULL, url text NOT NULL, checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

function memStorage(): StorageAdapter {
  const files = new Map<string, Buffer>();
  return {
    driver: 'local',
    async put({ key, body }) {
      files.set(key, body);
      return { key, url: `mem://${key}`, sizeBytes: body.byteLength };
    },
    async delete(key) {
      files.delete(key);
    },
    publicUrl(key) {
      return `mem://${key}`;
    },
    async get(key) {
      const f = files.get(key);
      if (!f) throw new Error(`absent: ${key}`);
      return f;
    },
  };
}

async function png(color: string, width = 24, height = 30): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
}

let client: PGlite;
let db: ReturnType<typeof drizzlePglite<typeof schema>>;
let componentId: string;
let root: string;
let storage: StorageAdapter;

beforeAll(async () => {
  client = new PGlite();
  await client.exec(BASE_DDL);
  for (const stmt of readFileSync(MIGRATION, 'utf8').split('--> statement-breakpoint')) {
    if (stmt.trim()) await client.exec(stmt);
  }
  db = drizzlePglite(client, { schema });
  __setTestDb(db as unknown as Parameters<typeof __setTestDb>[0]);
});

afterAll(async () => {
  __resetTestDb();
  await client.close();
});

beforeEach(async () => {
  await db.execute(
    sql.raw(
      'TRUNCATE component_media_set_history, component_media_set_items, component_media_sets, media_variants, media, site_components CASCADE',
    ),
  );
  componentId = (await upsertSiteComponentFromSeed(findComponentSeed(KIT)!)).id;
  storage = memStorage();
  root = await mkdtemp(path.join(os.tmpdir(), 'cmv-pglite-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function put(rel: string, body: Buffer | string): Promise<void> {
  const abs = path.join(root, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, body);
}

describe('requêtes média (PGlite)', () => {
  it('findMediaBySourceChecksum : image non supprimée, la plus ancienne', async () => {
    const a = await createMedia({ kind: 'image', source: 'upload', slug: 'a', alt: 'a', overrides: { sourceChecksum: 'sha256-x' } });
    await createMedia({ kind: 'image', source: 'upload', slug: 'b', alt: 'b', overrides: { sourceChecksum: 'sha256-y' } });
    expect((await findMediaBySourceChecksum('sha256-x'))?.id).toBe(a.id);
    expect(await findMediaBySourceChecksum('sha256-z')).toBeNull();
    await softDeleteMedia(a.id);
    expect(await findMediaBySourceChecksum('sha256-x')).toBeNull();
  });

  it('listImageMediaWithoutBlur : filtre et curseur par id', async () => {
    const ids: string[] = [];
    for (const slug of ['m1', 'm2', 'm3']) {
      ids.push((await createMedia({ kind: 'image', source: 'upload', slug, alt: slug, status: 'ready' })).id);
    }
    const done = await createMedia({ kind: 'image', source: 'upload', slug: 'done', alt: 'd', status: 'ready' });
    await updateMedia(done.id, { blurDataUrl: 'data:image/webp;base64,AA==' });
    await createMedia({ kind: 'image', source: 'upload', slug: 'pending', alt: 'p' });
    await createMedia({ kind: 'video', source: 'upload', slug: 'video', alt: 'v', status: 'ready' });

    const sorted = [...ids].sort();
    const first = await listImageMediaWithoutBlur({ limit: 2 });
    expect(first.map((m) => m.id)).toEqual(sorted.slice(0, 2));
    const next = await listImageMediaWithoutBlur({ afterId: first[1]!.id, limit: 2 });
    expect(next.map((m) => m.id)).toEqual(sorted.slice(2));
  });
});

describe('import + backfill (PGlite)', () => {
  it('importe en brouillon, est idempotent, publie, et le backfill n’a rien à faire', async () => {
    const shared = await png('#d0b090');
    await put(`${KIT}/primary/angle-a/_all/01-reflet.png`, await png('#f0c0c0'));
    await put(`${KIT}/primary/angle-a/_all/01-reflet.mobile.png`, await png('#f0c0c1', 24, 32));
    await put(`${KIT}/primary/angle-a/_all/01-reflet.alt.json`, JSON.stringify({ fr: 'Reflet', ar: 'لمعان', en: 'Shine' }));
    await put(`${KIT}/secondary/angle-a/_all/01-kit.png`, shared);
    await put(`${KIT}/secondary/default/_all/01-kit.png`, shared);
    await put(`${KIT}/secondary/default/_all/_alt.json`, JSON.stringify({ fr: 'Kit', ar: 'كيت', en: 'Kit' }));

    const opts = {
      root,
      componentKey: KIT,
      storage,
      optimize: { breakpoints: ['sm' as const], formats: ['webp' as const] },
    };
    const first = await runComponentMediaImport(opts);
    expect(first.errors).toEqual([]);
    expect(first.summary).toMatchObject({ files: 4, mediaCreated: 3, mediaDeduped: 1, setsCreated: 3 });

    const sets = await listSetsByComponent(componentId);
    expect(sets.map((s) => [s.slot, s.variantDim, s.variantKey, s.locale, s.status, s.source])).toEqual(
      expect.arrayContaining([
        ['primary', 'angle', 'a', '*', 'draft', 'import'],
        ['secondary', 'angle', 'a', '*', 'draft', 'import'],
        ['secondary', 'default', '*', '*', 'draft', 'import'],
      ]),
    );
    const primary = sets.find((s) => s.slot === 'primary')!;
    const media = await findMediaById(primary.items[0]!.mediaId);
    expect(media?.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(primary.items[0]?.mobileMediaId).toBeTruthy();

    const second = await runComponentMediaImport(opts);
    expect(second.summary).toMatchObject({ mediaCreated: 0, mediaSkipped: 3, mediaDeduped: 1, setsUnchanged: 3 });

    const published = await runComponentMediaImport({ ...opts, publish: true });
    expect(published.summary.setsPublished).toBe(3);
    expect(await listPublishedSetsWithMedia(componentId)).toHaveLength(3);

    const backfill = await backfillMediaBlur({ storage });
    expect(backfill.scanned).toBe(0);
  }, 60_000);
});

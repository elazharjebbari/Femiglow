// @vitest-environment node
/**
 * Test d'intégration — exerce le VRAI chemin SQL des ensembles de médias par
 * audience contre un Postgres in-process (PGlite), sans base distante.
 *
 * La migration `0087_component_media_sets.sql` est appliquée TELLE QUELLE
 * (même découpage `--> statement-breakpoint` que `_migrate-safe`) sur un
 * socle minimal des tables qu'elle référence. On vérifie ainsi :
 *  - les index uniques partiels (un publié + un brouillon par tuple) ;
 *  - la FK `ON DELETE RESTRICT` vers `media` ;
 *  - la publication transactionnelle (rollback réel) ;
 *  - la requête unique de lecture (jointure items × médias × variants).
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §5
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';

import { __resetTestDb, __setTestDb, schema } from '@/lib/db/client';
import { upsertSiteComponentFromSeed } from '@/lib/db/queries/site-components';
import { createMedia, hardDeleteMedia, MediaInUseError, softDeleteMedia } from '@/lib/db/queries/media';
import { createVariant } from '@/lib/db/queries/media-variants';
import { KIT_HERO_MEDIA_VARIANTS, type SiteComponentSeed } from '@/lib/components/registry';
import type { Media } from '@/lib/db/types';
import {
  discardDraft,
  getSetById,
  listPublishedSetsWithMedia,
  listSetsByComponent,
  MediaSetConflictError,
  MediaSetValidationError,
  promoteDueMediaSets,
  publishSet,
  restoreSetFromHistory,
  listSetHistory,
  scheduleSet,
  unpublishSet,
  upsertDraftSet,
} from './component-media-sets';

const MIGRATION = resolve(__dirname, '../../../../drizzle/migrations/0087_component_media_sets.sql');

/** Socle minimal : uniquement ce que la migration 0087 référence. */
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
CREATE TABLE media_variants (
  id text PRIMARY KEY, media_id text NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  format text NOT NULL, breakpoint text, width integer, height integer, bitrate_kbps integer,
  quality integer, size_bytes bigint NOT NULL, url text NOT NULL, checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

const SEED: SiteComponentSeed = {
  key: 'kit-hero-produit',
  name: 'Hero Kit (produit)',
  description: 'test',
  category: 'hero',
  pageGroup: 'kit',
  filePath: 'src/components/sections/HeroProduit.tsx',
  slots: [
    { key: 'primary', label: 'Primary', required: true, acceptKinds: ['image'] },
    { key: 'context_1', label: 'C1', required: false, acceptKinds: ['image'] },
    { key: 'context_2', label: 'C2', required: false, acceptKinds: ['image'] },
  ],
  defaultSvgFallback: null,
  defaultLoadingStrategy: 'eager',
  defaultFetchPriority: 'high',
  supportsAnimation: true,
  mediaVariants: KIT_HERO_MEDIA_VARIANTS,
};

let client: PGlite;
let db: ReturnType<typeof drizzlePglite<typeof schema>>;
let componentId: string;
let m1: Media;
let m2: Media;

async function makeMedia(slug: string): Promise<Media> {
  const m = await createMedia({ kind: 'image', source: 'upload', slug, alt: `Alt ${slug}`, status: 'ready' });
  await createVariant({
    mediaId: m.id,
    format: 'webp',
    breakpoint: 'lg',
    sizeBytes: 1000,
    url: `/_media/${slug}/lg.webp`,
    checksum: slug,
  });
  await createVariant({
    mediaId: m.id,
    format: 'avif',
    breakpoint: 'lg',
    sizeBytes: 800,
    url: `/_media/${slug}/lg.avif`,
    checksum: `${slug}-avif`,
  });
  return m;
}

function draftInput(overrides: Partial<Parameters<typeof upsertDraftSet>[0]> = {}) {
  return {
    componentId,
    slot: 'primary',
    variantDim: 'angle',
    variantKey: 'e',
    locale: 'ar',
    items: [{ mediaId: m1.id }],
    authorId: null,
    ...overrides,
  };
}

beforeAll(async () => {
  client = new PGlite();
  await client.exec(BASE_DDL);
  // Migration appliquée telle quelle, instruction par instruction.
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
  componentId = (await upsertSiteComponentFromSeed(SEED)).id;
  m1 = await makeMedia('m1');
  m2 = await makeMedia('m2');
});

describe('component_media_sets — intégration PGlite (vrai chemin SQL)', () => {
  it('la migration ajoute media.blur_data_url (nullable)', async () => {
    const rows = await db.execute<{ is_nullable: string }>(
      sql.raw(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'media' AND column_name = 'blur_data_url'",
      ),
    );
    expect(rows.rows[0]?.is_nullable).toBe('YES');
  });

  it('index partiel : un second brouillon brut pour le même tuple est refusé par Postgres', async () => {
    const d = await upsertDraftSet(draftInput());
    await expect(
      db.insert(schema.componentMediaSets).values({
        id: 'cms_dup',
        componentId,
        slot: d.slot,
        variantDim: d.variantDim,
        variantKey: d.variantKey,
        locale: d.locale,
        status: 'draft',
      }),
    ).rejects.toThrow();
    // …mais un archivé supplémentaire est accepté (index partiel, pas global).
    await db.insert(schema.componentMediaSets).values({
      id: 'cms_arch',
      componentId,
      slot: d.slot,
      variantDim: d.variantDim,
      variantKey: d.variantKey,
      locale: d.locale,
      status: 'archived',
    });
  });

  it('publication transactionnelle : archive l’ancien, un seul publié, version+1', async () => {
    const p1 = await publishSet({ setId: (await upsertDraftSet(draftInput())).id, actorId: null });
    const d2 = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    const p2 = await publishSet({ setId: d2.id, actorId: null, expectedUpdatedAt: d2.updatedAt });
    expect(p2.version).toBe(p1.version + 1);
    const all = await listSetsByComponent(componentId, { includeArchived: true });
    expect(all.filter((s) => s.status === 'published').map((s) => s.id)).toEqual([p2.id]);
    expect(all.find((s) => s.id === p1.id)?.status).toBe('archived');
  });

  it('rollback réel : échec en cours de publication → l’ancien publié reste publié', async () => {
    const p1 = await publishSet({ setId: (await upsertDraftSet(draftInput())).id, actorId: null });
    const d2 = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    await softDeleteMedia(m2.id);
    await expect(publishSet({ setId: d2.id, actorId: null })).rejects.toBeInstanceOf(
      MediaSetValidationError,
    );
    const all = await listSetsByComponent(componentId, { includeArchived: true });
    expect(all.find((s) => s.id === p1.id)?.status).toBe('published');
    expect(all.find((s) => s.id === d2.id)?.status).toBe('draft');
  });

  it('rollback réel APRÈS l’archivage : une erreur sur l’historique `publish` annule tout', async () => {
    const p1 = await publishSet({ setId: (await upsertDraftSet(draftInput())).id, actorId: null });
    const d2 = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    // Panne simulée au DERNIER ordre SQL de la transaction (archive déjà écrit).
    await client.exec(`
      CREATE FUNCTION fail_publish_history() RETURNS trigger AS $$
      BEGIN
        IF NEW.action = 'publish' THEN RAISE EXCEPTION 'boom'; END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_publish_history BEFORE INSERT ON component_media_set_history
        FOR EACH ROW EXECUTE FUNCTION fail_publish_history();
    `);
    try {
      await expect(publishSet({ setId: d2.id, actorId: null })).rejects.toThrow();
    } finally {
      await client.exec(
        'DROP TRIGGER fail_publish_history ON component_media_set_history; DROP FUNCTION fail_publish_history();',
      );
    }
    const all = await listSetsByComponent(componentId, { includeArchived: true });
    expect(all.find((s) => s.id === p1.id)?.status).toBe('published');
    expect(all.find((s) => s.id === d2.id)?.status).toBe('draft');
    const archives = (await listSetHistory(p1, 50)).filter((h) => h.action === 'archive');
    expect(archives).toHaveLength(0);
  });

  it('If-Match : mise à jour conditionnelle sur updated_at', async () => {
    const d = await upsertDraftSet(draftInput());
    await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }], expectedUpdatedAt: d.updatedAt }));
    await expect(
      upsertDraftSet(draftInput({ expectedUpdatedAt: d.updatedAt })),
    ).rejects.toBeInstanceOf(MediaSetConflictError);
  });

  it('FK RESTRICT : suppression définitive d’un média référencé refusée (desktop et mobile)', async () => {
    await upsertDraftSet(draftInput({ items: [{ mediaId: m1.id, mobileMediaId: m2.id }] }));
    // 23503 du vrai Postgres mappé vers l'erreur métier (parité mémoire).
    await expect(hardDeleteMedia(m1.id)).rejects.toBeInstanceOf(MediaInUseError);
    await expect(hardDeleteMedia(m2.id)).rejects.toBeInstanceOf(MediaInUseError);
    const rows = await db.select({ id: schema.media.id }).from(schema.media);
    expect(rows).toHaveLength(2);
  });

  it('lecture publiée en une requête : positions, variants dédoublonnés, média supprimé → null', async () => {
    const d = await upsertDraftSet(
      draftInput({ slot: 'secondary', items: [{ mediaId: m2.id }, { mediaId: m1.id, mobileMediaId: m2.id }] }),
    );
    await publishSet({ setId: d.id, actorId: null });
    let [set] = await listPublishedSetsWithMedia(componentId);
    expect(set?.items.map((i) => [i.position, i.mediaId])).toEqual([
      [0, m2.id],
      [1, m1.id],
    ]);
    expect(set?.items[1]?.media?.variants.map((v) => v.format).sort()).toEqual(['avif', 'webp']);
    expect(set?.items[1]?.mobileMedia?.id).toBe(m2.id);

    await softDeleteMedia(m2.id);
    [set] = await listPublishedSetsWithMedia(componentId);
    expect(set?.items[0]?.media).toBeNull();
    expect(set?.items[1]?.mobileMedia).toBeNull();
    expect(set?.items[1]?.media?.id).toBe(m1.id);
  });

  it('programmation → promotion, puis dépublication et restauration en brouillon', async () => {
    const d = await upsertDraftSet(draftInput());
    const at = new Date(Date.now() + 3_600_000);
    await scheduleSet({ setId: d.id, actorId: null, scheduledAt: at });
    const res = await promoteDueMediaSets(new Date(at.getTime() + 1));
    expect(res.promoted.map((s) => s.id)).toEqual([d.id]);

    await unpublishSet({ setId: d.id, actorId: null });
    expect(await listPublishedSetsWithMedia(componentId)).toEqual([]);

    const publishEntry = (await listSetHistory(d, 50)).find((h) => h.action === 'publish')!;
    const restored = await restoreSetFromHistory({ historyId: publishEntry.id, actorId: null });
    expect(restored.status).toBe('draft');
    expect(restored.items.map((i) => i.mediaId)).toEqual([m1.id]);
  });

  it('index partiel : une seconde programmation brute pour le même tuple est refusée', async () => {
    const d = await upsertDraftSet(draftInput());
    await scheduleSet({ setId: d.id, actorId: null, scheduledAt: new Date(Date.now() + 3_600_000) });
    await expect(
      db.insert(schema.componentMediaSets).values({
        id: 'cms_sched_dup',
        componentId,
        slot: d.slot,
        variantDim: d.variantDim,
        variantKey: d.variantKey,
        locale: d.locale,
        status: 'scheduled',
      }),
    ).rejects.toThrow();
  });

  it('publication manuelle : archive la programmation en attente (transaction)', async () => {
    const d1 = await upsertDraftSet(draftInput());
    await scheduleSet({ setId: d1.id, actorId: null, scheduledAt: new Date(Date.now() + 3_600_000) });
    const d2 = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    await publishSet({ setId: d2.id, actorId: null });
    expect((await getSetById(d1.id))?.status).toBe('archived');
    const history = await listSetHistory(d2, 50);
    expect(history.slice(0, 2).map((h) => [h.setId, h.action])).toEqual([
      [d2.id, 'publish'],
      [d1.id, 'archive'],
    ]);
  });

  it('discardDraft : ensemble et items supprimés, historique conservé (pas de FK set_id)', async () => {
    const d = await upsertDraftSet(draftInput({ items: [{ mediaId: m1.id, mobileMediaId: m2.id }] }));
    await discardDraft({ setId: d.id, actorId: null, expectedUpdatedAt: d.updatedAt });
    expect(await getSetById(d.id)).toBeNull();
    const items = await db.select().from(schema.componentMediaSetItems);
    expect(items).toEqual([]);
    expect((await listSetHistory(d)).map((h) => [h.action, h.status, h.notes])).toEqual([
      ['archive', 'draft', 'discard_draft'],
      ['create', 'draft', null],
    ]);
    await expect(hardDeleteMedia(m2.id)).resolves.toBeUndefined();
  });
});

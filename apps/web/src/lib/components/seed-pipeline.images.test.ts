/**
 * Tests — phase « images » de `seedFromDocs` après extraction de
 * l'ingestion dans `lib/media/ingest.ts` : même comportement qu'avant
 * (création + binding actif, re-seed = skip, `force` = ré-optimisation,
 * `forceAlt`, heal des variants manquants, dry-run sans écriture) et
 * placeholder `blur_data_url` désormais persisté.
 */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import { findMediaBySlug, updateMedia } from '@/lib/db/queries/media';
import { deleteVariantsByMedia, listVariants } from '@/lib/db/queries/media-variants';
import { getBindingBySlot } from '@/lib/db/queries/component-bindings';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import type { StorageAdapter } from '@/lib/media/storage';

const puts: string[] = [];
const memStorage: StorageAdapter = {
  driver: 'local',
  async put({ key, body }) {
    puts.push(key);
    return { key, url: `mem://${key}`, sizeBytes: body.byteLength };
  },
  async delete() {},
  publicUrl(key) {
    return `mem://${key}`;
  },
};

// Le pipeline écrit via le driver de l'application : on le remplace par un
// stockage mémoire (aucune écriture disque pendant les tests).
vi.mock('@/lib/media/storage', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/media/storage')>();
  return { ...actual, getStorage: () => memStorage };
});

const { seedFromDocs } = await import('./seed-pipeline');

const SOURCE = 'home/hero-home.png';
const SLUG = 'home-hero-home';
let root: string;

const baseOpts = () => ({
  rootDir: root,
  filterPageGroup: 'home',
  syncAnimations: false,
  syncFields: false,
});

beforeEach(async () => {
  resetMemoryStore();
  puts.length = 0;
  root = await mkdtemp(path.join(os.tmpdir(), 'seed-images-'));
  await mkdir(path.join(root, 'home'), { recursive: true });
  const png = await sharp({ create: { width: 64, height: 36, channels: 3, background: '#c08070' } })
    .png()
    .toBuffer();
  await writeFile(path.join(root, SOURCE), png);
  await writeFile(path.join(root, 'home', 'non-mappee.png'), png);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('seedFromDocs — phase images (ingestion partagée)', () => {
  it('premier seed : média ready (flou compris) + binding actif ; fichier non mappé signalé', async () => {
    const report = await seedFromDocs(baseOpts());
    expect(report.images).toMatchObject({ total: 1, seeded: 1, skipped: 0, activated: 1, errors: [] });
    expect(report.images.unmapped).toEqual(['home/non-mappee.png']);

    const media = await findMediaBySlug(SLUG);
    expect(media).toMatchObject({ status: 'ready', originalMime: 'image/png', originalFilename: 'hero-home.png' });
    expect(media?.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(media?.overrides.breakpoints?.length).toBeGreaterThan(0);
    expect(media?.overrides.sourceChecksum).toBeUndefined();
    expect((await listVariants(media!.id)).length).toBeGreaterThan(0);

    const cmp = await getSiteComponentByKey('home-hero');
    const binding = await getBindingBySlot(cmp!.id, 'primary');
    expect(binding).toMatchObject({ mediaId: media!.id, isActive: true });
  }, 60_000);

  it('re-seed : skip (aucune ré-optimisation), binding préservé', async () => {
    await seedFromDocs(baseOpts());
    const putsAfterFirst = puts.length;
    const cmp = await getSiteComponentByKey('home-hero');
    const { upsertBinding } = await import('@/lib/db/queries/component-bindings');
    const media = await findMediaBySlug(SLUG);
    await upsertBinding({ componentId: cmp!.id, slot: 'primary', mediaId: media!.id, isActive: false });

    const events: string[] = [];
    const report = await seedFromDocs({ ...baseOpts(), onProgress: (e) => e.type === 'item' && e.phase === 'images' && events.push(e.status) });
    expect(report.images).toMatchObject({ seeded: 0, skipped: 1, activated: 0 });
    expect(events).toEqual(['skipped']);
    expect(puts.length).toBe(putsAfterFirst);
    expect((await getBindingBySlot(cmp!.id, 'primary'))?.isActive).toBe(false);
  }, 60_000);

  it('force (+ forceAlt) : ré-optimise le même média, statut « forced »', async () => {
    await seedFromDocs(baseOpts());
    const media = await findMediaBySlug(SLUG);
    await updateMedia(media!.id, { alt: 'alt modifié par l’admin' });

    const events: string[] = [];
    const report = await seedFromDocs({
      ...baseOpts(),
      force: true,
      onProgress: (e) => e.type === 'item' && e.phase === 'images' && events.push(e.status),
    });
    expect(report.images).toMatchObject({ seeded: 1, skipped: 0 });
    expect(events).toEqual(['forced']);
    const after = await findMediaBySlug(SLUG);
    expect(after?.id).toBe(media!.id);
    expect(after?.alt).toBe('alt modifié par l’admin');

    await seedFromDocs({ ...baseOpts(), force: true, forceAlt: true });
    expect((await findMediaBySlug(SLUG))?.alt).not.toBe('alt modifié par l’admin');
  }, 60_000);

  it('heal : variants supprimés → ré-optimisés sans --force', async () => {
    await seedFromDocs(baseOpts());
    const media = await findMediaBySlug(SLUG);
    await deleteVariantsByMedia(media!.id);
    const events: string[] = [];
    await seedFromDocs({ ...baseOpts(), onProgress: (e) => e.type === 'item' && e.phase === 'images' && events.push(e.status) });
    expect(events).toEqual(['forced']);
    expect((await listVariants(media!.id)).length).toBeGreaterThan(0);
  }, 60_000);

  it('dry-run : aucune écriture', async () => {
    const report = await seedFromDocs({ ...baseOpts(), dryRun: true });
    expect(report.images).toMatchObject({ total: 1, seeded: 1 });
    expect(memoryStore().media.size).toBe(0);
    expect(puts).toEqual([]);
  });
});

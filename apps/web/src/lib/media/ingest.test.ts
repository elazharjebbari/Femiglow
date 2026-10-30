/**
 * Tests — `ingestImageBuffer` (memoryStore + stockage mémoire).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { resetMemoryStore } from '@/lib/db/client';
import { createMedia, findMediaById } from '@/lib/db/queries/media';
import { listVariants } from '@/lib/db/queries/media-variants';
import type { StorageAdapter } from '@/lib/media/storage';
import {
  ingestImageBuffer,
  mimeFromFilename,
  sha256Checksum,
  unionBreakpoints,
  type IngestImageInput,
} from './ingest';

function memStorage(): StorageAdapter & { keys: string[] } {
  const keys: string[] = [];
  return {
    driver: 'local',
    keys,
    async put({ key, body }) {
      keys.push(key);
      return { key, url: `mem://${key}`, sizeBytes: body.byteLength };
    },
    async delete() {},
    publicUrl(key) {
      return `mem://${key}`;
    },
  };
}

async function png(color: string): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 50, channels: 3, background: color } }).png().toBuffer();
}

let storage: ReturnType<typeof memStorage>;

function input(overrides: Partial<IngestImageInput> = {}): IngestImageInput {
  return {
    buffer: Buffer.alloc(0),
    filename: 'image.png',
    slug: 'Hero Kit — Ongles',
    alt: 'Ongles brillants',
    breakpoints: ['sm'],
    optimize: { formats: ['webp', 'jpeg'] },
    storage,
    ...overrides,
  };
}

beforeEach(() => {
  resetMemoryStore();
  storage = memStorage();
});

describe('helpers', () => {
  it('sha256Checksum au format des variants', () => {
    expect(sha256Checksum(Buffer.from('abc'))).toBe(
      'sha256-ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('unionBreakpoints : union ordonnée du plus petit au plus grand', () => {
    expect(unionBreakpoints(['xl', 'sm'], ['md', 'sm'])).toEqual(['sm', 'md', 'xl']);
    expect(unionBreakpoints(undefined, ['lg'])).toEqual(['lg']);
    expect(unionBreakpoints(undefined, undefined)).toEqual([]);
  });

  it('mimeFromFilename', () => {
    expect(mimeFromFilename('a.PNG')).toBe('image/png');
    expect(mimeFromFilename('a.jpg')).toBe('image/jpeg');
    expect(mimeFromFilename('a.webp')).toBe('image/webp');
    expect(mimeFromFilename('a.bin')).toBe('application/octet-stream');
  });
});

describe('ingestImageBuffer', () => {
  it('crée un média ready (slug normalisé, variants, flou, overrides, auteur)', async () => {
    const buffer = await png('#c08070');
    const checksum = sha256Checksum(buffer);
    const res = await ingestImageBuffer(input({ buffer, sourceChecksum: checksum, actorId: null }));
    expect(res.status).toBe('created');
    expect(res.media).toMatchObject({
      slug: 'hero-kit-ongles',
      status: 'ready',
      alt: 'Ongles brillants',
      originalFilename: 'image.png',
      originalMime: 'image/png',
      originalSizeBytes: buffer.byteLength,
      originalWidth: 40,
      originalHeight: 50,
      overrides: { breakpoints: ['sm'], sourceChecksum: checksum },
    });
    expect(res.media.blurhash).toBeTruthy();
    expect(res.media.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(res.media.palette.length).toBeGreaterThan(0);
    const variants = await listVariants(res.media.id);
    expect(variants.map((v) => `${v.format}/${v.breakpoint}`).sort()).toEqual(['jpeg/sm', 'webp/sm']);
    expect(storage.keys).toHaveLength(2);
  });

  it('même slug + même empreinte → skipped, sans lire la source', async () => {
    const buffer = await png('#c08070');
    const checksum = sha256Checksum(buffer);
    const first = await ingestImageBuffer(input({ buffer, sourceChecksum: checksum }));
    const loader = vi.fn(async () => buffer);
    const second = await ingestImageBuffer(input({ buffer: loader, sourceChecksum: checksum }));
    expect(second.status).toBe('skipped');
    expect(second.media.id).toBe(first.media.id);
    expect(loader).not.toHaveBeenCalled();
    expect(storage.keys).toHaveLength(2);
  });

  it('sans empreinte (seed historique) : idempotence par slug seul', async () => {
    const first = await ingestImageBuffer(input({ buffer: await png('#c08070') }));
    const second = await ingestImageBuffer(input({ buffer: await png('#000000') }));
    expect(second.status).toBe('skipped');
    expect(second.media.id).toBe(first.media.id);
  });

  it('mémorise l’empreinte d’un média existant qui n’en avait pas', async () => {
    const first = await ingestImageBuffer(input({ buffer: await png('#c08070') }));
    expect(first.media.overrides.sourceChecksum).toBeUndefined();
    const res = await ingestImageBuffer(input({ buffer: await png('#c08070'), sourceChecksum: 'sha256-aa' }));
    expect(res.status).toBe('skipped');
    expect(res.media.overrides).toMatchObject({ breakpoints: ['sm'], sourceChecksum: 'sha256-aa' });
  });

  it('empreinte différente → checksum_mismatch, rien n’est touché', async () => {
    const first = await ingestImageBuffer(input({ buffer: await png('#c08070'), sourceChecksum: 'sha256-old' }));
    const res = await ingestImageBuffer(input({ buffer: await png('#000000'), sourceChecksum: 'sha256-new' }));
    expect(res.status).toBe('checksum_mismatch');
    expect(res.media.id).toBe(first.media.id);
    expect((await findMediaById(first.media.id))?.overrides.sourceChecksum).toBe('sha256-old');
    expect(storage.keys).toHaveLength(2);
  });

  it('force → ré-optimise en place (nouvelle empreinte, alt réécrit si forceAlt)', async () => {
    const first = await ingestImageBuffer(input({ buffer: await png('#c08070'), sourceChecksum: 'sha256-old' }));
    const res = await ingestImageBuffer(
      input({
        buffer: await png('#000000'),
        sourceChecksum: 'sha256-new',
        force: true,
        forceAlt: true,
        alt: 'Nouvel alt',
        breakpoints: ['md'],
      }),
    );
    expect(res).toMatchObject({ status: 'reprocessed', healed: false });
    expect(res.media.id).toBe(first.media.id);
    expect(res.media.alt).toBe('Nouvel alt');
    expect(res.media.overrides).toMatchObject({ breakpoints: ['md'], sourceChecksum: 'sha256-new' });
    const formats = (await listVariants(first.media.id)).map((v) => `${v.format}/${v.breakpoint}`).sort();
    expect(formats).toEqual(['jpeg/md', 'jpeg/sm', 'webp/md', 'webp/sm']);
  });

  it('force sans forceAlt → alt conservé', async () => {
    await ingestImageBuffer(input({ buffer: await png('#c08070') }));
    const res = await ingestImageBuffer(input({ buffer: await png('#c08070'), force: true, alt: 'Autre' }));
    expect(res.status).toBe('reprocessed');
    expect(res.media.alt).toBe('Ongles brillants');
  });

  it('variants manquants → heal (ré-optimisation sans force)', async () => {
    const orphan = await createMedia({ kind: 'image', source: 'upload', slug: 'hero-kit-ongles', alt: 'x', status: 'ready' });
    const res = await ingestImageBuffer(input({ buffer: await png('#c08070') }));
    expect(res).toMatchObject({ status: 'reprocessed', healed: true });
    expect(res.media.id).toBe(orphan.id);
    expect(res.media.blurDataUrl).toMatch(/^data:image\/webp/);
    expect(await listVariants(orphan.id)).toHaveLength(2);
  });

  it('échec d’optimisation → média `failed` avec la raison, erreur propagée', async () => {
    await expect(
      ingestImageBuffer(input({ buffer: Buffer.from('pas une image'), slug: 'casse' })),
    ).rejects.toThrow();
    const { findMediaBySlug } = await import('@/lib/db/queries/media');
    const media = await findMediaBySlug('casse');
    expect(media?.status).toBe('failed');
    expect(media?.failureReason).toBeTruthy();
    // Un nouveau passage avec une image valide répare le média (heal).
    const res = await ingestImageBuffer(input({ buffer: await png('#c08070'), slug: 'casse' }));
    expect(res).toMatchObject({ status: 'reprocessed', healed: true });
    expect(res.media).toMatchObject({ status: 'ready', failureReason: null });
  });

  it('échec d’une RÉ-optimisation : média existant intact (statut, overrides, empreinte, alt)', async () => {
    const first = await ingestImageBuffer(input({ buffer: await png('#c08070'), sourceChecksum: 'sha256-old' }));
    expect(first.media.status).toBe('ready');
    const before = await findMediaById(first.media.id);

    await expect(
      ingestImageBuffer(
        input({
          buffer: Buffer.from('pas une image'),
          sourceChecksum: 'sha256-new',
          force: true,
          forceAlt: true,
          alt: 'Autre alt',
          breakpoints: ['md'],
        }),
      ),
    ).rejects.toThrow();

    const after = await findMediaById(first.media.id);
    expect(after).toMatchObject({
      status: 'ready',
      failureReason: null,
      alt: before!.alt,
      overrides: { breakpoints: ['sm'], sourceChecksum: 'sha256-old' },
      blurDataUrl: before!.blurDataUrl,
    });
    // Le passage suivant (même ancienne empreinte) reste un simple skip.
    const again = await ingestImageBuffer(input({ buffer: await png('#c08070'), sourceChecksum: 'sha256-old' }));
    expect(again.status).toBe('skipped');
  });

  it('breakpointsMode `union` : la ré-optimisation garde les breakpoints déjà mémorisés', async () => {
    const first = await ingestImageBuffer(input({ buffer: await png('#c08070'), breakpoints: ['xs'] }));
    const res = await ingestImageBuffer(
      input({ buffer: await png('#c08070'), breakpoints: ['md'], breakpointsMode: 'union', force: true }),
    );
    expect(res.status).toBe('reprocessed');
    expect(res.media.overrides.breakpoints).toEqual(['xs', 'md']);
    const bps = new Set((await listVariants(first.media.id)).map((v) => v.breakpoint));
    expect(bps).toEqual(new Set(['xs', 'md']));
  });

  it('breakpointsMode `replace` (défaut, seed) : la politique fournie remplace l’ancienne', async () => {
    await ingestImageBuffer(input({ buffer: await png('#c08070'), breakpoints: ['xs'] }));
    const res = await ingestImageBuffer(input({ buffer: await png('#c08070'), breakpoints: ['md'], force: true }));
    expect(res.media.overrides.breakpoints).toEqual(['md']);
  });

  it('refuse un slug vide', async () => {
    await expect(ingestImageBuffer(input({ buffer: await png('#fff'), slug: '—' }))).rejects.toThrow(/slug vide/);
  });
});

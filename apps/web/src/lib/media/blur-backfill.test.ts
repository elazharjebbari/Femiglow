/**
 * Tests — backfill de `media.blur_data_url` (memoryStore + stockage mémoire).
 *
 * Couvre : seuls les médias image exploitables sans flou sont traités,
 * idempotence (second passage = 0), `--dry-run` n'écrit rien, `--limit`,
 * lots multiples, choix de la source (plus petit WebP via le stockage,
 * repli HTTP, `original_url`), média sans source lisible, erreur isolée.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { resetMemoryStore } from '@/lib/db/client';
import { createMedia, findMediaById, updateMedia } from '@/lib/db/queries/media';
import { createVariant } from '@/lib/db/queries/media-variants';
import type { Media, MediaVariant, VariantBreakpoint, VariantFormat } from '@/lib/db/types';
import type { StorageAdapter } from '@/lib/media/storage';
import { variantStorageKey } from '@/lib/media/pipeline/optimize-image';
import { backfillMediaBlur, orderBlurSourceVariants } from './blur-backfill';

function memStorage(): StorageAdapter & { files: Map<string, Buffer>; reads: string[] } {
  const files = new Map<string, Buffer>();
  const reads: string[] = [];
  return {
    driver: 'local',
    files,
    reads,
    async put({ key, body }) {
      files.set(key, body);
      return { key, url: `/media-test/${key}`, sizeBytes: body.byteLength };
    },
    async delete(key) {
      files.delete(key);
    },
    publicUrl(key) {
      return `/media-test/${key}`;
    },
    async get(key) {
      reads.push(key);
      const f = files.get(key);
      if (!f) throw new Error(`absent: ${key}`);
      return f;
    },
  };
}

async function png(color = '#c08070', width = 40, height = 50): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
}

let storage: ReturnType<typeof memStorage>;

async function imageMedia(
  slug: string,
  opts: { status?: Media['status']; kind?: Media['kind']; originalUrl?: string } = {},
): Promise<Media> {
  return createMedia({
    kind: opts.kind ?? 'image',
    source: opts.originalUrl ? 'external' : 'upload',
    slug,
    alt: slug,
    status: opts.status ?? 'ready',
    ...(opts.originalUrl ? { originalUrl: opts.originalUrl } : {}),
  });
}

/** Variant stocké au chemin canonique du pipeline. */
async function storedVariant(
  media: Media,
  format: VariantFormat,
  breakpoint: VariantBreakpoint,
  width: number,
  body?: Buffer,
): Promise<MediaVariant> {
  const key = variantStorageKey(media.id, format, breakpoint);
  const put = await storage.put({ key, body: body ?? (await png()), contentType: `image/${format}` });
  return createVariant({
    mediaId: media.id,
    format,
    breakpoint,
    width,
    height: Math.round(width * 1.25),
    sizeBytes: put.sizeBytes,
    url: put.url,
    checksum: key,
  });
}

beforeEach(() => {
  resetMemoryStore();
  storage = memStorage();
});

describe('orderBlurSourceVariants', () => {
  it('WebP avant JPEG avant AVIF, puis largeur croissante ; ignore vidéo/poster', () => {
    const base = { mediaId: 'm', height: null, bitrateKbps: null, quality: null, sizeBytes: 1, checksum: 'c', createdAt: new Date() };
    const v = (id: string, format: VariantFormat, width: number | null, breakpoint: VariantBreakpoint | null = null): MediaVariant => ({
      ...base,
      id,
      format,
      width,
      breakpoint,
      url: `/${id}`,
    });
    const ordered = orderBlurSourceVariants([
      v('avif-sm', 'avif', 480),
      v('jpeg-sm', 'jpeg', 480),
      v('webp-lg', 'webp', 1024),
      v('mp4', 'mp4' as VariantFormat, 720),
      v('webp-sm', 'webp', null, 'sm'),
      v('poster', 'poster' as VariantFormat, 720),
    ]);
    expect(ordered.map((x) => x.id)).toEqual(['webp-sm', 'webp-lg', 'jpeg-sm', 'avif-sm']);
  });
});

describe('backfillMediaBlur', () => {
  it('remplit le flou depuis le plus petit WebP du stockage, puis est idempotent', async () => {
    const m = await imageMedia('hero-1');
    await storedVariant(m, 'webp', 'lg', 1024);
    await storedVariant(m, 'webp', 'sm', 480);
    await storedVariant(m, 'jpeg', 'sm', 480);

    const first = await backfillMediaBlur({ storage });
    expect(first).toMatchObject({ scanned: 1, updated: 1, errors: 0, noSource: 0 });
    expect(first.items[0]?.source).toBe(`storage:${variantStorageKey(m.id, 'webp', 'sm')}`);
    expect(storage.reads).toEqual([variantStorageKey(m.id, 'webp', 'sm')]);
    const after = await findMediaById(m.id);
    expect(after?.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(after!.blurDataUrl!.length).toBeLessThanOrEqual(1536);

    const second = await backfillMediaBlur({ storage });
    expect(second).toMatchObject({ scanned: 0, updated: 0 });
  });

  it('ignore les médias déjà floutés, supprimés, non prêts et non image', async () => {
    const done = await imageMedia('done');
    await updateMedia(done.id, { blurDataUrl: 'data:image/webp;base64,AAAA' });
    const deleted = await imageMedia('deleted');
    await updateMedia(deleted.id, {});
    const { softDeleteMedia } = await import('@/lib/db/queries/media');
    await softDeleteMedia(deleted.id);
    await imageMedia('pending', { status: 'pending' });
    await imageMedia('video', { kind: 'video' });
    const target = await imageMedia('target');
    await storedVariant(target, 'webp', 'sm', 480);

    const report = await backfillMediaBlur({ storage });
    expect(report.items.map((i) => i.slug)).toEqual(['target']);
    expect((await findMediaById(done.id))?.blurDataUrl).toBe('data:image/webp;base64,AAAA');
  });

  it('--dry-run calcule sans écrire', async () => {
    const m = await imageMedia('dry');
    await storedVariant(m, 'webp', 'sm', 480);
    const report = await backfillMediaBlur({ storage, dryRun: true });
    expect(report).toMatchObject({ dryRun: true, scanned: 1, wouldUpdate: 1, updated: 0 });
    expect(report.items[0]?.bytes).toBeGreaterThan(0);
    expect((await findMediaById(m.id))?.blurDataUrl ?? null).toBeNull();
  });

  it('--limit borne le nombre de médias, et les lots s’enchaînent par curseur', async () => {
    for (let i = 0; i < 5; i += 1) {
      const m = await imageMedia(`batch-${i}`);
      await storedVariant(m, 'webp', 'sm', 480);
    }
    const limited = await backfillMediaBlur({ storage, limit: 3, batchSize: 2 });
    expect(limited.scanned).toBe(3);
    expect(limited.updated).toBe(3);
    const rest = await backfillMediaBlur({ storage, batchSize: 2 });
    expect(rest.scanned).toBe(2);
    expect(rest.updated).toBe(2);
  });

  it('se rabat sur HTTP quand l’URL du variant ne correspond pas au stockage', async () => {
    const m = await imageMedia('cdn');
    await createVariant({
      mediaId: m.id,
      format: 'webp',
      breakpoint: 'sm',
      width: 480,
      sizeBytes: 10,
      url: 'https://cdn.example.test/other/path.webp',
      checksum: 'x',
    });
    const body = await png('#335577');
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array(body), { status: 200 }));
    const report = await backfillMediaBlur({ storage, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://cdn.example.test/other/path.webp',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(report.updated).toBe(1);
    expect(report.items[0]?.source).toBe('http:https://cdn.example.test/other/path.webp');
  });

  it('lit `original_url` pour un média passthrough sans variant', async () => {
    const m = await imageMedia('external', { status: 'passthrough', originalUrl: 'https://img.example.test/a.png' });
    const body = await png('#775533');
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array(body), { status: 200 }));
    const report = await backfillMediaBlur({ storage, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(report.updated).toBe(1);
    expect((await findMediaById(m.id))?.blurDataUrl).toMatch(/^data:image\/webp/);
  });

  it('signale `no_source` (fichier absent) sans bloquer les autres médias', async () => {
    const missing = await imageMedia('a-missing');
    await createVariant({
      mediaId: missing.id,
      format: 'webp',
      breakpoint: 'sm',
      width: 480,
      sizeBytes: 10,
      url: storage.publicUrl(variantStorageKey(missing.id, 'webp', 'sm')),
      checksum: 'x',
    });
    const ok = await imageMedia('b-ok');
    await storedVariant(ok, 'webp', 'sm', 480);

    const report = await backfillMediaBlur({ storage, fetchImpl: undefined });
    const bySlug = Object.fromEntries(report.items.map((i) => [i.slug, i]));
    expect(bySlug['a-missing']).toMatchObject({ status: 'no_source' });
    expect(bySlug['a-missing']?.error).toMatch(/absent/);
    expect(bySlug['b-ok']).toMatchObject({ status: 'updated' });
    expect(report).toMatchObject({ noSource: 1, updated: 1 });
  });

  it('délai HTTP dépassé → `error` pour le média, les autres continuent', async () => {
    const slow = await imageMedia('a-slow');
    await createVariant({
      mediaId: slow.id,
      format: 'webp',
      breakpoint: 'sm',
      width: 480,
      sizeBytes: 10,
      url: 'https://cdn.example.test/slow.webp',
      checksum: 'x',
    });
    const ok = await imageMedia('b-ok');
    await storedVariant(ok, 'webp', 'sm', 480);
    // fetch qui ne répond jamais, sauf à l'annulation par le signal.
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    );
    const report = await backfillMediaBlur({
      storage,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      fetchTimeoutMs: 30,
    });
    const bySlug = Object.fromEntries(report.items.map((i) => [i.slug, i]));
    expect(bySlug['a-slow']).toMatchObject({ status: 'error' });
    expect(bySlug['a-slow']?.error).toMatch(/délai dépassé \(30 ms\)/);
    expect(bySlug['b-ok']).toMatchObject({ status: 'updated' });
    expect(report).toMatchObject({ errors: 1, updated: 1, noSource: 0 });
    expect((await findMediaById(slow.id))?.blurDataUrl ?? null).toBeNull();
  });

  it('délai dépassé sur un candidat mais autre source lisible → mis à jour', async () => {
    const m = await imageMedia('fallback', { status: 'ready', originalUrl: 'https://img.example.test/ok.png' });
    await createVariant({
      mediaId: m.id,
      format: 'webp',
      breakpoint: 'sm',
      width: 480,
      sizeBytes: 10,
      url: 'https://cdn.example.test/slow.webp',
      checksum: 'x',
    });
    const body = await png('#446688');
    const fetchImpl = vi.fn((url: string, init?: RequestInit) =>
      url.includes('slow')
        ? new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
          })
        : Promise.resolve(new Response(new Uint8Array(body), { status: 200 })),
    );
    const report = await backfillMediaBlur({ storage, fetchImpl: fetchImpl as unknown as typeof fetch, fetchTimeoutMs: 30 });
    expect(report.items[0]).toMatchObject({ status: 'updated', source: 'http:https://img.example.test/ok.png' });
  });

  it('isole une source illisible en erreur', async () => {
    const m = await imageMedia('corrupt');
    await storedVariant(m, 'webp', 'sm', 480, Buffer.from('pas une image'));
    const report = await backfillMediaBlur({ storage });
    expect(report).toMatchObject({ errors: 1, updated: 0 });
    expect(report.items[0]?.status).toBe('error');
    expect((await findMediaById(m.id))?.blurDataUrl ?? null).toBeNull();
  });
});

/**
 * Seed media — lit `docs/images/values/**` et crée les enregistrements media
 * en optimisant **inline** (variantes AVIF/WebP/JPEG générées immédiatement
 * via `optimizeImage`). Heal automatique : pour un media existant dont les
 * variantes physiques sont manquantes (driver `local` uniquement), on
 * ré-optimise au lieu de skip.
 *
 * Usage : `pnpm tsx scripts/seed-media.ts`
 *
 * Exporte aussi `runMediaSeed(opts)` pour réutilisation côté Seeders Runner.
 */
import './_load-env.mjs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createMedia, findMediaBySlug, updateMedia } from '@/lib/db/queries/media';
import { upsertVariant } from '@/lib/db/queries/media-variants';
import { getStorage } from '@/lib/media/storage';
import { optimizeImage } from '@/lib/media/pipeline/optimize-image';
import { mediaVariantsHealthy } from '@/lib/media/heal';

const ROOT = path.resolve(process.cwd(), '../..', 'docs/images/values');
const SECTION_PROFILE: Record<string, 'hero' | 'inline' | 'thumb'> = {
  home: 'hero',
  rituel: 'hero',
  journal: 'inline',
  kit: 'inline',
  maison: 'inline',
};

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function toSlug(name: string, section: string): string {
  return `${section}-${name.replace(/\.[^.]+$/, '')}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export interface MediaSeedOptions {
  onProgress?: (label: string, fraction?: number) => void;
  /** Permet d'overrider le répertoire racine pour tests / cwd différents. */
  rootDir?: string;
}

export interface MediaSeedReport {
  created: number;
  skipped: number;
  scanned: number;
  errors: number;
  /** Médias existants dont les variantes manquaient sur disque et ont été régénérées. */
  healed: number;
}

export async function runMediaSeed(
  opts: MediaSeedOptions = {},
): Promise<MediaSeedReport> {
  const root = opts.rootDir ?? ROOT;
  opts.onProgress?.(`Scan ${path.basename(root)}`, 0.05);

  let dirStat;
  try {
    dirStat = await stat(root);
  } catch {
    throw new Error(`[seed-media] répertoire introuvable: ${root}`);
  }
  if (!dirStat.isDirectory()) {
    throw new Error(`[seed-media] ${root} n'est pas un répertoire`);
  }

  const files: string[] = [];
  for await (const file of walk(root)) {
    files.push(file);
  }
  const total = files.length;
  opts.onProgress?.(`${total} fichiers à examiner`, 0.1);

  const storage = getStorage();
  let created = 0;
  let skipped = 0;
  let healed = 0;
  let errors = 0;
  let processed = 0;

  for (const file of files) {
    processed += 1;
    if (processed % 5 === 0 || processed === total) {
      opts.onProgress?.(
        `${processed}/${total} (créés ${created}, ignorés ${skipped}, soignés ${healed})`,
        0.1 + (0.9 * processed) / Math.max(1, total),
      );
    }

    const rel = path.relative(root, file);
    const segments = rel.split(path.sep);
    if (segments.length < 2 || !segments[0] || !segments[segments.length - 1]) continue;
    const section = segments[0];
    const filename = segments[segments.length - 1]!;
    const ext = path.extname(filename).slice(1).toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp', 'avif', 'svg'].includes(ext)) continue;
    const slug = toSlug(filename, section);

    try {
      const buffer = await readFile(file);
      const key = `originals/${slug}.${ext}`;
      const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const profile = SECTION_PROFILE[section] ?? 'inline';
      const existing = await findMediaBySlug(slug);

      let media = existing;

      if (!existing) {
        const { url } = await storage.put({
          key,
          body: buffer,
          contentType: mime,
        });
        media = await createMedia({
          kind: 'image',
          source: 'upload',
          slug,
          alt: filename.replace(/[-_.]/g, ' ').replace(/\.[^.]+$/, ''),
          originalUrl: url,
          originalFilename: filename,
          originalSizeBytes: buffer.length,
          originalMime: mime,
          qualityProfile: profile,
          loadingStrategy: profile === 'hero' ? 'eager' : 'viewport',
          isHero: profile === 'hero',
          status: 'processing',
        });
      } else {
        // Heal : si le media est déjà en DB, on vérifie qu'au moins une
        // variante physique existe encore. Sinon, on régénère.
        if (await mediaVariantsHealthy(existing.id)) {
          skipped += 1;
          continue;
        }
      }

      if (!media) {
        skipped += 1;
        continue;
      }

      // SVG : pas de pipeline raster (sharp ne sait pas), on flag ready sans
      // variantes (servi tel quel depuis originals/).
      if (ext === 'svg') {
        await updateMedia(media.id, { status: 'ready' });
        if (existing) healed += 1;
        else created += 1;
        continue;
      }

      const optim = await optimizeImage({
        mediaId: media.id,
        buffer,
      });
      for (const v of optim.variants) {
        await upsertVariant({
          mediaId: media.id,
          format: v.format,
          breakpoint: v.breakpoint,
          width: v.width,
          height: v.height,
          quality: v.quality,
          sizeBytes: v.sizeBytes,
          url: v.url,
          checksum: v.checksum,
        });
      }
      await updateMedia(media.id, {
        status: 'ready',
        blurhash: optim.blurhash,
        palette: optim.palette,
        phash: optim.phash,
        originalWidth: optim.width,
        originalHeight: optim.height,
      });
      if (existing) healed += 1;
      else created += 1;
    } catch (err) {
      errors += 1;
      console.error(`[seed-media] erreur ${slug}:`, err);
    }
  }

  return { created, skipped, scanned: total, errors, healed };
}

async function main() {
  const report = await runMediaSeed({
    onProgress: (label) => console.log(`[seed-media] ${label}`),
  });
  console.log(
    `[seed-media] terminé. créés: ${report.created}, soignés: ${report.healed}, ignorés: ${report.skipped}, scannés: ${report.scanned}, erreurs: ${report.errors}`,
  );
}

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMainModule) {
  main().catch((err) => {
    console.error('[seed-media] erreur:', err);
    process.exit(1);
  });
}

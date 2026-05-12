/**
 * Seed media — lit `docs/images/values/**` et crée les enregistrements media
 * en mode passthrough (l'optimisation se fera via le worker).
 *
 * Usage : `pnpm tsx scripts/seed-media.ts`
 *
 * Exporte aussi `runMediaSeed(opts)` pour réutilisation côté Seeders Runner.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createMedia } from '@/lib/db/queries/media';
import { findMediaBySlug } from '@/lib/db/queries/media';
import { enqueueJob } from '@/lib/db/queries/media-jobs';
import { getStorage } from '@/lib/media/storage';

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

  // Première passe : compter les fichiers pour ETA.
  const files: string[] = [];
  for await (const file of walk(root)) {
    files.push(file);
  }
  const total = files.length;
  opts.onProgress?.(`${total} fichiers à examiner`, 0.1);

  const storage = getStorage();
  let created = 0;
  let skipped = 0;
  let errors = 0;
  let processed = 0;

  for (const file of files) {
    processed += 1;
    if (processed % 5 === 0 || processed === total) {
      opts.onProgress?.(
        `${processed}/${total} (créés ${created}, ignorés ${skipped})`,
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
      const existing = await findMediaBySlug(slug);
      if (existing) {
        skipped += 1;
        continue;
      }

      const buffer = await readFile(file);
      const key = `originals/${slug}.${ext}`;
      const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const { url } = await storage.put({
        key,
        body: buffer,
        contentType: mime,
      });

      const profile = SECTION_PROFILE[section] ?? 'inline';
      const media = await createMedia({
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
      });
      await enqueueJob({ mediaId: media.id, kind: 'optimize' });
      created += 1;
    } catch (err) {
      errors += 1;
      console.error(`[seed-media] erreur ${slug}:`, err);
    }
  }

  return { created, skipped, scanned: total, errors };
}

async function main() {
  const report = await runMediaSeed({
    onProgress: (label) => console.log(`[seed-media] ${label}`),
  });
  console.log(
    `[seed-media] terminé. créés: ${report.created}, ignorés: ${report.skipped}, scannés: ${report.scanned}, erreurs: ${report.errors}`,
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

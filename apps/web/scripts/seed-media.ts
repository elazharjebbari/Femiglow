/**
 * Seed media — lit `docs/images/values/**` et crée les enregistrements media
 * en mode passthrough (l'optimisation se fera via le worker).
 *
 * Usage : `pnpm tsx scripts/seed-media.ts`
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

async function main() {
  let dirStat;
  try {
    dirStat = await stat(ROOT);
  } catch {
    console.error(`[seed-media] répertoire introuvable: ${ROOT}`);
    process.exit(1);
  }
  if (!dirStat.isDirectory()) {
    console.error(`[seed-media] ${ROOT} n'est pas un répertoire`);
    process.exit(1);
  }

  const storage = getStorage();
  let created = 0;
  let skipped = 0;

  for await (const file of walk(ROOT)) {
    const rel = path.relative(ROOT, file);
    const segments = rel.split(path.sep);
    if (segments.length < 2 || !segments[0] || !segments[segments.length - 1]) continue;
    const section = segments[0];
    const filename = segments[segments.length - 1]!;
    const ext = path.extname(filename).slice(1).toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp', 'avif', 'svg'].includes(ext)) continue;
    const slug = toSlug(filename, section);

    const existing = await findMediaBySlug(slug);
    if (existing) {
      skipped++;
      continue;
    }

    const buffer = await readFile(file);
    const checksum = await crypto.subtle
      .digest('SHA-256', buffer)
      .then((b) =>
        Array.from(new Uint8Array(b))
          .map((x) => x.toString(16).padStart(2, '0'))
          .join(''),
      );
    const key = `originals/${slug}.${ext}`;
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const { url } = await storage.put({
      key,
      body: buffer,
      contentType: mime,
      checksum,
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
    created++;
    console.log(`[seed-media] ${slug} créé (${section}, ${profile})`);
  }

  console.log(`\n[seed-media] terminé. créés: ${created}, ignorés: ${skipped}`);
}

main().catch((err) => {
  console.error('[seed-media] erreur:', err);
  process.exit(1);
});

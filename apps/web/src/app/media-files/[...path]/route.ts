import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { lookup } from 'node:dns/promises';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

void lookup;

/**
 * Construit la liste des racines de stockage candidates.
 *
 * En monorepo, `process.cwd()` peut être :
 *   - `apps/web` (cas idéal : cwd = répertoire de l'app),
 *   - racine du monorepo (Next dev démarré depuis la racine).
 *
 * Le seed pipeline et le storage driver utilisent `process.cwd()`, donc
 * si le cwd change entre l'écriture (par exemple via tsx CLI) et la lecture
 * (route HTTP servie par le dev server), les fichiers sont écrits ici et
 * lus là — d'où le 404. On essaie chaque racine candidate jusqu'à trouver
 * un fichier existant.
 */
function candidateRoots(): string[] {
  const cwd = process.cwd();
  const baseDir = env.MEDIA_LOCAL_DIR;
  const roots = new Set<string>();
  if (isAbsolute(baseDir)) {
    roots.add(baseDir);
  } else {
    roots.add(resolve(cwd, baseDir));
    roots.add(resolve(cwd, 'apps/web', baseDir));
    roots.add(resolve(cwd, '..', baseDir));
    roots.add(resolve(cwd, '../..', baseDir));
  }
  return Array.from(roots);
}

function assertSafe(parts: string[]): void {
  for (const p of parts) {
    if (p.includes('..') || p.includes('\0')) throw new Error('invalid');
  }
}

async function resolveExistingPath(parts: string[]): Promise<string | null> {
  assertSafe(parts);
  const rel = join(...parts);
  for (const root of candidateRoots()) {
    const candidate = resolve(root, rel);
    const ok = await stat(candidate)
      .then((s) => s.isFile())
      .catch(() => false);
    if (ok) return candidate;
  }
  return null;
}

const TYPE_BY_EXT: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
};

export async function GET(
  _request: Request,
  { params }: { params: { path: string[] } },
): Promise<Response> {
  if (env.MEDIA_STORAGE_DRIVER !== 'local') {
    return new Response('not found', { status: 404 });
  }
  try {
    const path = await resolveExistingPath(params.path);
    if (!path) return new Response('not found', { status: 404 });
    const buf = await readFile(path);
    const ext = (path.split('.').pop() ?? '').toLowerCase();
    const contentType = TYPE_BY_EXT[ext] ?? 'application/octet-stream';
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('not found', { status: 404 });
  }
}

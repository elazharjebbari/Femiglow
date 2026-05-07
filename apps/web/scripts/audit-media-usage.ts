/**
 * Audit des `<img>` HTML dans `src/` pour la migration vers `<MediaImage>`.
 *
 * Usage : `pnpm tsx scripts/audit-media-usage.ts`
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (/\.(tsx|jsx|astro)$/.test(e.name)) yield full;
  }
}

const IMG_RE = /<img\s+[^>]*?src=(?:"([^"]+)"|\{([^}]+)\})/g;

async function main() {
  let dirStat;
  try {
    dirStat = await stat(ROOT);
  } catch {
    console.error(`[audit-media-usage] introuvable: ${ROOT}`);
    process.exit(1);
  }
  if (!dirStat.isDirectory()) {
    console.error(`[audit-media-usage] ${ROOT} n'est pas un répertoire`);
    process.exit(1);
  }

  const findings: Array<{ file: string; count: number; sources: string[] }> = [];
  for await (const file of walk(ROOT)) {
    const content = await readFile(file, 'utf8');
    const matches = Array.from(content.matchAll(IMG_RE));
    if (matches.length === 0) continue;
    const sources = matches.map((m) => m[1] ?? m[2] ?? '').filter(Boolean);
    findings.push({
      file: path.relative(process.cwd(), file),
      count: matches.length,
      sources,
    });
  }

  if (findings.length === 0) {
    console.log('[audit] aucun <img> trouvé.');
    return;
  }

  findings.sort((a, b) => b.count - a.count);
  console.log(`[audit] ${findings.length} fichiers avec <img>:\n`);
  for (const f of findings) {
    console.log(`  ${f.file} (${f.count})`);
    for (const s of f.sources) console.log(`    src=${s}`);
  }
  console.log(`\nTotal <img> à migrer: ${findings.reduce((s, f) => s + f.count, 0)}`);
}

main().catch((err) => {
  console.error('[audit-media-usage] erreur:', err);
  process.exit(1);
});

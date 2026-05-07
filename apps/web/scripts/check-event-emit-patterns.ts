/**
 * check-event-emit-patterns — lint statique des appels `emit(...)`.
 *
 * Bloque le merge sur les patterns à risque listés dans
 * docs/analytics/03-events-funnel-audit.md §6 :
 *
 * 1. `emit(...)` dans un useEffect SANS ref/flag d'idempotence (risque double-tir).
 * 2. `video_start` ou `video_user_play` émis dans un `onPlay` SANS condition de
 *    discrimination autoplay vs user (cf. M2 spec §6.1).
 * 3. `purchase` émis sans `transaction_id`.
 * 4. `emit(<dynamic>)` (string non littéral, complique l'audit).
 *
 * Sortie : exit 1 + liste des problèmes. Sinon exit 0 silencieux.
 *
 * Usage :  tsx scripts/check-event-emit-patterns.ts
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

interface Issue {
  file: string;
  line: number;
  rule: string;
  detail: string;
  excerpt: string;
}

const ROOT = path.join(import.meta.dirname ?? process.cwd(), '..', 'src');
const TEST_PATTERN = /\.(test|spec)\.(ts|tsx)$/;
const STORYBOOK_PATTERN = /\.stories\.(ts|tsx)$/;

const issues: Issue[] = [];

async function walk(dir: string, files: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      await walk(full, files);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      if (TEST_PATTERN.test(entry.name)) continue;
      if (STORYBOOK_PATTERN.test(entry.name)) continue;
      files.push(full);
    }
  }
  return files;
}

function checkFile(file: string, content: string): void {
  const lines = content.split('\n');

  // Pré-calcule pour heuristiques contextuelles
  const hasIdempotenceFlag = /useRef\([^)]*\)|sessionStorage|fired\.current/.test(
    content,
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // Rule 4: emit(<dynamic>)
    // Skip les primitives tracking (Track, TrackingGlobalListener, useTracking)
    // qui sont des émetteurs génériques par construction.
    const isTrackingPrimitive =
      /\/lib\/tracking\/(track|use-tracking|global-listener|client|provider)\.tsx?$/.test(
        file,
      );
    if (!isTrackingPrimitive) {
      const dynEmit = /\bemit\(\s*([a-zA-Z_$][\w$]*)\s*[,)]/.exec(line);
      if (dynEmit) {
        // Tolérance : variables nommées `eventName` ou `event` — patterns legit
        // pour les composants génériques type ScrollDepthTracker.
        const varName = dynEmit[1];
        if (varName !== 'eventName' && varName !== 'event') {
          issues.push({
            file,
            line: i + 1,
            rule: 'emit-dynamic-name',
            detail: `emit() avec nom non littéral "${varName}". Utiliser une string ou whitelister "eventName"/"event".`,
            excerpt: line.trim(),
          });
        }
      }
    }

    // Rule 3: purchase sans transaction_id
    if (/\bemit\(\s*['"`]purchase['"`]/.test(line)) {
      // Cherche dans les ~20 lignes qui suivent
      const block = lines.slice(i, Math.min(lines.length, i + 25)).join('\n');
      if (!/transaction_id/.test(block)) {
        issues.push({
          file,
          line: i + 1,
          rule: 'purchase-missing-tx-id',
          detail: 'emit("purchase") sans transaction_id (taxonomie GA4).',
          excerpt: line.trim(),
        });
      }
    }

    // Rule 2: video_start ou video_user_play sans discrimination
    if (
      /\bemit\(\s*['"`](video_start|video_user_play)['"`]/.test(line) &&
      !/userInitiatedRef|userInitiated|isUser/.test(content)
    ) {
      issues.push({
        file,
        line: i + 1,
        rule: 'video-play-no-user-check',
        detail:
          'emit("video_start"|"video_user_play") sans drapeau user-initiated (autoplay possible).',
        excerpt: line.trim(),
      });
    }

    // Rule 1: emit() dans un useEffect sans flag d'idempotence
    // Heuristique : on cherche les blocs useEffect qui contiennent un emit()
    // sans aucun garde (fired.current, sessionStorage, etc.) DANS le bloc.
  }

  // Rule 1 — analyse par bloc : on extrait chaque useEffect et on regarde s'il
  // contient `emit(` sans aucune protection d'idempotence dans le même bloc OU
  // dans le composant.
  const useEffectRegex = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = useEffectRegex.exec(content)) !== null) {
    const start = match.index;
    const lineIndex = content.slice(0, start).split('\n').length;
    let depth = 0;
    let i = start;
    while (i < content.length) {
      const c = content[i];
      if (c === '{') depth += 1;
      else if (c === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
      i += 1;
    }
    const block = content.slice(start, i + 1);
    if (/\bemit\(/.test(block)) {
      const hasGuard = /fired\.current|hasBeen|sessionStorage|once|return\s*;/.test(
        block,
      );
      if (!hasGuard && !hasIdempotenceFlag) {
        issues.push({
          file,
          line: lineIndex,
          rule: 'emit-in-effect-no-idempotence',
          detail:
            'emit() dans un useEffect sans flag d\u2019idempotence détecté (fired.current / sessionStorage).',
          excerpt: 'useEffect(() => { ...emit... })',
        });
      }
    }
  }
}

async function main(): Promise<void> {
  const files = await walk(ROOT);
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    if (!/\bemit\(/.test(content)) continue;
    checkFile(file, content);
  }

  if (issues.length === 0) {
    console.log('✓ check-event-emit-patterns: 0 issue.');
    process.exit(0);
  }

  console.error(
    `\n✗ check-event-emit-patterns: ${issues.length} issue(s) detected:\n`,
  );
  const grouped = new Map<string, Issue[]>();
  for (const issue of issues) {
    const list = grouped.get(issue.rule) ?? [];
    list.push(issue);
    grouped.set(issue.rule, list);
  }
  for (const [rule, list] of grouped) {
    console.error(`\n[${rule}] ${list.length} issue(s):`);
    for (const i of list) {
      const rel = path.relative(process.cwd(), i.file);
      console.error(`  ${rel}:${i.line} — ${i.detail}`);
      console.error(`    ${i.excerpt}`);
    }
  }
  console.error('');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

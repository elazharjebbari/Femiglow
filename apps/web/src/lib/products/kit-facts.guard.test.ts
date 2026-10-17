/**
 * Garde-fou de cohérence produit : aucune surface publique ne doit
 * contredire la fiche de référence `kit-facts.ts`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KIT_FACTS, KIT_FORBIDDEN_CLAIMS } from './kit-facts';

const APP_ROOT = join(__dirname, '..', '..', '..');

/** Surfaces qui énoncent des faits produit aux visiteuses (ou au chat IA). */
const SCANNED = [
  'messages',
  'content/chat-knowledge',
  'src/data/mock',
  'src/app/(marketing)',
  'src/app/[locale]',
  'src/app/(commerce)',
  'src/components/sections',
  'src/components/kit',
  'src/components/commerce',
  'src/components/marketing',
  'src/lib/products',
  'src/lib/components/registry.ts',
  'src/lib/chat/instruction-defaults.ts',
  'src/lib/mail/templates',
  'scripts/seed-products.ts',
];

const EXCLUDED = /(\.test\.|\.spec\.|__tests__|kit-facts\.ts$)/;
const EXTENSIONS = /\.(ts|tsx|json|md|mjs)$/;

function collect(path: string): string[] {
  const abs = join(APP_ROOT, path);
  let stat;
  try {
    stat = statSync(abs);
  } catch {
    return [];
  }
  if (stat.isFile()) return EXTENSIONS.test(abs) && !EXCLUDED.test(abs) ? [abs] : [];
  return readdirSync(abs).flatMap((entry) => collect(join(path, entry)));
}

/** Retire les commentaires de code : seule la copie publiée compte. */
function stripComments(source: string, file: string): string {
  if (!/\.(ts|tsx|mjs)$/.test(file)) return source;
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

describe('fiche de référence du pack', () => {
  it('reste cohérente avec elle-même', () => {
    expect(KIT_FACTS.gestures).toHaveLength(4);
    expect(KIT_FACTS.certifications).toHaveLength(0);
    expect(KIT_FACTS.packMonths * 4).toBeGreaterThanOrEqual(KIT_FACTS.treatmentsPerPack - 1);
  });

  it('aucune surface publique ne la contredit', () => {
    const files = SCANNED.flatMap(collect);
    expect(files.length).toBeGreaterThan(50);

    const violations: string[] = [];
    for (const file of files) {
      const lines = stripComments(readFileSync(file, 'utf8'), file).split('\n');
      lines.forEach((line, index) => {
        for (const { pattern, why } of KIT_FORBIDDEN_CLAIMS) {
          if (pattern.test(line)) {
            violations.push(`${relative(APP_ROOT, file)}:${index + 1} — ${why}`);
          }
        }
      });
    }
    expect(violations).toEqual([]);
  });
});

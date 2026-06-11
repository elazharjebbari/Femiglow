/**
 * LEGAL-V2 — Test invariant : aucune occurrence du prénom de la fondatrice
 * dans les pages marketing publiques.
 *
 * Empêche la régression future si quelqu'un ajoute le prénom dans une page
 * indexée par les moteurs de recherche.
 *
 * Note : ne couvre PAS les fichiers admin internes (ex: rituals/best-practices)
 * qui sont opt-in selon ADR-008.
 *
 * Cf. docs/pages-legales-fix-2026-05/03-frontend-ui-ux/anonymisation-marketing.md
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MARKETING_DIR = join(process.cwd(), 'src/app/(marketing)');
const SEO_DIR = join(process.cwd(), 'src/lib/seo');
const FOUNDER_PATTERN = /souhei[lï]a/i;
// LEGAL-V2 — Couvrir aussi src/lib/seo/ (JSON-LD rendu sur toutes les pages
// marketing via <JsonLd schema={...} />).
const SCANNED_DIRS = [MARKETING_DIR, SEO_DIR];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(p));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      out.push(p);
    }
  }
  return out;
}

describe('marketing pages — anonymisation prénom fondatrice', () => {
  it('aucune occurrence dans les pages marketing publiques + SEO JSON-LD', () => {
    const files = SCANNED_DIRS.flatMap(walk);
    const violations: Array<{ file: string; line: number; content: string }> = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (FOUNDER_PATTERN.test(line)) {
          violations.push({
            file: file.replace(process.cwd(), '.'),
            line: i + 1,
            content: line.trim().slice(0, 100),
          });
        }
      }
    }

    if (violations.length > 0) {
      const detail = violations
        .map((v) => `  ${v.file}:${v.line}\n    ${v.content}`)
        .join('\n\n');
      throw new Error(
        `\nPrénom fondatrice trouvé dans pages marketing publiques (LEGAL-V2 D5) :\n\n${detail}\n\n` +
          `→ Remplacer par "notre fondatrice", "notre équipe", ou similaire.\n`,
      );
    }

    expect(violations).toEqual([]);
  });
});

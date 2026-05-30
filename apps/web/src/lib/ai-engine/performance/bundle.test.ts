import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = join(__dirname, '../../../..');

/**
 * Recursively collect all .ts and .tsx files in a directory,
 * skipping node_modules, .next, test files, and hidden directories.
 */
function collectFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules' || entry === '.next' || entry === 'coverage') {
      continue;
    }
    const fullPath = join(dir, entry);
    let st;
    try {
      st = statSync(fullPath);
    } catch {
      continue;
    }

    if (st.isDirectory()) {
      results.push(...collectFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      // Skip test files
      if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx') || entry.endsWith('.spec.ts') || entry.endsWith('.spec.tsx')) {
        continue;
      }
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Find files that contain imports matching a pattern.
 */
function findImportsInDir(dir: string, pattern: RegExp): string[] {
  const files = collectFiles(dir, ['.ts', '.tsx']);
  const matches: string[] = [];
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      if (pattern.test(content)) {
        matches.push(file);
      }
    } catch {
      // Skip unreadable files
    }
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Bundle isolation tests
// ---------------------------------------------------------------------------

describe('AI Engine — bundle isolation (no heavy imports in client code)', () => {
  it('@langchain/langgraph is not imported in any client component (only in lib/ai-engine)', () => {
    const componentsDir = join(PROJECT_ROOT, 'src/components');
    const pattern = /from\s+['"]@langchain\/langgraph['"]/;
    const matches = findImportsInDir(componentsDir, pattern);

    expect(matches).toEqual([]);
  });

  it('LangGraph imports are only in files under src/lib/ai-engine/ and src/app/api/', () => {
    const srcDir = join(PROJECT_ROOT, 'src');
    const pattern = /from\s+['"]@langchain\/(langgraph|openai|anthropic|google-genai|core)['"]/;
    const matches = findImportsInDir(srcDir, pattern);

    const allowedPrefixes = [
      join(PROJECT_ROOT, 'src/lib/ai-engine'),
      join(PROJECT_ROOT, 'src/app/api'),
    ];

    const violations = matches.filter(
      (file) => !allowedPrefixes.some((prefix) => file.startsWith(prefix)),
    );

    expect(violations).toEqual([]);
  });

  it('no ai-engine imports in files under src/components/', () => {
    const componentsDir = join(PROJECT_ROOT, 'src/components');
    // Check for direct imports of ai-engine modules
    const pattern = /from\s+['"]@\/lib\/ai-engine/;
    const matches = findImportsInDir(componentsDir, pattern);

    expect(matches).toEqual([]);
  });
});

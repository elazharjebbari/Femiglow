import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = join(__dirname, '../../../..');

/**
 * Recursively collect all route.ts files under the ai-engine API directory.
 */
function collectRouteFiles(dir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const fullPath = join(dir, entry);
    let st;
    try {
      st = statSync(fullPath);
    } catch {
      continue;
    }

    if (st.isDirectory()) {
      results.push(...collectRouteFiles(fullPath));
    } else if (entry === 'route.ts') {
      results.push(fullPath);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// CORS safety tests
// ---------------------------------------------------------------------------

describe('AI Engine — CORS safety (no wildcard headers in route handlers)', () => {
  const aiEngineApiDir = join(PROJECT_ROOT, 'src/app/api/admin/ai-engine');
  const routeFiles = collectRouteFiles(aiEngineApiDir);

  it('finds at least one AI engine route file', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it('no route handler sets Access-Control-Allow-Origin to wildcard "*"', () => {
    const violations: string[] = [];

    for (const file of routeFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        // Check for explicit CORS wildcard header
        if (
          content.includes("'Access-Control-Allow-Origin'") &&
          content.includes("'*'")
        ) {
          violations.push(file);
        }
        if (
          content.includes('"Access-Control-Allow-Origin"') &&
          content.includes('"*"')
        ) {
          violations.push(file);
        }
      } catch {
        // Skip unreadable files
      }
    }

    expect(violations).toEqual([]);
  });

  it('no wildcard CORS pattern in any AI engine route handler', () => {
    const corsPatterns = [
      /Access-Control-Allow-Origin['"]\s*,\s*['"]\*/,
      /['"]Access-Control-Allow-Origin['"].*['"]?\*['"]?/,
      /cors\(\s*\{\s*origin\s*:\s*['"]\*['"]/,
      /res\.setHeader\s*\(\s*['"]Access-Control-Allow-Origin['"],\s*['"]?\*['"]?\)/,
    ];

    const violations: string[] = [];

    for (const file of routeFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        for (const pattern of corsPatterns) {
          if (pattern.test(content)) {
            violations.push(`${file} matches ${pattern.source}`);
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    expect(violations).toEqual([]);
  });
});

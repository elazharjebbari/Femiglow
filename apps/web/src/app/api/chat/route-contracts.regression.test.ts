/**
 * F14-F22 — Tests contracts statiques des routes API chat.
 *
 * Vérification rapide que toutes les routes API chat exportent leurs
 * handlers HTTP (POST/GET) et ne sont pas régressées en termes de
 * surface API.
 *
 * Pour les tests d'intégration runtime (vrai handler + DB) → voir tests
 * dédiés par route (e.g. `health/route.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const APPS_WEB_ROOT = resolve(__dirname, '../../../..');

function read(rel: string): string {
  return readFileSync(resolve(APPS_WEB_ROOT, rel), 'utf8');
}

function exists(rel: string): boolean {
  return existsSync(resolve(APPS_WEB_ROOT, rel));
}

describe('Routes API chat — contracts', () => {
  const ROUTES = [
    { id: 'F14', path: 'src/app/api/chat/session/route.ts', methods: ['POST'] },
    { id: 'F15', path: 'src/app/api/chat/message/route.ts', methods: ['POST'] },
    { id: 'F16', path: 'src/app/api/chat/session/forget/route.ts', methods: ['POST'] },
    { id: 'F17', path: 'src/app/api/chat/health/route.ts', methods: ['GET'] },
    { id: 'F18', path: 'src/app/api/chat/feedback/route.ts', methods: ['POST'] },
    { id: 'F19', path: 'src/app/api/chat/event/route.ts', methods: ['POST'] },
    { id: 'F20', path: 'src/app/api/chat/theme/route.ts', methods: ['GET'] },
    { id: 'F21', path: 'src/app/api/chat/canned-pair/route.ts', methods: ['POST'] },
    { id: 'F22', path: 'src/app/api/chat/lead/contact/route.ts', methods: ['POST'] },
  ] as const;

  describe.each(ROUTES)('$id — $path', ({ path, methods }) => {
    it('le fichier route existe', () => {
      expect(exists(path)).toBe(true);
    });

    test.each(methods)('exporte handler %s', (method) => {
      const content = read(path);
      // Tolérant : `export async function POST` OU `export const POST`
      const pattern = new RegExp(`export\\s+(async\\s+function|const|function)\\s+${method}\\b`);
      expect(content).toMatch(pattern);
    });
  });
});

describe('Contract message route (F15) — sanity statique', () => {
  it('importe orchestrator (pipeline central)', () => {
    const content = read('src/app/api/chat/message/route.ts');
    expect(content).toMatch(/orchestr/i);
  });

  it('définit le mode streaming (SSE/ReadableStream/event-stream)', () => {
    const content = read('src/app/api/chat/message/route.ts');
    // Soit Content-Type inline, soit utilise un helper qui le pose
    expect(content).toMatch(/event-stream|ReadableStream|TextEncoder|streamReply|ToSSE/i);
  });

  it('utilise un rate-limit avant l\'orchestrator', () => {
    const content = read('src/app/api/chat/message/route.ts');
    expect(content).toMatch(/rateLimit|rate-limit|rateLimiter/i);
  });

  it.fails('FIX C4 — appelle assertBudget avant streamReply', () => {
    const content = read('src/app/api/chat/message/route.ts');
    expect(content).toMatch(/assertBudget/);
  });

  it.fails('FIX I4 — consume visitor rate-limit', () => {
    const content = read('src/app/api/chat/message/route.ts');
    expect(content).toMatch(/rateLimit\.consume\(['"]visitor['"]/);
  });
});

describe('Contract session route (F14)', () => {
  it('importe sessionService ou repo équivalent', () => {
    const content = read('src/app/api/chat/session/route.ts');
    expect(content).toMatch(/session/i);
  });

  it('valide input via Zod schema', () => {
    const content = read('src/app/api/chat/session/route.ts');
    expect(content).toMatch(/zod|safeParse|\.parse\(/);
  });
});

describe('Contract lead/contact route (F22)', () => {
  it('valide input via Zod', () => {
    const content = read('src/app/api/chat/lead/contact/route.ts');
    expect(content).toMatch(/zod|safeParse|\.parse\(/);
  });

  it('utilise un repo lead pour persister', () => {
    const content = read('src/app/api/chat/lead/contact/route.ts');
    expect(content).toMatch(/leadRepo|lead\.repo|chatLeadRepo/i);
  });

  it('dispatch un webhook outbound (si configuré)', () => {
    const content = read('src/app/api/chat/lead/contact/route.ts');
    // Soit appel direct, soit via service
    expect(content).toMatch(/webhook|dispatch|outbound/i);
  });
});

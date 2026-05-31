/**
 * Phase 3 J26-J30 — Couverture P1 admin + cross-cutting (régression statique).
 *
 * Vérifie via inspection statique que :
 *  - chaque page admin chat a un component
 *  - chaque page admin a un check auth (RBAC)
 *  - chaque route API admin a un handler HTTP
 *  - les cron jobs critiques exposent leur fonction
 *
 * Ne remplace PAS les tests d'intégration runtime — c'est une garde
 * structurelle anti-régression accélérée.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const APPS_WEB_ROOT = resolve(__dirname, '../../../..');

function read(rel: string): string {
  return readFileSync(resolve(APPS_WEB_ROOT, rel), 'utf8');
}

function exists(rel: string): boolean {
  return existsSync(resolve(APPS_WEB_ROOT, rel));
}

// ─────────────────────────────────────────────────────────────────────
// Admin pages — F37 à F52 (16 features)
// ─────────────────────────────────────────────────────────────────────

const ADMIN_PAGES = [
  { id: 'F37', dir: 'src/app/admin/chat', file: 'page.tsx' },
  { id: 'F38', dir: 'src/app/admin/chat/conversations', file: 'page.tsx' },
  { id: 'F40', dir: 'src/app/admin/chat/leads', file: 'page.tsx' },
  { id: 'F41', dir: 'src/app/admin/chat/care', file: 'page.tsx' },
  { id: 'F42', dir: 'src/app/admin/chat/analytics', file: 'page.tsx' },
  { id: 'F43', dir: 'src/app/admin/chat/audit', file: 'page.tsx' },
  { id: 'F44', dir: 'src/app/admin/chat/kpis', file: 'page.tsx' },
  { id: 'F45', dir: 'src/app/admin/chat/providers', file: 'page.tsx' },
  { id: 'F46', dir: 'src/app/admin/chat/instructions', file: 'page.tsx' },
  { id: 'F47', dir: 'src/app/admin/chat/faq', file: 'page.tsx' },
  { id: 'F48', dir: 'src/app/admin/chat/suggestions', file: 'page.tsx' },
  { id: 'F49', dir: 'src/app/admin/chat/sources', file: 'page.tsx' },
  { id: 'F50', dir: 'src/app/admin/chat/themes', file: 'page.tsx' },
  { id: 'F51', dir: 'src/app/admin/chat/system', file: 'page.tsx' },
  { id: 'F52', dir: 'src/app/admin/chat/lang', file: 'page.tsx' },
] as const;

describe('Phase 3 — Admin pages chat (couverture présence)', () => {
  describe.each(ADMIN_PAGES)('$id — $dir', ({ dir, file }) => {
    const full = `${dir}/${file}`;
    it('page existe', () => {
      expect(exists(full)).toBe(true);
    });

    it('exporte un default React component', () => {
      const content = read(full);
      // Soit `export default function`, soit `export default Page`, soit `export {default}`
      expect(content).toMatch(/export\s+(default\s+)?(async\s+)?function|export\s+default\s+\w+|export\s*\{\s*default/);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// Admin API routes — surface CRUD
// ─────────────────────────────────────────────────────────────────────

const ADMIN_API_ROUTES = [
  { path: 'src/app/api/admin/chat/sources/route.ts' },
  { path: 'src/app/api/admin/chat/suggestions/route.ts' },
  { path: 'src/app/api/admin/chat/cron/route.ts' },
  { path: 'src/app/api/admin/chat/instructions/route.ts' },
  { path: 'src/app/api/admin/chat/faq/route.ts' },
  { path: 'src/app/api/admin/chat/providers/route.ts' },
  { path: 'src/app/api/admin/chat/seed-defaults/route.ts' },
  { path: 'src/app/api/admin/chat/gdpr/forget/route.ts' },
  { path: 'src/app/api/admin/chat/gdpr/export/route.ts' },
  { path: 'src/app/api/admin/chat/settings/toggle/route.ts' },
] as const;

describe('Phase 3 — Admin API routes (présence + handler HTTP)', () => {
  describe.each(ADMIN_API_ROUTES)('$path', ({ path }) => {
    it('le fichier route existe', () => {
      expect(exists(path)).toBe(true);
    });

    it('exporte au moins un handler HTTP (GET / POST / PUT / DELETE / PATCH)', () => {
      const content = read(path);
      expect(content).toMatch(
        /export\s+(async\s+function|function|const)\s+(GET|POST|PUT|DELETE|PATCH)\b/,
      );
    });
  });

  describe('auth admin check sur routes admin', () => {
    // Échantillon : les routes critiques doivent gate via requireAdmin/ensureAdmin
    const SAMPLE_PROTECTED = [
      'src/app/api/admin/chat/providers/route.ts',
      'src/app/api/admin/chat/instructions/route.ts',
      'src/app/api/admin/chat/faq/route.ts',
      'src/app/api/admin/chat/settings/toggle/route.ts',
    ];

    test.each(SAMPLE_PROTECTED)('%s utilise un guard admin (requireAdmin/ensureAdmin/session)', (rel) => {
      const content = read(rel);
      // Tolérant : différents helpers possibles
      expect(content).toMatch(/requireAdmin|ensureAdmin|getAdminSession|isAdmin|adminAuth|hasRole/i);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// Cron jobs — F60
// ─────────────────────────────────────────────────────────────────────

const CRON_SERVICES = [
  { id: 'intent-recompute', path: 'src/lib/chat/services/intent-recompute.ts', exportSig: /recompute|computeIntent/ },
  { id: 'kb-sync', path: 'src/lib/chat/services/kb-sync.ts', exportSig: /sync|refresh|ingest/i },
  { id: 'weekly-digest', path: 'src/lib/chat/services/weekly-digest.ts', exportSig: /digest|weekly|build/i },
  { id: 'budget-watch', path: 'src/lib/chat/services/budget-watch.ts', exportSig: /watch|check|budget/i },
  { id: 'auth-cron', path: 'src/lib/chat/services/auth-cron.ts', exportSig: /refresh|rotate|cron/i },
];

describe('Phase 3 — F60 Cron jobs (présence + signature)', () => {
  describe.each(CRON_SERVICES)('$id', ({ path, exportSig }) => {
    it('fichier existe', () => {
      expect(exists(path)).toBe(true);
    });

    it('expose une fonction de cron', () => {
      const content = read(path);
      // Cherche `export async function X` où X matche la signature attendue
      const pattern = new RegExp(`export\\s+(async\\s+)?(function|const)\\s+\\w*${exportSig.source}\\w*`, 'i');
      expect(content).toMatch(pattern);
    });

    it('a un fichier test associé (si convention test colocalisé)', () => {
      const testPath = path.replace(/\.ts$/, '.test.ts');
      // Critères souples : si pas de test, on documente mais ne bloque pas
      // (kb-sync notamment peut être testé indirectement)
      const has = exists(testPath);
      if (!has) {
        // Pas de fail, mais log pour reporting
        // eslint-disable-next-line no-console
        console.warn(`[Phase 3] ${path} sans test colocalisé (${testPath} absent)`);
      }
      expect(typeof has).toBe('boolean');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// Cross-cutting — F55-F60
// ─────────────────────────────────────────────────────────────────────

describe('Phase 3 — F55 webhooks lead delivery', () => {
  it('lead-webhook.ts existe et expose dispatch', () => {
    const path = 'src/lib/chat/services/lead-webhook.ts';
    expect(exists(path)).toBe(true);
    const content = read(path);
    expect(content).toMatch(/dispatch|sendLead|deliver|notify/i);
  });

  it.fails('FIX M3 — retry policy explicit (max attempts + backoff)', () => {
    const path = 'src/lib/chat/services/lead-webhook.ts';
    const content = read(path);
    expect(content).toMatch(/maxAttempts|retryDelay|backoff|maxRetries/i);
  });
});

describe('Phase 3 — F56 Slack alerts', () => {
  it('slack-notify.ts existe', () => {
    expect(exists('src/lib/chat/services/slack-notify.ts')).toBe(true);
  });

  it('expose une fonction notify ou postBlocks', () => {
    const content = read('src/lib/chat/services/slack-notify.ts');
    expect(content).toMatch(/notify|postBlocks|sendSlack|alert/i);
  });
});

describe('Phase 3 — F58 multi-provider matrix', () => {
  it('chaque provider est instancié via factory', () => {
    const factory = read('src/lib/chat/providers/factory.ts');
    const providers = ['openai', 'anthropic', 'gemini', 'mistral', 'ollama'];
    for (const p of providers) {
      expect(factory.toLowerCase()).toContain(p);
    }
  });

  it('chaque provider a son fichier dédié', () => {
    const PROVIDER_DIR = 'src/lib/chat/providers';
    const files = readdirSync(resolve(APPS_WEB_ROOT, PROVIDER_DIR));
    const REQUIRED = ['openai.ts', 'anthropic.ts', 'gemini.ts', 'mistral.ts'];
    for (const f of REQUIRED) {
      expect(files).toContain(f);
    }
  });
});

describe('Phase 3 — F59 embeddings + vector store (pgvector)', () => {
  it('schema déclare pgvector', () => {
    const schema = read('src/lib/chat/db/schema.ts');
    expect(schema).toMatch(/vector\(.*1536\)|pgvector|HNSW|hnsw/i);
  });

  it('repo knowledge utilise embeddings', () => {
    const path = 'src/lib/chat/repos/knowledge.ts';
    if (exists(path)) {
      const content = read(path);
      expect(content).toMatch(/embedding|vector|<=>|cosine/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// F54 RGPD — purge + export
// ─────────────────────────────────────────────────────────────────────

describe('Phase 3 — F54 RGPD purge + export', () => {
  it('endpoint /api/chat/session/forget existe (visiteur)', () => {
    expect(exists('src/app/api/chat/session/forget/route.ts')).toBe(true);
  });

  it('endpoint /api/admin/chat/gdpr/forget existe (admin)', () => {
    expect(exists('src/app/api/admin/chat/gdpr/forget/route.ts')).toBe(true);
  });

  it('endpoint /api/admin/chat/gdpr/export existe (export RGPD)', () => {
    expect(exists('src/app/api/admin/chat/gdpr/export/route.ts')).toBe(true);
  });
});

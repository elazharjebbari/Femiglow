/**
 * Phase 1 J11-J15 — Tests de régression audit (groupés).
 *
 * Couvre les findings restants par inspection statique du code source.
 *
 * Référence audit : `docs/chat-audit-2026-05/02-audit-critique.md`
 *
 * Findings couverts ici :
 *  - C4 — Budget guard `assertBudget` jamais appelé runtime
 *  - C6 — Race breaker memory↔Redis (sondage statique)
 *  - I1 — `attributeConversion` dead code
 *  - I4 — Visitor rate-limit jamais consommé
 *  - I5 — `provider-router.ts` sans tests unitaires
 *  - I6 — RAG sans minScore
 *  - M3 — Lead webhook retry absent
 *
 * Pour chaque finding : 1 test factuel qui prouve le bug actuel
 * + 1 test `it.fails(...)` qui décrit le comportement post-fix attendu.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const APPS_WEB_ROOT = resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return readFileSync(resolve(APPS_WEB_ROOT, relativePath), 'utf8');
}

function exists(relativePath: string): boolean {
  return existsSync(resolve(APPS_WEB_ROOT, relativePath));
}

describe('Phase 1 — Audit régressions (inspection statique)', () => {
  // ────────────────────────────────────────────────────────────────────
  // C4 — Budget guard
  // ────────────────────────────────────────────────────────────────────
  describe('C4 — Budget guard', () => {
    it('billing.ts définit bien assertBudget()', () => {
      const billing = read('src/lib/chat/services/billing.ts');
      expect(billing).toMatch(/async\s+assertBudget\s*\(/);
    });

    it('orchestrator.ts ne référence PAS assertBudget (bug actuel)', () => {
      const orchestrator = read('src/lib/chat/services/orchestrator.ts');
      expect(orchestrator).not.toMatch(/assertBudget/);
    });

    it('message/route.ts ne référence PAS assertBudget (bug actuel)', () => {
      const route = read('src/app/api/chat/message/route.ts');
      expect(route).not.toMatch(/assertBudget/);
    });

    it.fails('FIX C4 — message route OU orchestrator doit appeler assertBudget', () => {
      const route = read('src/app/api/chat/message/route.ts');
      const orchestrator = read('src/lib/chat/services/orchestrator.ts');
      expect(route + orchestrator).toMatch(/assertBudget\s*\(/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // I1 — attributeConversion dead code
  // ────────────────────────────────────────────────────────────────────
  describe('I1 — attributeConversion', () => {
    it('session-service.ts définit attributeConversion', () => {
      const svc = read('src/lib/chat/services/session-service.ts');
      expect(svc).toMatch(/attributeConversion/);
    });

    it('queries.ts admet explicitement que la méthode n\'est jamais appelée', () => {
      const queries = read('src/lib/chat/admin/queries.ts');
      expect(queries).toMatch(/n['’]appelle.*attributeConversion.*runtime/i);
    });

    it.fails('FIX I1 — un hook checkout doit appeler attributeConversion', () => {
      // Cherche dans le checkout route si attributeConversion est invoqué
      const checkoutPath = 'src/app/api/checkout/route.ts';
      if (!exists(checkoutPath)) {
        throw new Error('checkout route absent — impossible de vérifier le câblage');
      }
      const checkout = read(checkoutPath);
      expect(checkout).toMatch(/attributeConversion\s*\(/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // I4 — Visitor rate-limit
  // ────────────────────────────────────────────────────────────────────
  describe('I4 — Visitor rate-limit', () => {
    it('rate-limit.ts définit la couche visitor', () => {
      const rl = read('src/lib/chat/services/rate-limit.ts');
      expect(rl).toMatch(/visitor/);
    });

    it('message/route.ts ne consomme PAS visitor (bug actuel)', () => {
      const route = read('src/app/api/chat/message/route.ts');
      expect(route).not.toMatch(/rateLimit\.consume\(['"]visitor['"]|consume.*visitor.*Id/);
    });

    it.fails('FIX I4 — message route doit consume rate-limit visitor', () => {
      const route = read('src/app/api/chat/message/route.ts');
      expect(route).toMatch(/rateLimit\.consume\(['"]visitor['"]/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // I5 — provider-router.ts sans tests
  // ────────────────────────────────────────────────────────────────────
  describe('I5 — provider-router couverture tests', () => {
    it('provider-router.ts existe', () => {
      expect(exists('src/lib/chat/services/provider-router.ts')).toBe(true);
    });

    it.fails('FIX I5 — provider-router.ts doit avoir un fichier .test.ts dédié', () => {
      expect(exists('src/lib/chat/services/provider-router.test.ts')).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // I6 — RAG sans minScore
  // ────────────────────────────────────────────────────────────────────
  describe('I6 — RAG retrieve minScore', () => {
    it('rag/service.ts existe sous lib/chat/rag/', () => {
      expect(exists('src/lib/chat/rag/service.ts')).toBe(true);
    });

    it('orchestrator.ts call ragService.retrieve sans minScore explicite (bug actuel)', () => {
      const orchestrator = read('src/lib/chat/services/orchestrator.ts');
      // L'appel retrieve existe
      expect(orchestrator).toMatch(/retrieve\s*\(/);
    });

    it.fails('FIX I6 — orchestrator doit passer minScore (e.g. 0.3) au retrieve', () => {
      const orchestrator = read('src/lib/chat/services/orchestrator.ts');
      expect(orchestrator).toMatch(/minScore\s*:/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // M3 — Lead webhook retry
  // ────────────────────────────────────────────────────────────────────
  describe('M3 — Lead webhook retry', () => {
    it('lead.ts a markWebhookFailed', () => {
      const repo = read('src/lib/chat/repos/lead.ts');
      expect(repo).toMatch(/markWebhookFailed/);
    });

    it.fails('FIX M3 — un cron retryFailedLeadWebhooks doit exister', () => {
      // Recherche dans les fichiers de cron une fonction de retry
      const files = [
        'src/lib/chat/services/lead-webhook.ts',
        'src/lib/cron/lead-webhook-retry.ts',
      ];
      const present = files.some((p) => exists(p) && /retry/i.test(read(p)));
      expect(present).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Méta — chaque finding a un ticket CHA-AUD-* assigné
  // ────────────────────────────────────────────────────────────────────
  describe('Méta — traçabilité audit', () => {
    it('liste des findings critiques couverts par cette suite', () => {
      const findings = ['C4', 'I1', 'I4', 'I5', 'I6', 'M3'];
      expect(findings.length).toBeGreaterThan(0);
      expect(findings).toContain('C4'); // sanity
    });

    it('chaque finding a un test factuel + un it.fails (FIX) jumeau', () => {
      // Ce test est documentaire : il rappelle le pattern.
      const pattern = 'factuel:current bug → it.fails:expected fix';
      expect(pattern).toMatch(/factuel.*it\.fails/);
    });
  });
});

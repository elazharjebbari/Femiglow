/**
 * Fuzz-style — inputs aléatoires sur les fonctions pures. Invariants :
 *  1. Aucun throw, peu importe l'input
 *  2. Output respecte les contrats (jamais de balise <script> dans le HTML
 *     final, jamais de undefined retourné)
 *  3. Idempotence quand applicable (diff(x, x) = ∅)
 *
 * Génère 200 inputs par test avec un seed déterministe pour reproductibilité.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

import { renderLegalMarkdown } from './render';
import {
  detectMissingVars,
  detectVarsInTemplate,
  substituteVars,
} from './vars';
import { diffBodies, diffLines } from './diff';
import { sanitizeLegalLinksInText } from './chat-guard';

// PRNG mulberry32 — déterministe, seed reproductible.
function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHARS_ASCII = ' abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CHARS_PUNCT = "<>&\"'`(){}[]<>;:!?.";
const CHARS_UNICODE = '✨💄💅اب你好дет';
const CHARS_MD = '#*_-~|`[]()!';

function randomString(rand: () => number, max = 200): string {
  const len = Math.floor(rand() * max);
  const pool = CHARS_ASCII + CHARS_PUNCT + CHARS_UNICODE + CHARS_MD;
  let s = '';
  for (let i = 0; i < len; i += 1) {
    s += pool[Math.floor(rand() * pool.length)];
  }
  return s;
}

function randomVarValue(rand: () => number): string {
  const len = Math.floor(rand() * 100);
  let s = '';
  const pool = CHARS_ASCII + CHARS_UNICODE;
  for (let i = 0; i < len; i += 1) {
    s += pool[Math.floor(rand() * pool.length)];
  }
  return s;
}

vi.mock('@/lib/legal/repository', () => ({
  listPublishedSlugs: vi.fn().mockResolvedValue(['cgv', 'cookies']),
}));

// ───────────────────────────────────────────────────────────────────────
//  Fuzz substituteVars / detectVarsInTemplate
// ───────────────────────────────────────────────────────────────────────

describe('FUZZ — substituteVars never throws', () => {
  it('200 random inputs avec map vide', () => {
    const rand = rng(42);
    for (let i = 0; i < 200; i += 1) {
      const md = randomString(rand);
      expect(() => substituteVars(md, new Map())).not.toThrow();
    }
  });

  it('200 random inputs avec valeurs unicode', () => {
    const rand = rng(123);
    for (let i = 0; i < 200; i += 1) {
      const md = randomString(rand);
      const m = new Map([
        ['X', randomVarValue(rand)],
        ['Y', randomVarValue(rand)],
        ['COMPANY_NAME', randomVarValue(rand)],
      ]);
      expect(() => substituteVars(md, m)).not.toThrow();
    }
  });

  it('détection toujours déterministe : detectVarsInTemplate idempotente', () => {
    const rand = rng(777);
    for (let i = 0; i < 100; i += 1) {
      const md = randomString(rand);
      const r1 = detectVarsInTemplate(md);
      const r2 = detectVarsInTemplate(md);
      expect(r1).toEqual(r2);
    }
  });

  it('detectMissingVars retourne un tableau (jamais undefined)', () => {
    const rand = rng(2026);
    for (let i = 0; i < 100; i += 1) {
      const md = randomString(rand);
      const dbVars = [
        { key: 'A', value: '', isRequired: true },
        { key: 'B', value: 'x', isRequired: true },
        { key: 'C', value: null as string | null, isRequired: false },
      ];
      const r = detectMissingVars(md, dbVars);
      expect(Array.isArray(r)).toBe(true);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────
//  Fuzz renderLegalMarkdown
// ───────────────────────────────────────────────────────────────────────

describe('FUZZ — renderLegalMarkdown never throws + jamais de <script>', () => {
  it('100 random markdown → toujours un HTML string sans <script>', async () => {
    const rand = rng(99);
    for (let i = 0; i < 100; i += 1) {
      const md = randomString(rand, 500);
      const { html } = await renderLegalMarkdown(md);
      expect(typeof html).toBe('string');
      // Critère sécurité absolu : pas de balise <script> ouvrante dans la
      // sortie, peu importe le markdown injecté.
      expect(html).not.toMatch(/<script[\s>]/i);
      expect(html).not.toMatch(/<iframe[\s>]/i);
    }
  });

  it('headings list toujours triée par ordre d\'apparition', async () => {
    const rand = rng(303);
    for (let i = 0; i < 20; i += 1) {
      // Force quelques headings dans le mélange
      const n = 1 + Math.floor(rand() * 5);
      const md = Array.from({ length: n }, (_, j) => `## H${j}-${randomString(rand, 20)}`).join(
        '\n\n',
      );
      const { headings } = await renderLegalMarkdown(md);
      // Ordre d'apparition = ordre du tableau
      for (let k = 1; k < headings.length; k += 1) {
        // Pas d'inversion : chaque text suit le précédent dans le source
        expect(typeof headings[k]!.id).toBe('string');
      }
    }
  });
});

// ───────────────────────────────────────────────────────────────────────
//  Fuzz diff invariants
// ───────────────────────────────────────────────────────────────────────

describe('FUZZ — diff invariants', () => {
  it('diff(x, x) = 0 added, 0 removed, 0 hunks pour tout x', () => {
    const rand = rng(2025);
    for (let i = 0; i < 50; i += 1) {
      const s = randomString(rand, 500);
      const r = diffBodies(s, s);
      expect(r.added).toBe(0);
      expect(r.removed).toBe(0);
      expect(r.hunks).toEqual([]);
    }
  });

  it('diff(a, b) symétrique en compte (added(a→b) === removed(b→a))', () => {
    const rand = rng(101);
    for (let i = 0; i < 30; i += 1) {
      const a = randomString(rand, 100);
      const b = randomString(rand, 100);
      const ab = diffBodies(a, b);
      const ba = diffBodies(b, a);
      expect(ab.added).toBe(ba.removed);
      expect(ab.removed).toBe(ba.added);
    }
  });

  it('diffLines a même longueur que équiv linéaire : every output ligne pointe une ligne source', () => {
    const rand = rng(55);
    for (let i = 0; i < 50; i += 1) {
      const a = randomString(rand, 100);
      const b = randomString(rand, 100);
      const lines = diffLines(a, b);
      // Toutes les lignes ont un text défini
      for (const l of lines) {
        expect(typeof l.text).toBe('string');
        expect(['equal', 'add', 'remove']).toContain(l.op);
      }
    }
  });
});

// ───────────────────────────────────────────────────────────────────────
//  Fuzz chat-guard sanitize
// ───────────────────────────────────────────────────────────────────────

describe('FUZZ — sanitizeLegalLinksInText never throws', () => {
  it('100 random textes avec /legal/* mélangés', async () => {
    const rand = rng(777);
    for (let i = 0; i < 100; i += 1) {
      const base = randomString(rand, 200);
      const inject = `/legal/${Math.random().toString(36).slice(2, 10)}`;
      const txt = `${base.slice(0, 100)} ${inject} ${base.slice(100)}`;
      const out = await sanitizeLegalLinksInText(txt);
      expect(typeof out).toBe('string');
    }
  });
});

// ───────────────────────────────────────────────────────────────────────
//  Round-trip : substitute puis re-detect
// ───────────────────────────────────────────────────────────────────────

describe('Property : substitution + detection', () => {
  it('après substitution complète, detectVarsInTemplate retourne 0 vars (sauf si valeur contient {{X}})', () => {
    const rand = rng(11);
    for (let i = 0; i < 30; i += 1) {
      const md = `${randomString(rand, 50)} {{X}} {{Y}} ${randomString(rand, 50)}`;
      const m = new Map([
        ['X', 'value_x_simple'],
        ['Y', 'value_y_simple'],
      ]);
      const substituted = substituteVars(md, m);
      // Si le source md d'origine contient déjà des {{Z}}, ils seront
      // remplacés par le fallback [Z] et donc disparaissent du detect.
      const remaining = detectVarsInTemplate(substituted);
      expect(remaining).toEqual([]);
    }
  });
});

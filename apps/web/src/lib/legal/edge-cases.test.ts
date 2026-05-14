/**
 * Edge cases — vars, render, diff.
 *
 * Couvre les inputs extrêmes (unicode, RTL, emojis, longueur, contenu
 * vide, lignes très longues, GFM avancé) pour garantir la robustesse en
 * production face à du contenu inattendu.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

import {
  buildVarMap,
  detectMissingVars,
  detectVarsInTemplate,
  substituteVars,
} from './vars';
import { renderLegalMarkdown } from './render';
import { diffBodies, diffLines } from './diff';

// ───────────────────────────────────────────────────────────────────────
//  vars — unicode + length
// ───────────────────────────────────────────────────────────────────────

describe('vars — unicode', () => {
  it('substitue dans un texte avec emojis', () => {
    const m = new Map([['NAME', 'FemiGlow ✨']]);
    expect(substituteVars('Bonjour 👋 {{NAME}} !', m)).toBe('Bonjour 👋 FemiGlow ✨ !');
  });

  it('substitue avec valeurs unicode multi-bytes', () => {
    const m = new Map([
      ['AR', 'الجمالة الطبيعية'],
      ['ZH', '美丽'],
    ]);
    const out = substituteVars('{{AR}} / {{ZH}}', m);
    expect(out).toBe('الجمالة الطبيعية / 美丽');
  });

  it('ne casse pas sur valeur avec caractères de contrôle (mais les rend)', () => {
    const m = new Map([['X', 'a\nb\tc']]);
    expect(substituteVars('{{X}}', m)).toBe('a\nb\tc');
  });
});

describe('vars — length extrêmes', () => {
  it('substitue une valeur de 1KB', () => {
    const big = 'x'.repeat(1024);
    const m = new Map([['X', big]]);
    const out = substituteVars('{{X}}', m);
    expect(out.length).toBe(1024);
  });

  it('substitue 100 occurrences de la même variable', () => {
    const md = Array(100).fill('{{X}}').join(' ');
    const m = new Map([['X', 'v']]);
    const out = substituteVars(md, m);
    expect(out.split('v').length - 1).toBe(100);
  });

  it('detectVarsInTemplate ignore les variables casse mixte', () => {
    expect(detectVarsInTemplate('{{Foo}} {{BAR}}')).toEqual(['BAR']);
  });

  it('detectVarsInTemplate gère 0 var', () => {
    expect(detectVarsInTemplate('aucune var ici')).toEqual([]);
  });

  it('detectMissingVars retourne tableau unique (set)', () => {
    const missing = detectMissingVars('{{X}} {{X}} {{X}}', [
      { key: 'X', value: '', isRequired: true },
    ]);
    expect(missing).toEqual(['X']);
  });
});

describe('vars — patterns proches mais invalides', () => {
  it('ignore {{X-Y}} (tirets non autorisés)', () => {
    expect(detectVarsInTemplate('{{X-Y}}')).toEqual([]);
  });

  it('ignore {X} et {{{X}}}', () => {
    expect(detectVarsInTemplate('{X} {{{X}}}')).toEqual(['X']); // {{{X}}} = {{X}} précédé d'un {
  });

  it('ignore {{x}} (minuscules)', () => {
    expect(detectVarsInTemplate('{{x}} {{1X}}')).toEqual([]);
  });

  it('accepte {{X_1_NUM}}', () => {
    expect(detectVarsInTemplate('{{X_1_NUM}}')).toEqual(['X_1_NUM']);
  });
});

// ───────────────────────────────────────────────────────────────────────
//  buildVarMap — collisions et priorités
// ───────────────────────────────────────────────────────────────────────

describe('buildVarMap — collisions', () => {
  it('DB vars écrasent les presets', () => {
    const m = buildVarMap(
      [{ key: 'CURRENT_YEAR', value: '1999' }],
      { now: new Date('2026-01-01') },
    );
    expect(m.get('CURRENT_YEAR')).toBe('1999');
  });

  it('valeur DB vide laisse le preset en place', () => {
    const m = buildVarMap(
      [{ key: 'CURRENT_YEAR', value: '' }],
      { now: new Date('2026-01-01') },
    );
    expect(m.get('CURRENT_YEAR')).toBe('2026');
  });
});

// ───────────────────────────────────────────────────────────────────────
//  render — Markdown standards
// ───────────────────────────────────────────────────────────────────────

describe('render — content vide ou minimal', () => {
  it('gère le string vide', async () => {
    const { html, headings, varsUsed } = await renderLegalMarkdown('');
    expect(html.trim()).toBe('');
    expect(headings).toEqual([]);
    expect(varsUsed).toEqual([]);
  });

  it('gère une seule ligne sans newline', async () => {
    const { html } = await renderLegalMarkdown('hello');
    expect(html).toContain('<p>hello</p>');
  });

  it('gère uniquement des espaces/newlines', async () => {
    const { html } = await renderLegalMarkdown('   \n\n   \n');
    expect(html.trim()).toBe('');
  });
});

describe('render — GFM tables', () => {
  it('rend une table simple', async () => {
    const md = `
| Col1 | Col2 |
|------|------|
| a    | b    |
| c    | d    |
`;
    const { html } = await renderLegalMarkdown(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Col1</th>');
    expect(html).toContain('<td>c</td>');
  });
});

describe('render — code blocks', () => {
  it('rend un code fence avec langage', async () => {
    const md = '```js\nconst x = 1;\n```';
    const { html } = await renderLegalMarkdown(md);
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
    expect(html).toContain('const x = 1;');
  });

  it('échappe le contenu d\'un code block (pas d\'XSS via code)', async () => {
    const md = '```\n<script>alert(1)</script>\n```';
    const { html } = await renderLegalMarkdown(md);
    // Le script est encodé en entités dans le code block, pas exécuté.
    expect(html).not.toMatch(/<script>alert\(1\)<\/script>/);
    expect(html).toContain('&#x3C;script>');
  });
});

describe('render — listes imbriquées et task lists', () => {
  it('rend les listes imbriquées', async () => {
    const md = '- a\n  - a1\n  - a2\n- b';
    const { html } = await renderLegalMarkdown(md);
    expect(html).toMatch(/<ul>[\s\S]*<ul>[\s\S]*<\/ul>[\s\S]*<\/ul>/);
  });

  it('rend les task lists GFM (checkboxes)', async () => {
    const md = '- [x] fait\n- [ ] todo';
    const { html } = await renderLegalMarkdown(md);
    expect(html).toContain('type="checkbox"');
  });
});

describe('render — body très long', () => {
  it('gère 10000 caractères sans crasher', async () => {
    const md = '# Titre\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(400);
    const { html } = await renderLegalMarkdown(md);
    expect(html.length).toBeGreaterThan(10_000);
    expect(html).toContain('<h1');
  });

  it('extrait correctement des headings sur un long body', async () => {
    const sections = Array.from({ length: 20 }, (_, i) => `## Section ${i + 1}\n\nContenu.`).join(
      '\n\n',
    );
    const { headings } = await renderLegalMarkdown(sections);
    expect(headings).toHaveLength(20);
    expect(headings[0]?.text).toBe('Section 1');
    expect(headings[19]?.text).toBe('Section 20');
  });
});

describe('render — unicode + RTL', () => {
  it('rend le contenu arabe RTL sans corruption', async () => {
    const md = '# الشروط\n\nمرحباً بكم في فيمي‌غلو.';
    const { html } = await renderLegalMarkdown(md);
    expect(html).toContain('الشروط');
    expect(html).toContain('مرحباً');
  });

  it('rend des emojis', async () => {
    const md = '✨ Bienvenue 👋\n\n- 💄\n- 💅';
    const { html } = await renderLegalMarkdown(md);
    expect(html).toContain('✨');
    expect(html).toContain('💄');
  });
});

// ───────────────────────────────────────────────────────────────────────
//  diff — edge cases
// ───────────────────────────────────────────────────────────────────────

describe('diff — identité', () => {
  it('diff(x, x) → 0 hunks pour textes égaux non-vides', () => {
    const r = diffBodies('a\nb\nc', 'a\nb\nc');
    expect(r.added).toBe(0);
    expect(r.removed).toBe(0);
    expect(r.hunks).toEqual([]);
  });

  it('diff("", "") → 0 hunks', () => {
    const r = diffBodies('', '');
    expect(r.hunks).toEqual([]);
  });
});

describe('diff — un seul côté vide', () => {
  it('from vide, to non vide → tout en add', () => {
    const r = diffBodies('', 'a\nb');
    // diffBodies a un comportement particulier : diffLines retourne add pour
    // tout, le total added correspond.
    expect(r.added).toBeGreaterThan(0);
    expect(r.removed).toBeLessThanOrEqual(1); // au plus la ligne vide initiale
  });

  it('from non vide, to vide → tout en remove', () => {
    const r = diffBodies('a\nb', '');
    expect(r.removed).toBeGreaterThan(0);
  });
});

describe('diff — unicode', () => {
  it('détecte un changement dans une ligne arabe', () => {
    const r = diffBodies('مرحبا', 'مرحبا بك');
    expect(r.added + r.removed).toBeGreaterThan(0);
  });

  it('lignes équivalentes byte-par-byte → equal', () => {
    const lines = diffLines('café', 'café');
    expect(lines.every((l) => l.op === 'equal')).toBe(true);
  });
});

describe('diff — gros body', () => {
  it('diff 500 lignes vs 500+1 lignes (1 ajout au milieu)', () => {
    const from = Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n');
    const arr = from.split('\n');
    arr.splice(250, 0, 'INSERTED');
    const to = arr.join('\n');
    const r = diffBodies(from, to);
    expect(r.added).toBe(1);
    expect(r.removed).toBe(0);
    // Doit y avoir au moins 1 hunk autour de la ligne 250
    expect(r.hunks.length).toBeGreaterThanOrEqual(1);
  });
});

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

import {
  buildVarMap,
  detectMissingVars,
  detectVarsInTemplate,
  isPresetVar,
  presetVars,
  substituteVars,
} from './vars';

describe('legal/vars — presets', () => {
  it('expose LAST_UPDATED / CURRENT_YEAR / SITE_URL', () => {
    const now = new Date('2026-05-13T00:00:00Z');
    const m = presetVars(now);
    expect(m.get('LAST_UPDATED')).toBe('13 mai 2026');
    expect(m.get('CURRENT_YEAR')).toBe('2026');
    expect(m.get('SITE_URL')).toBe('https://femiglow.ma');
  });

  it('isPresetVar identifie les clés préset', () => {
    expect(isPresetVar('LAST_UPDATED')).toBe(true);
    expect(isPresetVar('CURRENT_YEAR')).toBe(true);
    expect(isPresetVar('SITE_URL')).toBe(true);
    expect(isPresetVar('COMPANY_RC')).toBe(false);
  });
});

describe('legal/vars — substituteVars', () => {
  it('remplace {{KEY}} par la valeur', () => {
    const m = new Map([['COMPANY_NAME', 'FemiGlow']]);
    expect(substituteVars('Hello {{COMPANY_NAME}}', m)).toBe('Hello FemiGlow');
  });

  it('mode public : fallback [KEY] pour variable manquante', () => {
    expect(substituteVars('{{FOO}}', new Map())).toBe('[FOO]');
  });

  it('mode admin-preview : marker ⦉KEY⦊ pour variable manquante (wrapped en mark par rehype plugin downstream)', () => {
    const out = substituteVars('{{FOO}}', new Map(), 'admin-preview');
    expect(out).toBe('⦉FOO⦊');
  });

  it('ignore les motifs qui ne matchent pas (minuscules)', () => {
    expect(substituteVars('{{lower}}', new Map())).toBe('{{lower}}');
  });

  it('remplace plusieurs occurrences', () => {
    const m = new Map([['X', 'Y']]);
    expect(substituteVars('{{X}}—{{X}}', m)).toBe('Y—Y');
  });
});

describe('legal/vars — detect', () => {
  it('detectVarsInTemplate déduplique les variables', () => {
    expect(detectVarsInTemplate('{{A}} {{B}} {{A}}')).toEqual(['A', 'B']);
  });

  it('detectMissingVars saute les preset (LAST_UPDATED, CURRENT_YEAR, SITE_URL)', () => {
    const md = '{{LAST_UPDATED}} {{COMPANY_RC}}';
    const missing = detectMissingVars(md, [
      { key: 'COMPANY_RC', value: '', isRequired: true },
    ]);
    expect(missing).toEqual(['COMPANY_RC']);
  });

  it('detectMissingVars : required vide ⇒ missing, optional vide ⇒ OK', () => {
    const md = '{{A}} {{B}}';
    const missing = detectMissingVars(md, [
      { key: 'A', value: '', isRequired: true },
      { key: 'B', value: '', isRequired: false },
    ]);
    expect(missing).toEqual(['A']);
  });

  it('detectMissingVars : clé inconnue (jamais déclarée) ⇒ missing', () => {
    const missing = detectMissingVars('{{INCONNUE}}', []);
    expect(missing).toEqual(['INCONNUE']);
  });

  it('detectMissingVars : whitespace-only vaut empty', () => {
    const missing = detectMissingVars('{{A}}', [
      { key: 'A', value: '   ', isRequired: true },
    ]);
    expect(missing).toEqual(['A']);
  });
});

describe('legal/vars — buildVarMap', () => {
  it('fusionne presets + DB vars (DB écrase si même clé)', () => {
    const m = buildVarMap(
      [
        { key: 'COMPANY_NAME', value: 'FemiGlow' },
        { key: 'SITE_URL', value: 'https://override.ma' },
      ],
      { now: new Date('2026-01-01T00:00:00Z') },
    );
    expect(m.get('COMPANY_NAME')).toBe('FemiGlow');
    expect(m.get('SITE_URL')).toBe('https://override.ma');
    expect(m.get('LAST_UPDATED')).toBe('1 janvier 2026');
  });

  it('ignore les valeurs DB vides (null ou whitespace)', () => {
    const m = buildVarMap([
      { key: 'A', value: null },
      { key: 'B', value: '   ' },
    ]);
    expect(m.has('A')).toBe(false);
    expect(m.has('B')).toBe(false);
  });
});

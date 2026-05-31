/**
 * LEGAL-V2 — Tests presetVarsForPage + buildPublicVarMap.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

import {
  presetVarsForPage,
  isPresetVar,
  buildPublicVarMap,
  buildVarMap,
  SENSITIVE_VAR_PUBLIC_PLACEHOLDER,
} from './vars';

describe('presetVarsForPage', () => {
  it('inclut VERSION dérivé de la page', () => {
    const m = presetVarsForPage({ version: 3, updatedAt: new Date('2026-05-27T00:00:00Z') });
    expect(m.get('VERSION')).toBe('v3');
  });

  it('inclut LAST_UPDATED basé sur updatedAt page', () => {
    // Date locale française
    const updated = new Date('2026-05-15T12:00:00');
    const m = presetVarsForPage({ version: 1, updatedAt: updated });
    expect(m.get('LAST_UPDATED')).toMatch(/15 mai 2026/);
  });

  it('inclut les presets globaux (SITE_URL, CURRENT_YEAR)', () => {
    const m = presetVarsForPage(
      { version: 1, updatedAt: new Date('2026-05-27T00:00:00') },
      new Date('2026-05-27T00:00:00'),
    );
    expect(m.get('SITE_URL')).toBe('https://femiglow.ma');
    expect(m.get('CURRENT_YEAR')).toBe('2026');
  });

  it('VERSION est reconnu comme preset', () => {
    expect(isPresetVar('VERSION')).toBe(true);
  });
});

describe('buildPublicVarMap', () => {
  it('remplace les vars sensibles par le placeholder', () => {
    const m = buildPublicVarMap([
      { key: 'ICE', value: '001234567890123', sensitive: true },
      { key: 'COMPANY_RC', value: 'Casablanca-12345', sensitive: true },
      { key: 'CONTACT_EMAIL', value: 'info@x.com', sensitive: false },
    ]);
    expect(m.get('ICE')).toBe(SENSITIVE_VAR_PUBLIC_PLACEHOLDER);
    expect(m.get('COMPANY_RC')).toBe(SENSITIVE_VAR_PUBLIC_PLACEHOLDER);
    expect(m.get('CONTACT_EMAIL')).toBe('info@x.com');
  });

  it('même si sensitive=true avec value vide, placeholder appliqué', () => {
    const m = buildPublicVarMap([
      { key: 'ICE', value: null, sensitive: true },
    ]);
    expect(m.get('ICE')).toBe(SENSITIVE_VAR_PUBLIC_PLACEHOLDER);
  });

  it('contraste avec buildVarMap (admin) qui expose la vraie valeur', () => {
    const adminMap = buildVarMap([
      { key: 'ICE', value: '001234567890123' },
    ]);
    expect(adminMap.get('ICE')).toBe('001234567890123');
  });
});

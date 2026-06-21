// @vitest-environment node
/**
 * F05-S — minimisation PII (maskEmail) pour les journaux d'audit.
 */
import { describe, expect, it } from 'vitest';
import { maskEmail } from '../pii';

describe('F05-S — maskEmail', () => {
  it('F05-S-010 — conserve 1re lettre + domaine, masque le reste du local', () => {
    expect(maskEmail('jane.doe@gmail.com')).toBe('j***@gmail.com');
    expect(maskEmail('nadia@femiglow-maroc.com')).toBe('n***@femiglow-maroc.com');
    expect(maskEmail('a@b.co')).toBe('a***@b.co');
  });

  it('F05-S-011 — ne divulgue rien pour une entrée non exploitable', () => {
    expect(maskEmail('')).toBe('***');
    expect(maskEmail('pas-une-adresse')).toBe('***');
    expect(maskEmail('@nodomainlocal.com')).toBe('***'); // pas de local
    expect(maskEmail('nolocal@')).toBe('***'); // pas de domaine
    expect(maskEmail(undefined as unknown as string)).toBe('***');
  });

  it('F05-S-012 — ne laisse JAMAIS fuiter le local part complet', () => {
    const masked = maskEmail('confidentielle.cliente@exemple.ma');
    expect(masked).not.toContain('confidentielle.cliente');
    expect(masked.startsWith('c***@')).toBe(true);
  });
});

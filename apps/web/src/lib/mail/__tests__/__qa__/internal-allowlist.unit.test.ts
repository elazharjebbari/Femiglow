/**
 * CHANTIER H — R-009 : logique unitaire de l'allowlist interne.
 * Module 08. Test UNIT pur (pas de DB) — `isInternalAddress` seul.
 *
 * Couvre : défauts projet, override env `MAIL_INTERNAL_ALLOWLIST`, distinction
 * adresse-exacte vs domaine, normalisation (case/trim), non-faux-positifs.
 *
 * IDs matrice : volet unitaire de PIP-INT-101/102 (mécanisme allowlist) +
 * PIP-INT-105 (normalisation).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { isInternalAddress } from '../../suppression';

const ORIGINAL = process.env.MAIL_INTERNAL_ALLOWLIST;

afterEach(() => {
  // Restaure l'env (le parse de l'allowlist est mémoïsé PAR valeur d'env, donc
  // remettre la valeur d'origine suffit à invalider le cache au prochain appel).
  if (ORIGINAL === undefined) delete process.env.MAIL_INTERNAL_ALLOWLIST;
  else process.env.MAIL_INTERNAL_ALLOWLIST = ORIGINAL;
});

describe('isInternalAddress — allowlist interne (R-009)', () => {
  it('reconnaît l adresse interne par défaut info@femiglow-maroc.com', () => {
    delete process.env.MAIL_INTERNAL_ALLOWLIST;
    expect(isInternalAddress('info@femiglow-maroc.com')).toBe(true);
  });

  it('reconnaît tout le domaine interne par défaut @femiglow-maroc.com', () => {
    delete process.env.MAIL_INTERNAL_ALLOWLIST;
    expect(isInternalAddress('alerts@femiglow-maroc.com')).toBe(true);
    expect(isInternalAddress('admin@femiglow-maroc.com')).toBe(true);
    expect(isInternalAddress('noreply@femiglow-maroc.com')).toBe(true);
  });

  it('ne reconnaît PAS une adresse cliente externe', () => {
    delete process.env.MAIL_INTERNAL_ALLOWLIST;
    expect(isInternalAddress('cliente@exemple.test')).toBe(false);
    expect(isInternalAddress('cliente@gmail.com')).toBe(false);
  });

  it('normalise (case + trim) avant comparaison', () => {
    delete process.env.MAIL_INTERNAL_ALLOWLIST;
    expect(isInternalAddress('  INFO@FemiGlow-Maroc.COM  ')).toBe(true);
    expect(isInternalAddress('Admin@FEMIGLOW-MAROC.com')).toBe(true);
  });

  it('ajoute une adresse exacte via MAIL_INTERNAL_ALLOWLIST sans ouvrir son domaine', () => {
    process.env.MAIL_INTERNAL_ALLOWLIST = 'ops@partner.example';
    expect(isInternalAddress('ops@partner.example')).toBe(true);
    // L'entrée adresse-exacte n'élargit PAS au domaine entier.
    expect(isInternalAddress('autre@partner.example')).toBe(false);
  });

  it('ajoute un domaine entier via une entrée @domaine', () => {
    process.env.MAIL_INTERNAL_ALLOWLIST = '@equipe.example';
    expect(isInternalAddress('quiconque@equipe.example')).toBe(true);
    expect(isInternalAddress('autre@equipe.example')).toBe(true);
  });

  it('cumule défauts + override (les deux restent reconnus)', () => {
    process.env.MAIL_INTERNAL_ALLOWLIST = '@equipe.example';
    expect(isInternalAddress('info@femiglow-maroc.com')).toBe(true); // défaut
    expect(isInternalAddress('x@equipe.example')).toBe(true); // override
  });

  it('rejette une chaîne sans @ (pas une adresse)', () => {
    delete process.env.MAIL_INTERNAL_ALLOWLIST;
    expect(isInternalAddress('pas-une-adresse')).toBe(false);
    expect(isInternalAddress('')).toBe(false);
  });

  it('ne matche pas un sous-domaine non listé (femiglow-maroc.com ≠ x.femiglow-maroc.com)', () => {
    delete process.env.MAIL_INTERNAL_ALLOWLIST;
    // `@femiglow-maroc.com` n'inclut PAS `mail.femiglow-maroc.com` : la
    // comparaison de domaine est exacte (pas de suffixe), volontairement strict.
    expect(isInternalAddress('x@mail.femiglow-maroc.com')).toBe(false);
  });

  it('ignore les entrées vides du CSV (virgules superflues)', () => {
    process.env.MAIL_INTERNAL_ALLOWLIST = ',  ,@equipe.example,,';
    expect(isInternalAddress('x@equipe.example')).toBe(true);
    expect(isInternalAddress('x@exemple.test')).toBe(false);
  });
});

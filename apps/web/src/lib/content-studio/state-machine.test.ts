import { describe, expect, it } from 'vitest';
import { canTransition, assertTransition } from './state-machine';
import { HttpError } from '@/lib/errors/http-error';

describe('content studio state machine', () => {
  it('autorise le chemin review vers approval', () => {
    expect(canTransition('needs_review', 'approved')).toBe(true);
  });

  it('interdit de programmer un brouillon genere', () => {
    expect(canTransition('generated', 'scheduled')).toBe(false);
  });

  it('autorise idea vers brief', () => {
    expect(canTransition('idea', 'brief')).toBe(true);
  });

  it('autorise idea vers generated pour la generation brief + drafts en une action', () => {
    expect(canTransition('idea', 'generated')).toBe(true);
  });

  it('autorise idea vers archived', () => {
    expect(canTransition('idea', 'archived')).toBe(true);
  });

  it('autorise approved vers scheduled', () => {
    expect(canTransition('approved', 'scheduled')).toBe(true);
  });

  it('autorise approved vers archived', () => {
    expect(canTransition('approved', 'archived')).toBe(true);
  });

  it('autorise approved vers published (publish-now direct)', () => {
    expect(canTransition('approved', 'published')).toBe(true);
  });

  it('autorise approved vers failed (publish-now en echec)', () => {
    expect(canTransition('approved', 'failed')).toBe(true);
  });

  it('interdit approved vers measured directement (saut d etape)', () => {
    expect(canTransition('approved', 'measured')).toBe(false);
  });

  it('autorise scheduled vers published', () => {
    expect(canTransition('scheduled', 'published')).toBe(true);
  });

  it('autorise scheduled vers failed', () => {
    expect(canTransition('scheduled', 'failed')).toBe(true);
  });

  it('autorise scheduled vers approved (cancel schedule)', () => {
    expect(canTransition('scheduled', 'approved')).toBe(true);
  });

  it('autorise failed vers scheduled (retry)', () => {
    expect(canTransition('failed', 'scheduled')).toBe(true);
  });

  it('interdit archived vers tout autre etat', () => {
    expect(canTransition('archived', 'idea')).toBe(false);
    expect(canTransition('archived', 'brief')).toBe(false);
    expect(canTransition('archived', 'generated')).toBe(false);
  });

  it('autorise rejected vers generated (nouvelle tentative)', () => {
    expect(canTransition('rejected', 'generated')).toBe(true);
  });

  it('autorise needs_review vers generated (request variation)', () => {
    expect(canTransition('needs_review', 'generated')).toBe(true);
  });

  it('interdit needs_review vers scheduled (saut d etape)', () => {
    expect(canTransition('needs_review', 'scheduled')).toBe(false);
  });

  it('assertTransition leve HttpError pour une transition invalide', () => {
    expect(() => assertTransition('idea', 'published')).toThrow(HttpError);
    expect(() => assertTransition('idea', 'published')).toThrow(
      'Transition Content Studio invalide',
    );
  });

  it('assertTransition ne leve pas pour une transition valide', () => {
    expect(() => assertTransition('approved', 'scheduled')).not.toThrow();
  });

  it('assertTransition leve HttpError 409 pour transition invalide', () => {
    try {
      assertTransition('idea', 'published');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(409);
      expect((err as HttpError).code).toBe('invalid_state');
    }
  });

  it('autorise published vers measured', () => {
    expect(canTransition('published', 'measured')).toBe(true);
  });

  it('interdit measured vers scheduled', () => {
    expect(canTransition('measured', 'scheduled')).toBe(false);
  });
});

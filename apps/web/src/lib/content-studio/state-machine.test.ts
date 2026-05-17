import { describe, expect, it } from 'vitest';
import { canTransition, assertTransition } from './state-machine';

describe('content studio state machine', () => {
  it('autorise le chemin review vers approval', () => {
    expect(canTransition('needs_review', 'approved')).toBe(true);
  });

  it('interdit de programmer un brouillon généré', () => {
    expect(canTransition('generated', 'scheduled')).toBe(false);
  });

  it('autorise idea vers brief', () => {
    expect(canTransition('idea', 'brief')).toBe(true);
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

  it('autorise scheduled vers published', () => {
    expect(canTransition('scheduled', 'published')).toBe(true);
  });

  it('autorise scheduled vers failed', () => {
    expect(canTransition('scheduled', 'failed')).toBe(true);
  });

  it('autorise failed vers scheduled (retry)', () => {
    expect(canTransition('failed', 'scheduled')).toBe(true);
  });

  it('interdit archived vers tout autre état', () => {
    expect(canTransition('archived', 'idea')).toBe(false);
    expect(canTransition('archived', 'brief')).toBe(false);
    expect(canTransition('archived', 'generated')).toBe(false);
  });

  it('autorise rejected vers generated (nouvelle tentative)', () => {
    expect(canTransition('rejected', 'generated')).toBe(true);
  });

  it('interdit needs_review vers scheduled (saut détape)', () => {
    expect(canTransition('needs_review', 'scheduled')).toBe(false);
  });

  it('assertTransition lève pour une transition invalide', () => {
    expect(() => assertTransition('idea', 'published')).toThrow(
      'Transition Content Studio invalide: idea -> published',
    );
  });

  it('assertTransition ne lève pas pour une transition valide', () => {
    expect(() => assertTransition('approved', 'scheduled')).not.toThrow();
  });

  it('autorise published vers measured', () => {
    expect(canTransition('published', 'measured')).toBe(true);
  });

  it('interdit measured vers scheduled', () => {
    expect(canTransition('measured', 'scheduled')).toBe(false);
  });
});
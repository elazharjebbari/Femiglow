import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FieldDiffView } from './FieldDiffView';

describe('FieldDiffView — text mode', () => {
  it('rend des lignes ajout/suppression pour un text', () => {
    render(<FieldDiffView fieldType="text" before="Bonjour" after="Bonsoir" />);
    const items = document.querySelectorAll('[data-op]');
    const ops = Array.from(items).map((el) => el.getAttribute('data-op'));
    expect(ops).toContain('add');
    expect(ops).toContain('del');
  });

  it('affiche « Aucune différence. » pour deux textes identiques', () => {
    render(<FieldDiffView fieldType="multiline" before="A" after="A" />);
    expect(screen.getByText(/aucune différence/i)).toBeInTheDocument();
  });

  it('rend pour un kicker (extrait .value)', () => {
    render(
      <FieldDiffView
        fieldType="kicker"
        before={{ value: 'Avant' }}
        after={{ value: 'Après' }}
      />,
    );
    const items = document.querySelectorAll('[data-op]');
    const ops = Array.from(items).map((el) => el.getAttribute('data-op'));
    expect(ops).toContain('add');
    expect(ops).toContain('del');
  });
});

describe('FieldDiffView — json mode', () => {
  it('rend une table pour un cta modifié', () => {
    render(
      <FieldDiffView
        fieldType="cta"
        before={{ label: 'Voir', href: '/a' }}
        after={{ label: 'Voir', href: '/b' }}
      />,
    );
    const rows = document.querySelectorAll('tbody tr[data-op]');
    expect(rows.length).toBe(1);
    expect(rows[0]!.getAttribute('data-op')).toBe('change');
    expect(rows[0]!.querySelector('code')!.textContent).toBe('href');
  });

  it('affiche « Aucune différence. » quand les deux valeurs sont égales', () => {
    render(
      <FieldDiffView
        fieldType="record"
        before={{ a: 1 }}
        after={{ a: 1 }}
      />,
    );
    expect(screen.getByText(/aucune différence/i)).toBeInTheDocument();
  });

  it('rend ajout / suppression sur un tableau (list)', () => {
    render(
      <FieldDiffView
        fieldType="list"
        before={[{ k: 1 }]}
        after={[{ k: 1 }, { k: 2 }]}
      />,
    );
    const rows = document.querySelectorAll('tbody tr[data-op]');
    expect(rows.length).toBe(1);
    expect(rows[0]!.getAttribute('data-op')).toBe('add');
  });
});

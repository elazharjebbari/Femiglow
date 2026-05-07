/**
 * RTL — éditeurs composite (Cta, Link, Quote, BreadcrumbSegment, Icon).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import type { ComponentFieldDefinition } from '@/lib/db/types';

import { LinkEditor } from './LinkEditor';
import { CtaEditor } from './CtaEditor';
import { QuoteEditor } from './QuoteEditor';
import { BreadcrumbSegmentEditor } from './BreadcrumbSegmentEditor';
import { IconEditor } from './IconEditor';

function fd(partial: Partial<ComponentFieldDefinition>): ComponentFieldDefinition {
  return {
    key: 'k',
    label: 'Label',
    type: 'text',
    required: false,
    ...partial,
  };
}

describe('LinkEditor', () => {
  it('met à jour href + auto-coche external pour http://', () => {
    const onChange = vi.fn();
    render(
      <LinkEditor
        value={{ href: '', label: '', external: false }}
        onChange={onChange}
        error={null}
        fieldDef={fd({ type: 'link' })}
        locale="fr"
        id="l1"
      />,
    );
    const url = screen.getByRole('textbox', { name: 'URL' }) as HTMLInputElement;
    fireEvent.change(url, { target: { value: 'https://example.com' } });
    expect(onChange).toHaveBeenCalledWith({
      href: 'https://example.com',
      label: '',
      external: true,
    });
  });

  it('passe axe', async () => {
    const { container } = render(
      <LinkEditor
        value={{ href: '/x', label: 'X', external: false }}
        onChange={() => {}}
        error={null}
        fieldDef={fd({ type: 'link' })}
        locale="fr"
        id="l2"
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe('CtaEditor', () => {
  it('rend label/href + segmented variants', () => {
    const onChange = vi.fn();
    render(
      <CtaEditor
        value={{ label: 'Voir', href: '/x', variant: 'primary' }}
        onChange={onChange}
        error={null}
        fieldDef={fd({ type: 'cta' })}
        locale="fr"
        id="c1"
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Libellé' })).toHaveValue('Voir');
    const variantRg = screen.getByRole('radiogroup', { name: 'Variant' });
    expect(variantRg).toBeInTheDocument();
    const ghost = screen.getByRole('radio', { name: 'ghost' });
    fireEvent.click(ghost);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ variant: 'ghost' }));
  });

  it('passe axe', async () => {
    const { container } = render(
      <CtaEditor
        value={{ label: 'X', href: '/y', variant: 'primary' }}
        onChange={() => {}}
        error={null}
        fieldDef={fd({ type: 'cta' })}
        locale="fr"
        id="c2"
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe('QuoteEditor', () => {
  it('met à jour text et author', () => {
    const onChange = vi.fn();
    render(
      <QuoteEditor
        value={{ text: 'A', author: 'B' }}
        onChange={onChange}
        error={null}
        fieldDef={fd({ type: 'quote' })}
        locale="fr"
        id="q1"
      />,
    );
    const textArea = screen.getByRole('textbox', { name: 'Texte' });
    fireEvent.change(textArea, { target: { value: 'Quote' } });
    expect(onChange).toHaveBeenCalledWith({ text: 'Quote', author: 'B' });
  });

  it('passe axe', async () => {
    const { container } = render(
      <QuoteEditor
        value={{ text: '', author: '' }}
        onChange={() => {}}
        error={null}
        fieldDef={fd({ type: 'quote' })}
        locale="fr"
        id="q2"
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe('BreadcrumbSegmentEditor', () => {
  it('met à jour label et href', () => {
    const onChange = vi.fn();
    render(
      <BreadcrumbSegmentEditor
        value={{ label: 'A', href: '/a' }}
        onChange={onChange}
        error={null}
        fieldDef={fd({ type: 'breadcrumb-segment' })}
        locale="fr"
        id="bs1"
      />,
    );
    const labelInput = screen.getByRole('textbox', { name: 'Libellé' });
    fireEvent.change(labelInput, { target: { value: 'B' } });
    expect(onChange).toHaveBeenCalledWith({ label: 'B', href: '/a' });
  });

  it('passe axe', async () => {
    const { container } = render(
      <BreadcrumbSegmentEditor
        value={{ label: 'X', href: '/x' }}
        onChange={() => {}}
        error={null}
        fieldDef={fd({ type: 'breadcrumb-segment' })}
        locale="fr"
        id="bs2"
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe('IconEditor', () => {
  it('ouvre le picker et sélectionne une icône', () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="i1">Icône</label>
        <IconEditor
          value={null}
          onChange={onChange}
          error={null}
          fieldDef={fd({ type: 'icon' })}
          locale="fr"
          id="i1"
        />
      </>,
    );
    const trigger = screen.getByRole('button', { name: /Choisir une icône/i });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Sélectionne une option du listbox
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    fireEvent.click(options[0]!);
    expect(onChange).toHaveBeenCalled();
  });

  it('filtre la liste via la recherche', () => {
    render(
      <IconEditor
        value={null}
        onChange={() => {}}
        error={null}
        fieldDef={fd({ type: 'icon' })}
        locale="fr"
        id="i2"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /choisir une icône/i }));
    const search = screen.getByRole('searchbox');
    const before = screen.getAllByRole('option').length;
    fireEvent.change(search, { target: { value: 'feuille' } });
    const after = screen.getAllByRole('option').length;
    expect(after).toBeLessThan(before);
  });

  it('passe axe (picker fermé)', async () => {
    const { container } = render(
      <>
        <label htmlFor="i3">Icône</label>
        <IconEditor
          value="leaf"
          onChange={() => {}}
          error={null}
          fieldDef={fd({ type: 'icon' })}
          locale="fr"
          id="i3"
        />
      </>,
    );
    await expectNoAxeViolations(container);
  });
});

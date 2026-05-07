/**
 * RTL — éditeurs récursifs (List, Record) et RichText.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import type { ComponentFieldDefinition } from '@/lib/db/types';

import { ListEditor } from './ListEditor';
import { RecordEditor } from './RecordEditor';
import { RichTextEditor } from './RichTextEditor';

function fd(partial: Partial<ComponentFieldDefinition>): ComponentFieldDefinition {
  return {
    key: 'k',
    label: 'Label',
    type: 'list',
    required: false,
    ...partial,
  };
}

describe('ListEditor', () => {
  it('affiche les items et permet d\'ajouter', () => {
    const onChange = vi.fn();
    render(
      <ListEditor
        value={['a', 'b']}
        onChange={onChange}
        error={null}
        fieldDef={fd({ type: 'list', config: { itemType: 'text' } })}
        locale="fr"
        id="l1"
      />,
    );
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '+ Ajouter' }));
    expect(onChange).toHaveBeenCalledWith(['a', 'b', '']);
  });

  it('respecte maxItems pour désactiver Ajouter', () => {
    render(
      <ListEditor
        value={['a', 'b']}
        onChange={() => {}}
        error={null}
        fieldDef={fd({ type: 'list', config: { itemType: 'text', maxItems: 2 } })}
        locale="fr"
        id="l2"
      />,
    );
    expect(screen.getByRole('button', { name: '+ Ajouter' })).toBeDisabled();
  });

  it('respecte minItems pour désactiver Supprimer', () => {
    render(
      <ListEditor
        value={['a']}
        onChange={() => {}}
        error={null}
        fieldDef={fd({ type: 'list', config: { itemType: 'text', minItems: 1 } })}
        locale="fr"
        id="l3"
      />,
    );
    const removeBtns = screen.getAllByRole('button', { name: 'Supprimer' });
    removeBtns.forEach((b) => expect(b).toBeDisabled());
  });

  it('réordonne via ↑/↓', () => {
    const onChange = vi.fn();
    render(
      <ListEditor
        value={['a', 'b']}
        onChange={onChange}
        error={null}
        fieldDef={fd({ type: 'list', config: { itemType: 'text' } })}
        locale="fr"
        id="l4"
      />,
    );
    const downs = screen.getAllByRole('button', { name: 'Descendre' });
    fireEvent.click(downs[0]!);
    expect(onChange).toHaveBeenCalledWith(['b', 'a']);
  });

  it('passe axe', async () => {
    const { container } = render(
      <ListEditor
        value={['x']}
        onChange={() => {}}
        error={null}
        fieldDef={fd({ type: 'list', config: { itemType: 'text' } })}
        locale="fr"
        id="l5"
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe('RecordEditor', () => {
  const recordDef: ComponentFieldDefinition = {
    key: 'r',
    label: 'Record',
    type: 'record',
    required: false,
    config: {
      shape: {
        title: { type: 'text', required: true },
        active: { type: 'boolean' },
      },
    },
  };

  it('rend chaque sous-champ et propage le patch', () => {
    const onChange = vi.fn();
    render(
      <RecordEditor
        value={{ title: 'Hi', active: false }}
        onChange={onChange}
        error={null}
        fieldDef={recordDef}
        locale="fr"
        id="r1"
      />,
    );
    const titleInput = screen.getByLabelText('title') as HTMLInputElement;
    expect(titleInput.value).toBe('Hi');
    fireEvent.change(titleInput, { target: { value: 'Bye' } });
    expect(onChange).toHaveBeenCalledWith({ title: 'Bye', active: false });
  });

  it('passe axe', async () => {
    const { container } = render(
      <RecordEditor
        value={{ title: '', active: false }}
        onChange={() => {}}
        error={null}
        fieldDef={recordDef}
        locale="fr"
        id="r2"
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe('RichTextEditor', () => {
  it('rend une toolbar et insère du markdown', () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="rt1">Contenu</label>
        <RichTextEditor
          value=""
          onChange={onChange}
          error={null}
          fieldDef={fd({ type: 'rich-text' })}
          locale="fr"
          id="rt1"
        />
      </>,
    );
    const toolbar = screen.getByRole('toolbar', { name: 'Mise en forme' });
    expect(toolbar).toBeInTheDocument();
    const boldBtn = screen.getByRole('button', { name: /Gras/ });
    fireEvent.click(boldBtn);
    expect(onChange).toHaveBeenCalled();
    const arg = onChange.mock.calls[0]![0] as string;
    expect(arg).toContain('**');
  });

  it('rend la preview html', () => {
    render(
      <RichTextEditor
        value="## Titre\n\n**bold**"
        onChange={() => {}}
        error={null}
        fieldDef={fd({ type: 'rich-text' })}
        locale="fr"
        id="rt2"
      />,
    );
    expect(screen.getByLabelText('Aperçu')).toBeInTheDocument();
  });

  it('passe axe', async () => {
    const { container } = render(
      <>
        <label htmlFor="rt3">Contenu</label>
        <RichTextEditor
          value="**hello**"
          onChange={() => {}}
          error={null}
          fieldDef={fd({ type: 'rich-text' })}
          locale="fr"
          id="rt3"
        />
      </>,
    );
    await expectNoAxeViolations(container);
  });
});

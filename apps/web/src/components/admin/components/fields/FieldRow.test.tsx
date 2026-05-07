/**
 * RTL — FieldRow wrapper.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import { FieldRow } from './FieldRow';
import type { ComponentFieldDefinition } from '@/lib/db/types';
import type { FieldDirtyState } from './types';

const TEXT_FIELD: ComponentFieldDefinition = {
  key: 'title',
  label: 'Titre',
  type: 'text',
  required: true,
  description: 'Texte affiché en hero.',
};

function st(partial: Partial<FieldDirtyState>): FieldDirtyState {
  return {
    initial: '',
    current: '',
    error: null,
    saving: false,
    lastSavedAt: null,
    ...partial,
  };
}

describe('FieldRow', () => {
  it('rend le label, la description, et l\'éditeur', () => {
    const onChange = vi.fn();
    render(
      <FieldRow
        fieldDef={TEXT_FIELD}
        state={st({ initial: 'A', current: 'A' })}
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText(/Titre/)).toBeInTheDocument();
    expect(screen.getByText(/Texte affiché en hero/)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('A');
  });

  it('marque l\'astérisque required', () => {
    render(
      <FieldRow
        fieldDef={TEXT_FIELD}
        state={st({ initial: '', current: '' })}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText('requis')).toBeInTheDocument();
  });

  it('active data-dirty quand la valeur diffère de l\'initial', () => {
    const { container } = render(
      <FieldRow
        fieldDef={TEXT_FIELD}
        state={st({ initial: 'A', current: 'B' })}
        onChange={() => {}}
      />,
    );
    const row = container.querySelector('.field-row');
    expect(row).toHaveAttribute('data-dirty', 'true');
  });

  it('affiche le badge "Sauvegarde…" quand saving', () => {
    render(
      <FieldRow
        fieldDef={TEXT_FIELD}
        state={st({ saving: true })}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/Sauvegarde…/)).toBeInTheDocument();
  });

  it('affiche un badge erreur quand error', () => {
    render(
      <FieldRow
        fieldDef={TEXT_FIELD}
        state={st({ error: 'Trop court', current: 'x' })}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText('Erreur')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Trop court');
  });

  it('appelle onChange via l\'éditeur', () => {
    const onChange = vi.fn();
    render(
      <FieldRow
        fieldDef={TEXT_FIELD}
        state={st({ current: 'old' })}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new' } });
    expect(onChange).toHaveBeenCalledWith('new');
  });

  it('passe axe', async () => {
    const { container } = render(
      <FieldRow
        fieldDef={TEXT_FIELD}
        state={st({ current: 'x' })}
        onChange={() => {}}
      />,
    );
    await expectNoAxeViolations(container);
  });
});

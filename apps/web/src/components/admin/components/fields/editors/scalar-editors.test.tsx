/**
 * RTL — éditeurs scalaires (Text, Multiline, Number, Boolean, Enum, Kicker,
 * ColorToken).
 *
 * Chaque suite couvre :
 *   - render avec valeur initiale
 *   - onChange déclenché à l'interaction
 *   - affichage de l'erreur (`role="alert"` + `aria-invalid`)
 *   - axe (a11y)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import type { ComponentFieldDefinition } from '@/lib/db/types';

import { TextEditor } from './TextEditor';
import { MultilineEditor } from './MultilineEditor';
import { NumberEditor } from './NumberEditor';
import { BooleanEditor } from './BooleanEditor';
import { EnumEditor } from './EnumEditor';
import { KickerEditor } from './KickerEditor';
import { ColorTokenEditor } from './ColorTokenEditor';

function fd(partial: Partial<ComponentFieldDefinition>): ComponentFieldDefinition {
  return {
    key: 'k',
    label: 'Label',
    type: 'text',
    required: false,
    ...partial,
  };
}

describe('TextEditor', () => {
  it('rend la valeur et appelle onChange', () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="f1">L</label>
        <TextEditor
          value="hello"
          onChange={onChange}
          error={null}
          fieldDef={fd({ type: 'text' })}
          locale="fr"
          id="f1"
        />
      </>,
    );
    const input = screen.getByLabelText('L') as HTMLInputElement;
    expect(input.value).toBe('hello');
    fireEvent.change(input, { target: { value: 'world' } });
    expect(onChange).toHaveBeenCalledWith('world');
  });

  it('affiche le compteur quand maxLength est défini', () => {
    render(
      <TextEditor
        value="abc"
        onChange={() => {}}
        error={null}
        fieldDef={fd({ type: 'text', config: { maxLength: 10 } })}
        locale="fr"
        id="f2"
      />,
    );
    expect(screen.getByText('3 / 10')).toBeInTheDocument();
  });

  it('affiche l\'erreur avec role="alert" et aria-invalid', () => {
    render(
      <TextEditor
        value="x"
        onChange={() => {}}
        error="Trop court"
        fieldDef={fd({ type: 'text' })}
        locale="fr"
        id="f3"
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Trop court');
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('passe axe', async () => {
    const { container } = render(
      <>
        <label htmlFor="f4">Titre</label>
        <TextEditor
          value=""
          onChange={() => {}}
          error={null}
          fieldDef={fd({ type: 'text', config: { maxLength: 50 } })}
          locale="fr"
          id="f4"
        />
      </>,
    );
    await expectNoAxeViolations(container);
  });
});

describe('MultilineEditor', () => {
  it('rend un textarea contrôlé', () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="m1">L</label>
        <MultilineEditor
          value="line1"
          onChange={onChange}
          error={null}
          fieldDef={fd({ type: 'multiline' })}
          locale="fr"
          id="m1"
        />
      </>,
    );
    const ta = screen.getByLabelText('L') as HTMLTextAreaElement;
    expect(ta.value).toBe('line1');
    fireEvent.change(ta, { target: { value: 'line2' } });
    expect(onChange).toHaveBeenCalledWith('line2');
  });

  it('passe axe', async () => {
    const { container } = render(
      <>
        <label htmlFor="m2">L</label>
        <MultilineEditor
          value=""
          onChange={() => {}}
          error={null}
          fieldDef={fd({ type: 'multiline' })}
          locale="fr"
          id="m2"
        />
      </>,
    );
    await expectNoAxeViolations(container);
  });
});

describe('NumberEditor', () => {
  it('rend la valeur et clamp au blur', () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="n1">N</label>
        <NumberEditor
          value={5}
          onChange={onChange}
          error={null}
          fieldDef={fd({ type: 'number', config: { min: 0, max: 10 } })}
          locale="fr"
          id="n1"
        />
      </>,
    );
    const input = screen.getByLabelText('N') as HTMLInputElement;
    expect(input.value).toBe('5');
    fireEvent.change(input, { target: { value: '15' } });
    expect(onChange).toHaveBeenCalledWith(15);
    fireEvent.blur(input, { target: { value: '15' } });
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('passe axe', async () => {
    const { container } = render(
      <>
        <label htmlFor="n2">N</label>
        <NumberEditor
          value={0}
          onChange={() => {}}
          error={null}
          fieldDef={fd({ type: 'number' })}
          locale="fr"
          id="n2"
        />
      </>,
    );
    await expectNoAxeViolations(container);
  });
});

describe('BooleanEditor', () => {
  it('rend un switch a11y et toggle', () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="b1">Actif</label>
        <BooleanEditor
          value={false}
          onChange={onChange}
          error={null}
          fieldDef={fd({ type: 'boolean' })}
          locale="fr"
          id="b1"
        />
      </>,
    );
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('passe axe', async () => {
    const { container } = render(
      <>
        <label htmlFor="b2">Actif</label>
        <BooleanEditor
          value={true}
          onChange={() => {}}
          error={null}
          fieldDef={fd({ type: 'boolean' })}
          locale="fr"
          id="b2"
        />
      </>,
    );
    await expectNoAxeViolations(container);
  });
});

describe('EnumEditor', () => {
  const opts = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ];

  it('rend un segmented (radiogroup) si ≤ 4 options', () => {
    const onChange = vi.fn();
    render(
      <EnumEditor
        value="a"
        onChange={onChange}
        error={null}
        fieldDef={fd({ type: 'enum', config: { options: opts } })}
        locale="fr"
        id="e1"
      />,
    );
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('rend un select si > 4 options', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ value: `v${i}`, label: `L${i}` }));
    render(
      <>
        <label htmlFor="e2">L</label>
        <EnumEditor
          value="v0"
          onChange={() => {}}
          error={null}
          fieldDef={fd({ type: 'enum', config: { options: many } })}
          locale="fr"
          id="e2"
        />
      </>,
    );
    expect(screen.getByLabelText('L').tagName).toBe('SELECT');
  });

  it('passe axe', async () => {
    const { container } = render(
      <EnumEditor
        value="a"
        onChange={() => {}}
        error={null}
        fieldDef={fd({ type: 'enum', config: { options: opts } })}
        locale="fr"
        id="e3"
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe('KickerEditor', () => {
  it('rend la preview live', () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="k1">L</label>
        <KickerEditor
          value="Hello"
          onChange={onChange}
          error={null}
          fieldDef={fd({ type: 'kicker' })}
          locale="fr"
          id="k1"
        />
      </>,
    );
    expect(screen.getByText('Hello', { selector: '.kicker-preview' })).toBeInTheDocument();
  });

  it('passe axe', async () => {
    const { container } = render(
      <>
        <label htmlFor="k2">L</label>
        <KickerEditor
          value="x"
          onChange={() => {}}
          error={null}
          fieldDef={fd({ type: 'kicker' })}
          locale="fr"
          id="k2"
        />
      </>,
    );
    await expectNoAxeViolations(container);
  });
});

describe('ColorTokenEditor', () => {
  it('rend des swatches sélectionnables', () => {
    const onChange = vi.fn();
    render(
      <ColorTokenEditor
        value="creme"
        onChange={onChange}
        error={null}
        fieldDef={fd({ type: 'color-token' })}
        locale="fr"
        id="c1"
      />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
    // Le swatch "creme" doit être coché
    const creme = radios.find((r) => r.getAttribute('aria-label') === 'Crème');
    expect(creme).toBeDefined();
    expect(creme!).toHaveAttribute('aria-checked', 'true');
    // Sélection autre
    fireEvent.click(radios[1]!);
    expect(onChange).toHaveBeenCalled();
  });

  it('passe axe', async () => {
    const { container } = render(
      <ColorTokenEditor
        value="creme"
        onChange={() => {}}
        error={null}
        fieldDef={fd({ type: 'color-token' })}
        locale="fr"
        id="c2"
      />,
    );
    await expectNoAxeViolations(container);
  });
});

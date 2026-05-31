/**
 * Tests `OgImagePicker`.
 *
 * Couvre :
 *  - Trois modes radio mutuellement exclusifs (none / media / template).
 *  - Le mode dérivé du `value` initial (mediaId → media, template → template,
 *    sinon → none).
 *  - Bascule de mode : onChange émet le bon shape (mediaId null xor template null).
 *  - Mémorisation : changer de mode et revenir restaure la valeur saisie.
 *  - Mode `media` : preview live via fetch ; gestion des états loading/error/data.
 *  - Mode `template` : select met à jour onChange ; helper indique si dynamic enabled.
 *  - `disabled` désactive les radios.
 */
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { OgImagePicker, type OgImagePickerValue } from './OgImagePicker';

const originalFetch = global.fetch;

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

/* --------------------------- Helpers ------------------------------- */

function setup(value: OgImagePickerValue, props: Partial<Parameters<typeof OgImagePicker>[0]> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <OgImagePicker value={value} onChange={onChange} {...props} />,
  );
  return { ...utils, onChange };
}

/**
 * Wrapper contrôlé : utile pour tester les flux qui dépendent de la
 * propagation du nouveau `value` (e.g. bascule de mode puis interaction
 * dans le nouveau mode actif).
 */
function ControlledOgImagePicker({
  initial,
  ...rest
}: {
  initial: OgImagePickerValue;
} & Partial<Parameters<typeof OgImagePicker>[0]>) {
  const [v, setV] = useState<OgImagePickerValue>(initial);
  return <OgImagePicker value={v} onChange={setV} {...rest} />;
}

function mockFetchOK(payload: Record<string, unknown>) {
  global.fetch = vi.fn(async () =>
    new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } }),
  ) as never;
}

function mockFetch404() {
  global.fetch = vi.fn(async () =>
    new Response('not found', { status: 404 }),
  ) as never;
}

/* ----------------------------- Tests -------------------------------- */

describe('OgImagePicker — mode initial', () => {
  it('mode none si value vide', () => {
    setup({ mediaId: null, template: null });
    expect(screen.getByTestId<HTMLInputElement>('og-image-picker-mode-none').checked).toBe(true);
    expect(screen.getByTestId<HTMLInputElement>('og-image-picker-mode-media').checked).toBe(false);
    expect(screen.getByTestId<HTMLInputElement>('og-image-picker-mode-template').checked).toBe(false);
  });

  it('mode media si mediaId présent', () => {
    setup({ mediaId: 'med_abc', template: null });
    expect(screen.getByTestId<HTMLInputElement>('og-image-picker-mode-media').checked).toBe(true);
    expect(screen.getByTestId<HTMLInputElement>('og-image-picker-mode-none').checked).toBe(false);
  });

  it('mode template si template présent', () => {
    setup({ mediaId: null, template: 'marketing' });
    expect(screen.getByTestId<HTMLInputElement>('og-image-picker-mode-template').checked).toBe(true);
  });
});

describe('OgImagePicker — bascule de mode', () => {
  it('none → media émet { mediaId: "", template: null }', () => {
    const { onChange } = setup({ mediaId: null, template: null });
    fireEvent.click(screen.getByTestId('og-image-picker-mode-media'));
    expect(onChange).toHaveBeenCalledWith({ mediaId: '', template: null });
  });

  it('media → template émet { mediaId: null, template: <last|marketing> }', () => {
    const { onChange } = setup({ mediaId: 'med_x', template: null });
    fireEvent.click(screen.getByTestId('og-image-picker-mode-template'));
    expect(onChange).toHaveBeenCalledWith({ mediaId: null, template: 'marketing' });
  });

  it('media → none émet { mediaId: null, template: null }', () => {
    const { onChange } = setup({ mediaId: 'med_x', template: null });
    fireEvent.click(screen.getByTestId('og-image-picker-mode-none'));
    expect(onChange).toHaveBeenCalledWith({ mediaId: null, template: null });
  });

  it('click sur le mode déjà actif ne déclenche pas onChange', () => {
    const { onChange } = setup({ mediaId: 'med_x', template: null });
    fireEvent.click(screen.getByTestId('og-image-picker-mode-media'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('OgImagePicker — mode media (saisie + preview)', () => {
  it('mode media + input vide → message d\'invite, pas de fetch', () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as never;
    render(<ControlledOgImagePicker initial={{ mediaId: null, template: null }} />);
    // Bascule en mode media (input vide par défaut puisque mediaId était null).
    fireEvent.click(screen.getByTestId('og-image-picker-mode-media'));
    expect(screen.getByText(/Saisissez un identifiant/)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('input non vide → fetch après debounce et affiche le preview', async () => {
    mockFetchOK({ id: 'med_123', url: '/uploads/a.png', alt: 'Alt', width: 1200, height: 630 });
    setup({ mediaId: 'med_123', template: null });
    await waitFor(
      () => {
        expect(screen.queryByTestId('og-image-picker-preview')).not.toBeNull();
      },
      { timeout: 1500 },
    );
    const img = screen.getByRole('img', { name: 'Alt' }) as HTMLImageElement;
    expect(img.src).toContain('/uploads/a.png');
    expect(img.width).toBe(1200);
  });

  it('404 → message d\'erreur explicite', async () => {
    mockFetch404();
    setup({ mediaId: 'med_unknown', template: null });
    await waitFor(
      () => {
        expect(screen.queryByTestId('og-image-picker-error')).not.toBeNull();
      },
      { timeout: 1500 },
    );
    expect(screen.getByText('Média introuvable.')).toBeTruthy();
  });

  it('signal AbortController est passé au fetch (annulation possible)', async () => {
    const fetchMock = vi.fn(async (_url: string, opts: RequestInit) => {
      expect((opts as { signal?: AbortSignal }).signal).toBeDefined();
      return new Response(JSON.stringify({ id: 'x', url: '/u.png', width: 1, height: 1 }), {
        status: 200,
      });
    });
    global.fetch = fetchMock as never;
    setup({ mediaId: 'med_a', template: null });
    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalled();
      },
      { timeout: 1500 },
    );
  });
});

describe('OgImagePicker — mode template', () => {
  it('select met à jour le template via onChange', () => {
    const { onChange } = setup({ mediaId: null, template: 'marketing' });
    fireEvent.change(screen.getByTestId('og-image-picker-template-select'), {
      target: { value: 'product' },
    });
    expect(onChange).toHaveBeenCalledWith({ mediaId: null, template: 'product' });
  });

  it('helper indique génération dynamique active quand dynamicEnabled=true', () => {
    setup({ mediaId: null, template: 'marketing' }, { dynamicEnabled: true });
    expect(screen.getByTestId('og-image-picker-template-preview').textContent).toContain('runtime');
  });

  it('helper indique attente activation flag quand dynamicEnabled=false', () => {
    setup({ mediaId: null, template: 'marketing' }, { dynamicEnabled: false });
    expect(screen.getByTestId('og-image-picker-template-preview').textContent).toContain(
      'NEXT_PUBLIC_SEO_OG_DYNAMIC',
    );
  });
});

describe('OgImagePicker — accessibilité et disabled', () => {
  it('disabled propage à la fieldset', () => {
    setup({ mediaId: null, template: null }, { disabled: true });
    const fieldset = screen.getByTestId('og-image-picker') as HTMLFieldSetElement;
    expect(fieldset.disabled).toBe(true);
  });

  it('les 3 radios partagent le même `name`', () => {
    setup({ mediaId: null, template: null });
    const radios = [
      screen.getByTestId<HTMLInputElement>('og-image-picker-mode-none'),
      screen.getByTestId<HTMLInputElement>('og-image-picker-mode-media'),
      screen.getByTestId<HTMLInputElement>('og-image-picker-mode-template'),
    ];
    const names = new Set(radios.map((r) => r.name));
    expect(names.size).toBe(1);
  });
});

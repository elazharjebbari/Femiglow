/**
 * RTL — PreviewFrame (F4 / P9).
 *
 * Couvre :
 *   - rendu de l'iframe avec src `/admin/components/[key]/preview?w=desktop`,
 *   - WidthToggle (radiogroup) — change la largeur de l'iframe,
 *   - debounce 200 ms du `FIELDS_CHANGED` quand `changeTick` change,
 *   - ne poste rien tant que `PREVIEW_READY` n'a pas été reçu,
 *   - relaye `FIELD_CLICKED` via `admin:focus-field` CustomEvent.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PreviewFrame } from './PreviewFrame';

const COMP = 'home-hero';

afterEach(() => {
  vi.useRealTimers();
});

function dispatchReady(): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: 'PREVIEW_READY', componentKey: COMP },
      origin: window.location.origin,
    }),
  );
}

describe('PreviewFrame', () => {
  it('rend l\'iframe avec un src vers la route preview', () => {
    render(<PreviewFrame componentKey={COMP} changeTick={0} />);
    const iframe = screen.getByTitle(/Aperçu home-hero/);
    expect(iframe).toHaveAttribute(
      'src',
      `/admin/components/${COMP}/preview?w=desktop`,
    );
    expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin allow-scripts');
  });

  it('WidthToggle change la largeur du iframe (375 px / 768 px)', () => {
    render(<PreviewFrame componentKey={COMP} changeTick={0} />);
    const mobile = screen.getByRole('radio', { name: '375' });
    const tablet = screen.getByRole('radio', { name: '768' });
    fireEvent.click(mobile);
    const iframe = screen.getByTitle(/Aperçu home-hero/);
    expect(iframe).toHaveStyle({ width: '375px' });
    fireEvent.click(tablet);
    expect(iframe).toHaveStyle({ width: '768px' });
  });

  it('ne poste pas FIELDS_CHANGED tant que l\'iframe n\'est pas ready', async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <PreviewFrame componentKey={COMP} changeTick={1} />,
    );
    // Simulons un postMessage côté contentWindow
    const iframe = screen.getByTitle(/Aperçu home-hero/) as HTMLIFrameElement;
    const postSpy = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: postSpy },
      configurable: true,
    });
    rerender(<PreviewFrame componentKey={COMP} changeTick={2} />);
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('poste FIELDS_CHANGED debounced 200 ms après ready + tick', async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <PreviewFrame componentKey={COMP} changeTick={0} />,
    );
    const iframe = screen.getByTitle(/Aperçu home-hero/) as HTMLIFrameElement;
    const postSpy = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: postSpy },
      configurable: true,
    });

    // ready arrive
    act(() => {
      dispatchReady();
    });
    // changeTick passe de 0 à 1 → un FIELDS_CHANGED debounced doit partir
    rerender(<PreviewFrame componentKey={COMP} changeTick={1} />);

    expect(postSpy).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      { type: 'FIELDS_CHANGED', componentKey: COMP },
      window.location.origin,
    );
  });

  it('relaye FIELD_CLICKED via CustomEvent admin:focus-field', () => {
    render(<PreviewFrame componentKey={COMP} changeTick={0} />);
    const handler = vi.fn();
    document.addEventListener('admin:focus-field', handler);
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'FIELD_CLICKED',
            componentKey: COMP,
            fieldKey: 'title',
          },
          origin: window.location.origin,
        }),
      );
    });
    expect(handler).toHaveBeenCalled();
    const ev = handler.mock.calls[0]![0] as CustomEvent<{ fieldKey: string }>;
    expect(ev.detail.fieldKey).toBe('title');
    document.removeEventListener('admin:focus-field', handler);
  });
});

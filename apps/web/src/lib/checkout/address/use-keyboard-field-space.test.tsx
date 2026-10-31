import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useKeyboardFieldSpace } from './use-keyboard-field-space';

vi.mock('@/lib/checkout/wizard-arrival', () => ({ measureWizardTopInset: () => 120 }));

function Form({ inPanel = false }: { inPanel?: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  useKeyboardFieldSpace(ref, { inPanel });
  return (
    <form ref={ref}>
      <input data-testid="a" />
      <input data-testid="b" />
    </form>
  );
}

class FakeViewport extends EventTarget {
  height = 844;
  offsetTop = 0;
}

let viewport: FakeViewport;
const scrollIntoView = vi.fn();

const field = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
const openKeyboard = () => {
  viewport.height = 500;
  viewport.dispatchEvent(new Event('resize'));
};

beforeEach(() => {
  vi.useFakeTimers();
  viewport = new FakeViewport();
  vi.stubGlobal('visualViewport', viewport);
  Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
  Element.prototype.scrollIntoView = scrollIntoView;
  scrollIntoView.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useKeyboardFieldSpace', () => {
  it('clavier ouvert : le champ actif remonte sous les barres, libellé compris', () => {
    render(<Form />);
    act(() => {
      field('a').focus();
      openKeyboard();
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(field('a').style.scrollMarginTop).toBe('152px');
  });

  it('clavier signalé en retard ou jamais : rattrapé par le délai', () => {
    render(<Form />);
    act(() => {
      field('a').focus();
      viewport.height = 500;
      vi.advanceTimersByTime(400);
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('sans clavier (ordinateur) : la page ne bouge pas', () => {
    render(<Form />);
    act(() => {
      field('a').focus();
      vi.advanceTimersByTime(400);
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('barre d’adresse qui bouge : ce n’est pas un clavier', () => {
    render(<Form />);
    act(() => {
      field('a').focus();
      viewport.height = 790;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('une seule fois par focus : la cliente garde la main', () => {
    render(<Form />);
    act(() => {
      field('a').focus();
      openKeyboard();
      viewport.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(400);
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('passage au champ suivant : réaligné', () => {
    render(<Form />);
    act(() => {
      field('a').focus();
      openKeyboard();
      field('b').focus();
      vi.advanceTimersByTime(400);
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('dans le panneau : pas de barre de page à compter', () => {
    render(<Form inPanel />);
    act(() => {
      field('a').focus();
      openKeyboard();
    });
    expect(field('a').style.scrollMarginTop).toBe('32px');
  });
});

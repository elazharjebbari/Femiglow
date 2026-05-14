import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ToastProvider, useToast } from '../Toast';

function TriggerButton({ tone, message }: { tone: 'success' | 'error' | 'info'; message: string }) {
  const { push } = useToast();
  return (
    <button type="button" onClick={() => push(tone, message)}>
      push
    </button>
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastProvider', () => {
  it('push("success", "..." ) affiche un toast avec ✓ prefix', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <TriggerButton tone="success" message="Sauvegardé !" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: /push/ }));
    const region = screen.getByRole('region', { name: /Notifications/ });
    expect(region.textContent).toContain('✓');
    expect(region.textContent).toContain('Sauvegardé !');
  });

  it('toast disparait après 5s', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <TriggerButton tone="info" message="Hello" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: /push/ }));
    expect(screen.getByText('Hello')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5_001);
    });
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
  });

  it('tone="error" applique les classes rouges', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <TriggerButton tone="error" message="Erreur" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: /push/ }));
    const toast = screen.getByRole('status');
    expect(toast.className).toContain('bg-red-50');
    expect(toast.textContent).toContain('⚠');
  });

  it('plusieurs toasts s\'empilent dans la région', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    function Multi() {
      const { push } = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            push('info', 'A');
            push('success', 'B');
          }}
        >
          double
        </button>
      );
    }
    render(
      <ToastProvider>
        <Multi />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: /double/ }));
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('useToast hors provider → no-op safe', () => {
    function Lonely() {
      const { push } = useToast();
      push('info', 'should not crash');
      return <span>OK</span>;
    }
    expect(() => render(<Lonely />)).not.toThrow();
  });

  it('a11y : region avec aria-live=polite + aria-label', async () => {
    render(
      <ToastProvider>
        <span>x</span>
      </ToastProvider>,
    );
    const region = screen.getByRole('region');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-label', 'Notifications');
  });
});

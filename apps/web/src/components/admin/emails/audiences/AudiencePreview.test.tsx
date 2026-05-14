import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { AudiencePreview } from './AudiencePreview';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';

const validRules: RulesGroup = {
  kind: 'all',
  conditions: [{ kind: 'consent_marketing', value: true }],
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('<AudiencePreview />', () => {
  it('shows empty state when rules are invalid', () => {
    const fetchImpl = vi.fn();
    render(
      <AudiencePreview
        rules={{ kind: 'all', conditions: [] }}
        fetchImpl={fetchImpl as never}
      />,
    );
    expect(screen.getByTestId('preview-empty')).toBeInTheDocument();
  });

  it('fetches size after debounce on valid rules', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ size: 47, durationMs: 412 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    render(
      <AudiencePreview rules={validRules} fetchImpl={fetchImpl as never} debounceMs={100} />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('preview-count')).toBeInTheDocument());
    expect(screen.getByTestId('preview-count')).toHaveTextContent('47');
  });

  it('shows error state on fetch failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('error', { status: 500 }));

    render(
      <AudiencePreview rules={validRules} fetchImpl={fetchImpl as never} debounceMs={50} />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await waitFor(() => expect(screen.queryByTestId('preview-error')).toBeInTheDocument());
  });

  it('manual refresh triggers fetchSize immediately', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ size: 5, durationMs: 100 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    render(<AudiencePreview rules={validRules} fetchImpl={fetchImpl as never} debounceMs={5000} />);

    fireEvent.click(screen.getByTestId('preview-refresh'));
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
  });

  it('fetches samples when "Voir 10 exemples" clicked', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ size: 47, durationMs: 100 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            samples: [
              { email: 'a@b.com', name: 'Alice', createdAt: '2026-01-01' },
              { email: 'c@d.com', name: null, createdAt: '2026-01-02' },
            ],
            size: 47,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    render(
      <AudiencePreview rules={validRules} fetchImpl={fetchImpl as never} debounceMs={50} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await waitFor(() => expect(screen.queryByTestId('show-samples')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('show-samples'));
    await waitFor(() => expect(screen.queryByTestId('samples-list')).toBeInTheDocument());
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
  });
});

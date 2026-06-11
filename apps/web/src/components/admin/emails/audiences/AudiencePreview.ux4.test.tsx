/**
 * UX4-AUDIENCES-011 — AudiencePreview : drill-down ciblés / exclus / envoyables.
 *
 * Oracle : « Détailler » appelle preview-breakdown et affiche
 * « N ciblés − M exclus = K envoyables » (santé du ciblage). L'écart exclus
 * est visible et distinct du count global.
 */
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

describe('<AudiencePreview /> — UX4-AUDIENCES-011 (breakdown)', () => {
  it('affiche ciblés − exclus = envoyables après « Détailler »', async () => {
    const fetchImpl = vi
      .fn()
      // 1er appel = preview-size (count global).
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ size: 42, durationMs: 10 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      // 2e appel = preview-breakdown.
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ matched: 50, excluded: 8, deliverable: 42, durationMs: 10 }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    render(<AudiencePreview rules={validRules} fetchImpl={fetchImpl as never} debounceMs={50} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await waitFor(() => expect(screen.getByTestId('preview-count')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('show-breakdown'));
    await waitFor(() => expect(screen.getByTestId('breakdown')).toBeInTheDocument());

    expect(screen.getByTestId('breakdown-matched')).toHaveTextContent('50');
    expect(screen.getByTestId('breakdown-excluded')).toHaveTextContent('8');
    expect(screen.getByTestId('breakdown-deliverable')).toHaveTextContent('42');
  });
});

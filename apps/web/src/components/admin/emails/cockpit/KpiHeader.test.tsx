/**
 * Tests RTL — KpiHeader.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, renderHook, waitFor } from '@testing-library/react';
import { KpiHeader, useSummary, type SummaryDto } from './KpiHeader';

function buildSummary(overrides: Partial<SummaryDto> = {}): SummaryDto {
  return {
    window: '1h',
    delivered: 1243,
    queued: 12,
    failed: 8,
    hardBounced: 3,
    sparkline: Array.from({ length: 12 }, () => ({ delivered: 100, failed: 1 })),
    comparison: { deliveredPct: 12, failedPct: -23 },
    ...overrides,
  };
}

describe('<KpiHeader />', () => {
  it('renders skeleton when loading', () => {
    render(<KpiHeader data={null} isLoading />);
    expect(screen.getByTestId('kpi-header-skeleton')).toBeInTheDocument();
  });

  it('renders error banner', () => {
    const onRefresh = vi.fn();
    render(<KpiHeader data={null} error={new Error('Network')} onRefresh={onRefresh} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Network/);
    fireEvent.click(screen.getByText(/Réessayer/));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('renders the 4 KPI cards with values', () => {
    render(<KpiHeader data={buildSummary()} />);
    expect(screen.getByTestId('kpi-delivered')).toHaveTextContent('1 243');
    expect(screen.getByTestId('kpi-queued')).toHaveTextContent('12');
    expect(screen.getByTestId('kpi-failed')).toHaveTextContent('8');
    expect(screen.getByTestId('kpi-hard-bounced')).toHaveTextContent('3');
  });

  it('shows trend arrows from comparison', () => {
    render(<KpiHeader data={buildSummary()} />);
    const delivered = screen.getByTestId('kpi-delivered');
    expect(delivered).toHaveTextContent('↑ 12%');
    const failed = screen.getByTestId('kpi-failed');
    expect(failed).toHaveTextContent('↓ 23%');
  });

  it('shows alert badge when failed ≥ threshold', () => {
    render(<KpiHeader data={buildSummary({ failed: 10 })} failedAlertThreshold={5} />);
    expect(screen.getByTestId('kpi-failed')).toHaveTextContent(/attention/i);
  });

  it('shows alert when any hard bounce', () => {
    render(<KpiHeader data={buildSummary({ hardBounced: 1 })} />);
    expect(screen.getByTestId('kpi-hard-bounced')).toHaveTextContent(/attention/i);
  });

  it('does not show alert when below threshold', () => {
    render(<KpiHeader data={buildSummary({ failed: 2, hardBounced: 0 })} failedAlertThreshold={5} />);
    expect(screen.getByTestId('kpi-failed')).not.toHaveTextContent(/attention/i);
  });

  it('calls onKpiClick when a card is clicked', () => {
    const onKpiClick = vi.fn();
    render(<KpiHeader data={buildSummary()} onKpiClick={onKpiClick} />);
    fireEvent.click(screen.getByTestId('kpi-failed'));
    expect(onKpiClick).toHaveBeenCalledWith('failed');
  });

  it('renders refresh button + calls onRefresh', () => {
    const onRefresh = vi.fn();
    render(<KpiHeader data={buildSummary()} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByLabelText(/Rafraîchir/i));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('renders sparkline SVGs', () => {
    render(<KpiHeader data={buildSummary()} />);
    const svgs = document.querySelectorAll('svg');
    // 4 cards × 1 sparkline each
    expect(svgs.length).toBeGreaterThanOrEqual(4);
  });

  it('handles missing comparison gracefully', () => {
    render(<KpiHeader data={buildSummary({ comparison: undefined })} />);
    // No crash, just no trend visible
    expect(screen.getByTestId('kpi-delivered')).toBeInTheDocument();
  });
});

describe('useSummary hook', () => {
  it('fetches once on mount and exposes data', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(buildSummary()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { result } = renderHook(() =>
      useSummary({ window: '1h', refreshIntervalMs: 0, fetchImpl }),
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data?.delivered).toBe(1243);
    expect(result.current.isLoading).toBe(false);
    expect(fetchImpl).toHaveBeenCalledWith('/api/admin/emails/transactional/summary?window=1h');
  });

  it('reports error state when fetch fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('Server error', { status: 500 }));
    const { result } = renderHook(() =>
      useSummary({ refreshIntervalMs: 0, fetchImpl }),
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toMatch(/HTTP 500/);
  });

  it('auto-refreshes at the configured interval', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(buildSummary()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      renderHook(() => useSummary({ refreshIntervalMs: 5_000, fetchImpl }));
      await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      expect(fetchImpl).toHaveBeenCalledTimes(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      expect(fetchImpl).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });
});

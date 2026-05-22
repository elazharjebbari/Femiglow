import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from './MetricCard';
import { DraftsAwaitingCard } from './DraftsAwaitingCard';
import { PostsThisWeekCard } from './PostsThisWeekCard';
import { TopPerformersCard } from './TopPerformersCard';

describe('MetricCard', () => {
  it('renders the value + label even without href', () => {
    render(<MetricCard label="Coût IA" value="12.34 €" />);
    expect(screen.getByText('Coût IA')).toBeInTheDocument();
    expect(screen.getByText('12.34 €')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('wraps in a link when href is provided', () => {
    render(<MetricCard label="Jobs" value="92%" href="/admin/content-studio-v2/library?postiz_state=draft" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/admin/content-studio-v2/library?postiz_state=draft');
    expect(link).toHaveAttribute('aria-label', 'Jobs: 92%');
  });

  it('honors a custom aria-label', () => {
    render(<MetricCard label="X" value="1" href="/x" ariaLabel="Custom label" />);
    expect(screen.getByRole('link')).toHaveAttribute('aria-label', 'Custom label');
  });
});

describe('DraftsAwaitingCard deep-link', () => {
  it('points to /library?status=needs_review by default', () => {
    render(
      <DraftsAwaitingCard data={{ count: 3, oldestAgeHours: 12 }} />,
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/admin/content-studio-v2/library?status=needs_review',
    );
  });

  it('renders the empty subline when no drafts are pending', () => {
    render(<DraftsAwaitingCard data={{ count: 0, oldestAgeHours: null }} />);
    expect(screen.getByText('Aucun brouillon en attente')).toBeInTheDocument();
  });
});

describe('PostsThisWeekCard deep-link', () => {
  it('points to /plan?range=next7 by default', () => {
    render(
      <PostsThisWeekCard
        data={{
          total: 4,
          dailyCounts: [
            { date: '2026-05-16', count: 1 },
            { date: '2026-05-17', count: 0 },
            { date: '2026-05-18', count: 1 },
            { date: '2026-05-19', count: 0 },
            { date: '2026-05-20', count: 1 },
            { date: '2026-05-21', count: 0 },
            { date: '2026-05-22', count: 1 },
          ],
        }}
      />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/admin/content-studio-v2/plan?range=next7');
    expect(link.getAttribute('aria-label')).toContain('Posts cette semaine');
  });
});

describe('TopPerformersCard deep-link', () => {
  it('generates a /library?postId=... link per row, encoded', () => {
    render(
      <TopPerformersCard
        rows={[
          {
            postId: 'post/abc 1',
            capturedAt: new Date('2026-05-22T10:00:00Z'),
            engagementRate: 0.123,
            impressions: 100,
            reach: 80,
            likes: 10,
            comments: 1,
            shares: 0,
            saves: 0,
            source: 'instagram',
          },
        ]}
      />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute(
      'href',
      '/admin/content-studio-v2/library?postId=post%2Fabc%201',
    );
  });

  it('shows the empty state when there is no snapshot', () => {
    render(<TopPerformersCard rows={[]} />);
    expect(screen.getByText(/Aucun snapshot disponible/)).toBeInTheDocument();
  });
});

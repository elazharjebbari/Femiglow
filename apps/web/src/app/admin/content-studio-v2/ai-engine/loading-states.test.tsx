/**
 * @vitest-environment jsdom
 */
/**
 * Tests that all loading.tsx files under ai-engine render without error
 * and contain skeleton elements.
 *
 * Gap #34 — 7 tests
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Mock the LoadingShell / AppShell to just render children
vi.mock('@/components/admin/content-studio-v2/shell/LoadingShell', () => ({
  LoadingShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="loading-shell">{children}</div>
  ),
  SkeletonBlock: ({ height }: { height?: number }) => (
    <div data-testid="skeleton-block" style={{ minHeight: height }} />
  ),
  SkeletonHeader: ({
    eyebrow,
    title,
  }: {
    eyebrow?: number;
    title?: number;
  }) => (
    <div data-testid="skeleton-header" data-eyebrow={eyebrow} data-title={title} />
  ),
}));

// Mock the Skeleton primitive
vi.mock('@/components/admin/content-studio-v2/primitives', () => ({
  Skeleton: ({
    width,
    height,
    ...rest
  }: {
    width?: number | string;
    height?: number;
    rounded?: string;
    style?: React.CSSProperties;
  }) => (
    <div
      data-testid="skeleton"
      style={{ width: typeof width === 'number' ? width : undefined, height, ...rest.style }}
    />
  ),
}));

// Also mock the Skeleton from its direct path for the loading files that import it
vi.mock('@/components/admin/content-studio-v2/primitives/Skeleton', () => ({
  Skeleton: ({
    width,
    height,
    ...rest
  }: {
    width?: number | string;
    height?: number;
    rounded?: string;
    style?: React.CSSProperties;
  }) => (
    <div
      data-testid="skeleton"
      style={{ width: typeof width === 'number' ? width : undefined, height, ...rest.style }}
    />
  ),
}));

import DashboardLoading from './loading';
import CreateLoading from './create/loading';
import ConfigLoading from './config/loading';
import AnalyticsLoading from './analytics/loading';
import KnowledgeLoading from './knowledge/loading';
import GraphLoading from './graph/loading';

describe('Loading states (Gap #34)', () => {
  it('dashboard loading renders without error', () => {
    const { container } = render(<DashboardLoading />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('create loading renders without error', () => {
    const { container } = render(<CreateLoading />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('config loading renders without error', () => {
    const { container } = render(<ConfigLoading />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('analytics loading renders without error', () => {
    const { container } = render(<AnalyticsLoading />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('knowledge loading renders without error', () => {
    const { container } = render(<KnowledgeLoading />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('graph loading renders without error', () => {
    const { container } = render(<GraphLoading />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('all loading states contain skeleton elements', () => {
    const components = [
      DashboardLoading,
      CreateLoading,
      ConfigLoading,
      AnalyticsLoading,
      KnowledgeLoading,
      GraphLoading,
    ];

    for (const Component of components) {
      const { container, unmount } = render(<Component />);
      // Each loading state should contain skeleton-block or skeleton elements
      const skeletons = container.querySelectorAll(
        '[data-testid="skeleton-block"], [data-testid="skeleton"], [data-testid="skeleton-header"]',
      );
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
      unmount();
    }
  });
});

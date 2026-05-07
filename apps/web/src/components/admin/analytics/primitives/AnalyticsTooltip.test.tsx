import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AnalyticsTooltip } from './AnalyticsTooltip';

describe('AnalyticsTooltip', () => {
  it('returns null when not active', () => {
    const { container } = render(<AnalyticsTooltip active={false} payload={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when payload is empty', () => {
    const { container } = render(<AnalyticsTooltip active payload={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders label and entries', () => {
    render(
      <AnalyticsTooltip
        active
        label="06 mai"
        payload={[
          { name: 'Sessions', value: 100, color: '#7c8b76' },
          { name: 'Pages vues', value: 250, color: '#94a3b8' },
        ]}
      />,
    );
    expect(screen.getByText('06 mai')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Pages vues')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
  });

  it('uses formatter prop to format value', () => {
    render(
      <AnalyticsTooltip
        active
        payload={[{ name: 'Conv.', value: 0.15 }]}
        formatter={(v) => `${(Number(v) * 100).toFixed(1)} %`}
      />,
    );
    expect(screen.getByText('15.0 %')).toBeInTheDocument();
  });
});

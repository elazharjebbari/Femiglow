import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChartFrame } from './ChartFrame';

describe('ChartFrame', () => {
  it('renders title, description and children', () => {
    render(
      <ChartFrame title="Sessions" description="Trafic">
        <div data-testid="chart-content">chart</div>
      </ChartFrame>,
    );
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Trafic')).toBeInTheDocument();
    expect(screen.getByTestId('chart-content')).toBeInTheDocument();
  });

  it('shows skeleton in loading state', () => {
    render(
      <ChartFrame title="X" loading>
        <div>shouldNotRender</div>
      </ChartFrame>,
    );
    expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('shouldNotRender')).not.toBeInTheDocument();
  });

  it('shows error state', () => {
    render(
      <ChartFrame title="X" error="Boom">
        <div>shouldNotRender</div>
      </ChartFrame>,
    );
    expect(screen.getByText('Boom')).toBeInTheDocument();
  });

  it('shows empty state when isEmpty', () => {
    render(
      <ChartFrame title="X" isEmpty emptyMessage="Pas de données ici">
        <div>shouldNotRender</div>
      </ChartFrame>,
    );
    expect(screen.getByText('Pas de données ici')).toBeInTheDocument();
    expect(screen.queryByText('shouldNotRender')).not.toBeInTheDocument();
  });
});

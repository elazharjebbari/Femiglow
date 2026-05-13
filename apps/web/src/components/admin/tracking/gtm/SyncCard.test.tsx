import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyncCard } from './SyncCard';

describe('SyncCard', () => {
  it('affiche admin et runtime values', () => {
    render(
      <SyncCard
        title="Mapping vendors"
        adminValue="v17"
        runtimeValue="v17"
        match={true}
        testId="sync-card-mapping"
      />,
    );
    expect(screen.getByTestId('sync-card-mapping')).toHaveAttribute('data-match', 'true');
    expect(screen.getByText('v17')).toBeInTheDocument();
    // Both values v17 visible
    const v17Matches = screen.getAllByText(/v17/);
    expect(v17Matches.length).toBeGreaterThanOrEqual(2);
  });

  it('signale ✗ en cas de mismatch', () => {
    render(
      <SyncCard
        title="Bundle ID"
        adminValue="a7c4f2e9b81d"
        runtimeValue="bbbbbbbbbbbb"
        match={false}
        testId="sync-card-bundle"
      />,
    );
    expect(screen.getByTestId('sync-card-bundle')).toHaveAttribute('data-match', 'false');
    expect(screen.getByText(/bbbbbbbbbbbb ✗/)).toBeInTheDocument();
  });

  it('affiche le subtitle si fourni', () => {
    render(
      <SyncCard
        title="X"
        adminValue="A"
        runtimeValue="A"
        match={true}
        subtitle="Cohérent depuis 3j"
      />,
    );
    expect(screen.getByText(/Cohérent depuis 3j/)).toBeInTheDocument();
  });

  it('omit le subtitle si null', () => {
    const { container } = render(
      <SyncCard title="X" adminValue="A" runtimeValue="A" match={true} subtitle={null} />,
    );
    // Ne plante pas, juste pas de paragraphe additionnel
    expect(container.querySelectorAll('p').length).toBe(0);
  });

  it("titre est dans un heading", () => {
    render(<SyncCard title="Mapping vendors" adminValue="v17" runtimeValue="v17" match={true} />);
    expect(screen.getByRole('heading', { name: /Mapping vendors/i })).toBeInTheDocument();
  });
});

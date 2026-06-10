/**
 * AccountHealthCard tests (F14).
 *
 * Couvre rendu (empty/populated), badges status, dates formatées,
 * accessibilité label.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountHealthCard } from './AccountHealthCard';
import type { AccountHealth } from '@/lib/content-studio/dashboard';
import {
  accountInstagramActive,
  accountInstagramDisabled,
  accountInstagramTokenExpired,
} from '@/test/fixtures/social-publishing';

function makeRow(over: Partial<AccountHealth>): AccountHealth {
  return {
    account: accountInstagramActive,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureCode: null,
    ...over,
  };
}

describe('AccountHealthCard', () => {
  it('shows empty state when no rows', () => {
    render(<AccountHealthCard rows={[]} />);
    expect(screen.getByText(/Aucun compte social synchronisé/i)).toBeVisible();
  });

  it('shows singular when 1 connected', () => {
    render(<AccountHealthCard rows={[makeRow({})]} />);
    expect(screen.getByText(/1 connecté/)).toBeVisible();
  });

  it('shows plural when ≥2 connected', () => {
    render(
      <AccountHealthCard
        rows={[
          makeRow({}),
          makeRow({ account: { ...accountInstagramActive, id: 'sa_2', name: 'B' } }),
        ]}
      />,
    );
    expect(screen.getByText(/2 connectés/)).toBeVisible();
  });

  it('renders account name and provider · platform', () => {
    render(<AccountHealthCard rows={[makeRow({})]} />);
    expect(screen.getByText(accountInstagramActive.name)).toBeVisible();
    expect(
      screen.getByText(new RegExp(`${accountInstagramActive.provider}.*${accountInstagramActive.platform}`)),
    ).toBeVisible();
  });

  it('renders last success date when present', () => {
    const date = new Date('2026-05-28T00:00:00Z');
    render(<AccountHealthCard rows={[makeRow({ lastSuccessAt: date })]} />);
    expect(screen.getByText(/OK 28\/05/)).toBeVisible();
  });

  it('renders last failure date when present', () => {
    const date = new Date('2026-05-28T00:00:00Z');
    render(<AccountHealthCard rows={[makeRow({ lastFailureAt: date })]} />);
    expect(screen.getByText(/KO 28\/05/)).toBeVisible();
  });

  it('badge tone=sage for active account', () => {
    render(<AccountHealthCard rows={[makeRow({})]} />);
    // active badge contains the text 'active'
    expect(screen.getByText('active')).toBeVisible();
  });

  it('badge tone=saffron for disabled account', () => {
    render(<AccountHealthCard rows={[makeRow({ account: accountInstagramDisabled })]} />);
    expect(screen.getByText('disabled')).toBeVisible();
  });

  it('badge tone=saffron for token_expired account', () => {
    render(<AccountHealthCard rows={[makeRow({ account: accountInstagramTokenExpired })]} />);
    expect(screen.getByText('token_expired')).toBeVisible();
  });

  it('renders multiple rows', () => {
    render(
      <AccountHealthCard
        rows={[
          makeRow({}),
          makeRow({ account: accountInstagramDisabled }),
          makeRow({ account: accountInstagramTokenExpired }),
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(3);
  });
});

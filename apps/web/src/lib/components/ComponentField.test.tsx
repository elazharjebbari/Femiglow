/**
 * Smoke test — `<ComponentField>` RSC wrapper.
 *
 * Le résolveur est mocké : on vérifie uniquement que le composant rend
 * la bonne forme (string, render prop, fallback, dev placeholder).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./field-resolver', () => ({
  resolveComponentField: vi.fn(),
}));

import { ComponentField } from './ComponentField';
import { resolveComponentField } from './field-resolver';

const resolverMock = vi.mocked(resolveComponentField);

async function renderRSC(node: Promise<React.ReactNode>) {
  const resolved = await node;
  return render(<>{resolved}</>);
}

describe('<ComponentField> (smoke)', () => {
  it('renders a string value when source is binding', async () => {
    resolverMock.mockResolvedValueOnce({
      value: 'Bonjour FemiGlow',
      meta: { source: 'binding', bindingId: 'cfb_1', version: 1, locale: 'fr' },
    });
    await renderRSC(
      ComponentField({
        componentKey: 'home-hero',
        fieldKey: 'title',
      }) as unknown as Promise<React.ReactNode>,
    );
    expect(screen.getByText('Bonjour FemiGlow')).toBeInTheDocument();
  });

  it('calls children render prop when provided', async () => {
    resolverMock.mockResolvedValueOnce({
      value: { label: 'Découvrir', href: '/kit' },
      meta: { source: 'binding', bindingId: 'cfb_2', version: 1, locale: 'fr' },
    });
    await renderRSC(
      ComponentField({
        componentKey: 'home-hero',
        fieldKey: 'cta',
        children: (value) => {
          const cta = value as { label: string; href: string };
          return <a href={cta.href}>{cta.label}</a>;
        },
      }) as unknown as Promise<React.ReactNode>,
    );
    const link = screen.getByRole('link', { name: 'Découvrir' });
    expect(link).toHaveAttribute('href', '/kit');
  });

  it('renders fallback when value is null and not in dev-missing path', async () => {
    resolverMock.mockResolvedValueOnce({
      value: null,
      meta: { source: 'default', version: 0, locale: 'fr' },
    });
    await renderRSC(
      ComponentField({
        componentKey: 'home-hero',
        fieldKey: 'subtitle',
        fallback: <span data-testid="fb">no value</span>,
      }) as unknown as Promise<React.ReactNode>,
    );
    expect(screen.getByTestId('fb')).toHaveTextContent('no value');
  });
});

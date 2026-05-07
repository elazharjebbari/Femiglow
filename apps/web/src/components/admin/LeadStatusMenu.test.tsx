import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import { LeadStatusMenu } from './LeadStatusMenu';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

describe('LeadStatusMenu', () => {
  it('rend un select étiqueté avec les options de transition', () => {
    const { getByLabelText, getByRole } = render(
      <LeadStatusMenu leadId="l_1" current="new" options={['contacted', 'lost']} />,
    );
    expect(getByLabelText('Changer le statut')).toBeInTheDocument();
    expect(getByRole('option', { name: /Nouveau/i })).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(
      <LeadStatusMenu leadId="l_1" current="new" options={['contacted']} />,
    );
    await expectNoAxeViolations(container);
  });
});

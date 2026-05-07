import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import { WebhookCreateForm } from './WebhookCreateForm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => {} }),
}));

describe('WebhookCreateForm', () => {
  it('rend les champs URL, événements et description', () => {
    const { getByLabelText, getByRole } = render(<WebhookCreateForm />);
    expect(getByLabelText(/URL HTTPS/i)).toBeInTheDocument();
    expect(getByRole('group', { name: /Événements/i })).toBeInTheDocument();
    expect(getByLabelText(/Description/i)).toBeInTheDocument();
    expect(getByRole('button', { name: /Créer l['’]endpoint/i })).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<WebhookCreateForm />);
    await expectNoAxeViolations(container);
  });
});

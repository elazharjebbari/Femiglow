import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoginForm } from './LoginForm';
import { expectNoAxeViolations } from '@/test/axe';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => {}, refresh: () => {} }),
}));

describe('LoginForm', () => {
  it('rend les champs email et mot de passe', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<LoginForm />);
    await expectNoAxeViolations(container);
  });
});

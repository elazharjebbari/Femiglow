import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import { LeadNoteForm } from './LeadNoteForm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

describe('LeadNoteForm', () => {
  it('rend un textarea associé à un label', () => {
    const { getByLabelText, getByRole } = render(<LeadNoteForm leadId="l_1" />);
    expect(getByLabelText('Note interne')).toBeInTheDocument();
    expect(getByRole('button', { name: /Ajouter la note/i })).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<LeadNoteForm leadId="l_1" />);
    await expectNoAxeViolations(container);
  });
});

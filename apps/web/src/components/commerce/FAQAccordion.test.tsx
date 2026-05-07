import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FAQAccordion } from './FAQAccordion';
import { mockKitPageContent } from '@/data/mock/kit';
import { expectNoAxeViolations } from '@/test/axe';

describe('FAQAccordion', () => {
  it('rend toutes les questions', () => {
    const { container } = render(<FAQAccordion items={mockKitPageContent.faq} />);
    const summaries = container.querySelectorAll('summary');
    expect(summaries).toHaveLength(mockKitPageContent.faq.length);
  });

  it('ouvre une réponse au clic sur la question', async () => {
    const user = userEvent.setup();
    const { container } = render(<FAQAccordion items={mockKitPageContent.faq} />);
    const first = container.querySelector('details') as HTMLDetailsElement;
    expect(first.open).toBe(false);
    await user.click(first.querySelector('summary')!);
    expect(first.open).toBe(true);
  });

  it('respecte axe', async () => {
    const { container } = render(<FAQAccordion items={mockKitPageContent.faq} />);
    await expectNoAxeViolations(container);
  });
});
